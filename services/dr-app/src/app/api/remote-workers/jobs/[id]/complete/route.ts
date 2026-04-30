import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";
import { ingestMeetingTranscriptToHub } from "@/lib/transcriptionHubIngest";
import { ensureMeetingAiSummary } from "@/lib/meetingAiSummary";
import { mergeTranscriptContext } from "@/lib/meetingTranscriptContext";

function safeStringify(value: unknown) {
  try {
    if (value == null) return null;
    const text = JSON.stringify(value);
    return text.length > 12000 ? `${text.slice(0, 12000)}...` : text;
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";
  const transcriptText =
    typeof body?.transcriptText === "string" ? body.transcriptText.trim() : null;
  if (!workerId) {
    return NextResponse.json({ error: "workerId is required" }, { status: 400 });
  }

  const worker = await prisma.remoteWorker.findFirst({
    where: {
      id: workerId,
      userId: payload.uid
    },
    select: { id: true }
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.remoteWorkerJob.findFirst({
      where: {
        id: params.id,
        claimedByWorkerId: workerId
      }
    });

    if (!job) {
      return null;
    }

    const updatedJob = await tx.remoteWorkerJob.update({
      where: { id: params.id },
      data: {
        status: "DONE",
        completedAt: new Date(),
        error: null
      }
    });

    const createdResult = await tx.remoteWorkerResult.create({
      data: {
        jobId: params.id,
        workerId,
        transcriptText,
        transcriptJson: safeStringify(body?.transcriptJson),
        confidence: typeof body?.confidence === "number" ? body.confidence : null,
        durationMs: typeof body?.durationMs === "number" ? Math.max(0, Math.floor(body.durationMs)) : null
      }
    });

    const parsedPayload = (() => {
      try {
        return JSON.parse(job.payloadJson || "{}") as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();
    const transcriptionJobId =
      typeof parsedPayload.transcriptionJobId === "string" ? parsedPayload.transcriptionJobId : null;

    let meeting = null;
    if ((job.sourceType === "MEETING_RECORDING" || job.sourceType === "MEETING_UPLOAD") && job.sourceId) {
      meeting = await tx.meeting.findUnique({
        where: { id: job.sourceId },
        select: {
          id: true,
          roomId: true,
          language: true
        }
      });
    }

    if ((job.sourceType === "MEETING_RECORDING" || job.sourceType === "MEETING_UPLOAD") && job.sourceId && transcriptText) {
      const existingTranscript = await tx.meetingTranscript.findUnique({
        where: { meetingId: job.sourceId },
        select: { transcriptJson: true }
      });
      const mergedTranscriptJson = JSON.stringify(
        mergeTranscriptContext(existingTranscript?.transcriptJson, body?.transcriptJson)
      );
      await tx.meetingTranscript.upsert({
        where: { meetingId: job.sourceId },
        update: {
          provider: job.provider || "REMOTE_WORKER",
          transcriptText,
          transcriptJson: mergedTranscriptJson
        },
        create: {
          meetingId: job.sourceId,
          provider: job.provider || "REMOTE_WORKER",
          transcriptText,
          transcriptJson: mergedTranscriptJson
        }
      });
    }

    if (job.sourceType === "MEETING_UPLOAD" && transcriptionJobId) {
      await tx.transcriptionJob.update({
        where: { id: transcriptionJobId },
        data: {
          status: "DONE",
          roundId: params.id,
          lastError: null,
          lastAttemptAt: new Date()
        }
      });
    }

    await tx.remoteWorker.update({
      where: { id: workerId },
      data: {
        lastSeenAt: new Date(),
        status: "READY"
      }
    });

    return { job: updatedJob, result: createdResult, meeting, sourceId: job.sourceId, payloadJson: job.payloadJson };
  });

  if (!result) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (
    result.sourceId &&
    result.meeting &&
    transcriptText
  ) {
    let sessionId = params.id;
    let recordingUpdatedAt: string | null = null;
    try {
      const parsed = JSON.parse(result.payloadJson || "{}");
      sessionId = String(parsed?.sessionId || params.id);
      recordingUpdatedAt = typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null;
    } catch {}

    const transcriptProvider =
      result.job.provider === "AUTOREMOTE" ? "AUTOREMOTE" : result.job.provider || "WHISPERREMOTE";

    const hubResult = await ingestMeetingTranscriptToHub({
      meetingId: result.meeting.id,
      roomId: result.meeting.roomId,
      sessionId,
      provider: transcriptProvider,
      language: result.meeting.language || null,
      transcriptText,
      transcriptJson: body?.transcriptJson,
      startedAt: recordingUpdatedAt,
      endedAt: new Date().toISOString(),
      metadata: {
        workerId,
        sourceType: result.job.sourceType
      }
    });

    if (hubResult.ok) {
      await prisma.meeting.update({
        where: { id: result.meeting.id },
        data: { transcriptionRoundId: sessionId }
      });
    } else {
      await postEventHubEvent({
        source: "dr-app",
        type: "remote_worker_hub_mirror_failed",
        severity: "warn",
        message: "Remote worker transcript could not be mirrored to transcription-hub",
        actorId: payload.uid,
        meetingId: result.meeting.id,
        payload: {
          workerId,
          jobId: params.id,
          sessionId,
          reason: hubResult.reason,
          status: "status" in hubResult ? hubResult.status : null
        }
      });
    }
  }

  await postEventHubEvent({
    source: "dr-app",
    type: "remote_worker_job_completed",
    severity: "info",
    message: "Remote worker completed a job",
    actorId: payload.uid,
    payload: {
      workerId,
      jobId: params.id
    }
  });

  if (result.sourceId && result.meeting && transcriptText) {
    await ensureMeetingAiSummary(result.meeting.id).catch(() => null);
  }

  return NextResponse.json({ ok: true, job: result.job, result: result.result });
}
