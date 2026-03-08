import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";

type RecordingItem = {
  roomId: string;
  sessionId: string;
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

async function fetchRecordings() {
  const response = await fetch(`${getDrVideoBase()}/api/recordings`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to load dr-video recordings");
  }
  return Array.isArray(payload?.items) ? (payload.items as RecordingItem[]) : [];
}

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const recordings = await fetchRecordings();
    const endedEnglishMeetings = await prisma.meeting.findMany({
      where: {
        isHidden: false,
        language: { in: ["EN", "en"] },
        transcriptionProvider: { in: ["WHISPERREMOTE", "AUTOREMOTE"] },
        transcript: null
      },
      select: {
        id: true,
        title: true,
        roomId: true,
        transcriptionProvider: true
      }
    });

    const meetingsByRoom = new Map(
      endedEnglishMeetings.map((meeting) => [normalizeRoomId(meeting.roomId), meeting])
    );
    const existingJobs = await prisma.remoteWorkerJob.findMany({
      where: {
        sourceType: "MEETING_RECORDING",
        sourceId: {
          in: endedEnglishMeetings.map((meeting) => meeting.id)
        }
      },
      select: {
        sourceId: true,
        payloadJson: true
      }
    });

    const existingKeys = new Set(
      existingJobs.map((job) => {
        let sessionId = "";
        try {
          sessionId = String(JSON.parse(job.payloadJson || "{}")?.sessionId || "");
        } catch {
          sessionId = "";
        }
        return `${job.sourceId || ""}:${sessionId}`;
      })
    );

    const candidates = recordings
      .filter((item) => Boolean(meetingsByRoom.get(normalizeRoomId(item.roomId))))
      .filter((item) => !item.transcriptExists)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const created = [];
    for (const item of candidates) {
      const meeting = meetingsByRoom.get(normalizeRoomId(item.roomId));
      if (!meeting) continue;
      const dedupeKey = `${meeting.id}:${item.sessionId}`;
      if (existingKeys.has(dedupeKey)) continue;

      const job = await prisma.remoteWorkerJob.create({
        data: {
          sourceType: "MEETING_RECORDING",
          sourceId: meeting.id,
          status: "PENDING",
          provider: "WHISPERREMOTE",
          model: "EN_REMOTE_WORKER",
          language: "en",
          payloadJson: JSON.stringify({
            meetingId: meeting.id,
            title: meeting.title,
            roomId: item.roomId,
            sessionId: item.sessionId,
            bytes: item.bytes,
            updatedAt: item.updatedAt,
            transcriptionProvider: meeting.transcriptionProvider
          })
        },
        select: {
          id: true,
          sourceId: true
        }
      });
      created.push(job);
      existingKeys.add(dedupeKey);
    }

    await postEventHubEvent({
      source: "dr-app",
      type: "remote_worker_meeting_jobs_enqueued",
      severity: "info",
      message: "English meeting recording jobs enqueued",
      actorId: session.user.id,
      payload: {
        created: created.length
      }
    });

    return NextResponse.json({
      ok: true,
      createdCount: created.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to queue meeting jobs" },
      { status: 500 }
    );
  }
}
