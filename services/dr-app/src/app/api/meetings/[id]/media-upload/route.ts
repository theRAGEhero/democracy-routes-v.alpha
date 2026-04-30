import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  buildStoredMeetingMediaFilename,
  getMeetingMediaUploadsDir,
  guessMediaContentType,
  isAllowedMeetingMediaFile
} from "@/lib/meetingMediaUploads";
import { startUploadedMeetingMediaTranscription } from "@/lib/meetingTranscription";

export const runtime = "nodejs";

const MAX_MEDIA_BYTES = 1024 * 1024 * 1024;

async function canAccessMeeting(meetingId: string, userId: string, role?: string | null) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      members: { where: { userId }, select: { id: true, role: true } }
    }
  });

  if (!meeting) {
    return { ok: false as const, status: 404, error: "Meeting not found" };
  }

  const isAdmin = role === "ADMIN";
  const isMember = meeting.members.length > 0 || meeting.createdById === userId;
  if (!isAdmin && !isMember) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, meeting };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canAccessMeeting(params.id, session.user.id, session.user.role);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const providerRaw = String(formData?.get("provider") || "").trim().toUpperCase();
  const provider =
    providerRaw === "DEEPGRAM" ||
    providerRaw === "VOSK" ||
    providerRaw === "WHISPERREMOTE" ||
    providerRaw === "AUTOREMOTE"
      ? providerRaw
      : null;

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Media file is required" }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: "A transcription method is required" }, { status: 400 });
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: "Media file too large. Limit is 1 GB." }, { status: 400 });
  }
  if (!isAllowedMeetingMediaFile(file.name)) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
  }

  const dir = getMeetingMediaUploadsDir(access.meeting.id);
  await fs.mkdir(dir, { recursive: true });

  const storedFilename = buildStoredMeetingMediaFilename(file.name);
  const fullPath = path.join(dir, storedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  let transcriptionJobId: string | null = null;
  let remoteWorkerJobId: string | null = null;

  if (provider === "DEEPGRAM" || provider === "VOSK") {
    const started = await startUploadedMeetingMediaTranscription(access.meeting.id, provider, fullPath);
    transcriptionJobId = started.jobId ?? null;
  } else {
    const job = await prisma.transcriptionJob.create({
      data: {
        kind: "MEETING_UPLOAD",
        status: "PENDING",
        provider,
        meetingId: access.meeting.id,
        audioPath: fullPath,
        lastError: "Waiting for remote worker"
      }
    });
    transcriptionJobId = job.id;

    const remoteJob = await prisma.remoteWorkerJob.create({
      data: {
        sourceType: "MEETING_UPLOAD",
        sourceId: access.meeting.id,
        status: "PENDING",
        provider,
        model: "EN_REMOTE_WORKER",
        language: access.meeting.language === "IT" ? "it" : "en",
        audioUrl: `/api/meetings/${access.meeting.id}/recordings/file?uploadJobId=${encodeURIComponent(job.id)}`,
        payloadJson: JSON.stringify({
          transcriptionJobId: job.id,
          filename: storedFilename,
          updatedAt: new Date().toISOString(),
          contentType: guessMediaContentType(storedFilename)
        })
      }
    });
    remoteWorkerJobId = remoteJob.id;
  }

  return NextResponse.json({
    ok: true,
    file: {
      filename: storedFilename,
      bytes: file.size,
      contentType: guessMediaContentType(storedFilename)
    },
    transcriptionJobId,
    remoteWorkerJobId
  });
}
