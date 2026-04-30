import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { guessMediaContentType } from "@/lib/meetingMediaUploads";

type RecordingItem = {
  roomId: string;
  sessionId: string;
  filename: string;
  bytes: number;
  updatedAt: string;
  transcriptExists: boolean;
  transcriptUpdatedAt?: string | null;
  transcriptFormat?: string | null;
  mergedFromCount?: number;
};

function getDrVideoBase() {
  return String(process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

function normalizeRoomId(value: string) {
  return String(value || "").trim().toLowerCase();
}

async function canAccessMeeting(meetingId: string, userId: string, role?: string | null) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      members: { where: { userId }, select: { id: true } },
      dataspace: { include: { members: { where: { userId }, select: { id: true } } } }
    }
  });

  if (!meeting) {
    return { ok: false as const, status: 404, error: "Meeting not found" };
  }

  const isAdmin = role === "ADMIN";
  const isMember = meeting.members.length > 0 || meeting.createdById === userId;
  const isDataspaceMember = meeting.dataspace ? meeting.dataspace.members.length > 0 : false;
  const allowed = isAdmin || isMember || (meeting.isPublic && isDataspaceMember);

  if (!allowed) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, meeting };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canAccessMeeting(params.id, session.user.id, session.user.role);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const response = await fetch(`${getDrVideoBase()}/api/recordings`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error ?? "Unable to load meeting files" },
      { status: 502 }
    );
  }

  const items = Array.isArray(payload?.items) ? (payload.items as RecordingItem[]) : [];
  const roomId = normalizeRoomId(access.meeting.roomId);
  const recordingFiles = items
    .filter((item) => normalizeRoomId(item.roomId) === roomId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((item) => ({
      sessionId: item.sessionId,
      filename: item.filename || `${item.sessionId}.webm`,
      bytes: item.bytes,
      updatedAt: item.updatedAt,
      transcriptExists: item.transcriptExists,
      transcriptUpdatedAt: item.transcriptUpdatedAt ?? null,
      kind: item.sessionId.startsWith("peer_")
        ? "peer-recording"
        : item.sessionId.startsWith("rec_")
          ? "room-recording"
          : "recording",
      playbackUrl: `/api/meetings/${params.id}/recordings/file?sessionId=${encodeURIComponent(item.sessionId)}`
    }));

  const uploadedJobs = await prisma.transcriptionJob.findMany({
    where: {
      meetingId: access.meeting.id,
      kind: "MEETING_UPLOAD",
      audioPath: { not: null }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      audioPath: true,
      provider: true,
      status: true,
      updatedAt: true,
      lastError: true,
      roundId: true
    }
  });

  const uploadedFiles = await Promise.all(
    uploadedJobs.map(async (job) => {
      const audioPath = String(job.audioPath || "");
      let stats: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        stats = await fs.stat(audioPath);
      } catch {
        stats = null;
      }
      return {
        sessionId: job.id,
        filename: audioPath.split("/").pop() || `upload-${job.id}`,
        bytes: stats?.size ?? 0,
        updatedAt: (stats?.mtime ?? job.updatedAt).toISOString(),
        transcriptExists: job.status === "DONE",
        transcriptUpdatedAt: job.status === "DONE" ? job.updatedAt.toISOString() : null,
        kind: "uploaded-media",
        provider: job.provider,
        status: job.status,
        contentType: guessMediaContentType(audioPath),
        error: job.lastError ?? null,
        playbackUrl: `/api/meetings/${params.id}/recordings/file?uploadJobId=${encodeURIComponent(job.id)}`
      };
    })
  );

  const files = [...uploadedFiles, ...recordingFiles].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json({
    roomId: access.meeting.roomId,
    normalizedRoomId: roomId,
    files
  });
}
