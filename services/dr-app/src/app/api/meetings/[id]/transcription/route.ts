import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  importExistingDrVideoTranscriptForMeeting,
  reconcileMeetingActiveState,
  startPostCallMeetingTranscription
} from "@/lib/meetingTranscription";

type RecordingItem = {
  roomId: string;
  sessionId: string;
  filename: string;
  bytes: number;
  updatedAt: string;
  transcriptExists: boolean;
};

function normalizeRoomId(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getDrVideoBase() {
  return (process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

type TranscriptStatus =
  | {
      stage: "ready";
      label: string;
      detail: string;
      error?: null;
    }
  | {
      stage: "waiting_for_call_end" | "queued" | "running" | "failed" | "idle";
      label: string;
      detail: string;
      error?: string | null;
    };

function buildStatusFromState(args: {
  meetingIsActive: boolean;
  provider: string;
  existingJob: {
    status: string;
    provider: string;
    lastError: string | null;
  } | null;
  remoteJob: {
    status: string;
    provider: string | null;
    error: string | null;
  } | null;
  hasTranscript: boolean;
}): TranscriptStatus {
  if (args.hasTranscript) {
    return {
      stage: "ready",
      label: "Transcript ready",
      detail: "The post-call transcript is available.",
      error: null
    };
  }

  if (args.meetingIsActive) {
    return {
      stage: "waiting_for_call_end",
      label: "Waiting for call to end",
      detail: "Post-call transcription starts after the meeting is finished.",
      error: null
    };
  }

  if (args.remoteJob) {
    if (args.remoteJob.status === "CLAIMED") {
      return {
        stage: "running",
        label: "Transcription in progress",
        detail: "A remote worker is currently processing the recording.",
        error: null
      };
    }
    if (args.remoteJob.status === "PENDING") {
      return {
        stage: "queued",
        label: "Transcription queued",
        detail: "The recording is queued for a remote worker.",
        error: null
      };
    }
    if (args.remoteJob.status === "FAILED") {
      return {
        stage: "failed",
        label: "Transcription failed",
        detail: "The remote transcription job failed.",
        error: args.remoteJob.error || null
      };
    }
  }

  if (args.existingJob) {
    if (args.existingJob.status === "RUNNING") {
      return {
        stage: "running",
        label: "Transcription in progress",
        detail: `${args.provider} is processing the recording.`,
        error: null
      };
    }
    if (args.existingJob.status === "PENDING") {
      return {
        stage: "queued",
        label: "Transcription queued",
        detail: `The recording is waiting for a ${args.provider} processing slot.`,
        error: null
      };
    }
    if (args.existingJob.status === "FAILED") {
      return {
        stage: "failed",
        label: "Transcription failed",
        detail: `${args.provider} could not finish the post-call transcription.`,
        error: args.existingJob.lastError || null
      };
    }
  }

  return {
    stage: "idle",
    label: "Waiting to start",
    detail: "The system is waiting to create or detect the post-call transcription job.",
    error: null
  };
}

async function ensureRemoteMeetingJob(meetingId: string, roomId: string, title: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { transcriptionProvider: true, language: true }
  });
  if (!meeting) return null;

  const existing = await prisma.remoteWorkerJob.findFirst({
    where: {
      sourceType: "MEETING_RECORDING",
      sourceId: meetingId,
      status: { in: ["PENDING", "CLAIMED"] }
    },
    select: { id: true }
  });
  if (existing) return existing.id;

  const response = await fetch(`${getDrVideoBase()}/api/recordings`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return null;
  const recordings = Array.isArray(payload?.items) ? (payload.items as RecordingItem[]) : [];
  const normalizedRoomId = normalizeRoomId(roomId);
  const recording =
    recordings
      .filter((item) => normalizeRoomId(item.roomId) === normalizedRoomId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;
  if (!recording) return null;

  const job = await prisma.remoteWorkerJob.create({
    data: {
      sourceType: "MEETING_RECORDING",
      sourceId: meetingId,
      status: "PENDING",
      provider: meeting.transcriptionProvider === "AUTOREMOTE" ? "AUTOREMOTE" : "WHISPERREMOTE",
      model: "EN_REMOTE_WORKER",
      language: meeting.language === "IT" ? "it" : "en",
      payloadJson: JSON.stringify({
        meetingId,
        title,
        roomId,
        sessionId: recording.sessionId,
        bytes: recording.bytes,
        updatedAt: recording.updatedAt,
        transcriptionProvider: meeting.transcriptionProvider
      })
    },
    select: { id: true }
  });

  return job.id;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      transcript: true,
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" || meeting.members.length > 0 || meeting.createdById === session.user.id;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (meeting.isActive) {
    const reconciled = await reconcileMeetingActiveState(meeting.id, meeting.roomId).catch(() => null);
    if (reconciled?.reconciled) {
      meeting = await prisma.meeting.findUnique({
        where: { id: params.id },
        include: {
          transcript: true,
          members: {
            where: { userId: session.user.id }
          }
        }
      });
      if (!meeting) {
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
      }
    }
  }

  const existingJob = await prisma.transcriptionJob.findFirst({
    where: {
      meetingId: meeting.id,
      kind: "MEETING",
      provider: meeting.transcriptionProvider
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      provider: true,
      lastError: true
    }
  });

  const remoteJob =
    meeting.transcriptionProvider === "WHISPERREMOTE" ||
    meeting.transcriptionProvider === "AUTOREMOTE"
      ? await prisma.remoteWorkerJob.findFirst({
          where: {
            sourceType: "MEETING_RECORDING",
            sourceId: meeting.id
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            provider: true,
            error: true
          }
        })
      : null;

  const status = buildStatusFromState({
    meetingIsActive: meeting.isActive,
    provider: meeting.transcriptionProvider,
    existingJob,
    remoteJob,
    hasTranscript: Boolean(meeting.transcript?.transcriptJson)
  });

  if (meeting.transcript?.transcriptJson) {
    try {
      const cached = JSON.parse(meeting.transcript.transcriptJson);
      return NextResponse.json({
        transcription: cached,
        roundId: meeting.transcript.roundId ?? meeting.transcriptionRoundId,
        provider: meeting.transcript.provider,
        source: "db",
        status
      });
    } catch {
      // invalid cached payload: fall through to not-found
    }
  }

  const requestUrl = new URL(request.url);
  const auto = String(requestUrl.searchParams.get("auto") || "").toLowerCase();
  const autoRequested = auto === "1" || auto === "true" || auto === "yes";
  if (autoRequested) {
    if (meeting.isActive) {
      return NextResponse.json({
        transcription: null,
        roundId: meeting.transcriptionRoundId ?? null,
        provider: null,
        source: "none",
        status: buildStatusFromState({
          meetingIsActive: true,
          provider: meeting.transcriptionProvider,
          existingJob,
          remoteJob,
          hasTranscript: false
        })
      });
    }

    if (meeting.transcriptionProvider === "DEEPGRAM") {
      await importExistingDrVideoTranscriptForMeeting(meeting.id).catch(() => null);
      const refreshedMeeting = await prisma.meeting.findUnique({
        where: { id: meeting.id },
        include: { transcript: true }
      });
      if (refreshedMeeting?.transcript?.transcriptJson) {
        try {
          const cached = JSON.parse(refreshedMeeting.transcript.transcriptJson);
          return NextResponse.json({
            transcription: cached,
            roundId: refreshedMeeting.transcript.roundId ?? refreshedMeeting.transcriptionRoundId,
            provider: refreshedMeeting.transcript.provider,
            source: "db",
            status: {
              stage: "ready",
              label: "Transcript ready",
              detail: "The post-call transcript is available.",
              error: null
            }
          });
        } catch {
          // fall through to provider trigger
        }
      }
    }

    if (meeting.transcriptionProvider === "VOSK" || meeting.transcriptionProvider === "DEEPGRAM") {
      await startPostCallMeetingTranscription(meeting.id, meeting.transcriptionProvider).catch(() => null);
    } else if (
      meeting.transcriptionProvider === "WHISPERREMOTE" ||
      meeting.transcriptionProvider === "AUTOREMOTE"
    ) {
      await ensureRemoteMeetingJob(meeting.id, meeting.roomId, meeting.title).catch(() => null);
    }

    const refreshedMeetingJob = await prisma.transcriptionJob.findFirst({
      where: {
        meetingId: meeting.id,
        kind: "MEETING",
        provider: meeting.transcriptionProvider
      },
      orderBy: { updatedAt: "desc" },
      select: {
        status: true,
        provider: true,
        lastError: true
      }
    });

    const refreshedRemoteJob =
      meeting.transcriptionProvider === "WHISPERREMOTE" ||
      meeting.transcriptionProvider === "AUTOREMOTE"
        ? await prisma.remoteWorkerJob.findFirst({
            where: {
              sourceType: "MEETING_RECORDING",
              sourceId: meeting.id
            },
            orderBy: { updatedAt: "desc" },
            select: {
              status: true,
              provider: true,
              error: true
            }
          })
        : remoteJob;

    return NextResponse.json({
      transcription: null,
      roundId: meeting.transcriptionRoundId ?? null,
      provider: null,
      source: "none",
      status: buildStatusFromState({
        meetingIsActive: meeting.isActive,
        provider: meeting.transcriptionProvider,
        existingJob: refreshedMeetingJob ?? existingJob,
        remoteJob: refreshedRemoteJob,
        hasTranscript: false
      })
    });
  }

  return NextResponse.json(
    {
      error: "Transcription not found in database",
      status
    },
    { status: 404 }
  );
}
