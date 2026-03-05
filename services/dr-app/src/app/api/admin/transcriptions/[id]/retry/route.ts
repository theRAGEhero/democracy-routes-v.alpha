import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { extractTranscriptTextFromTranscription, fetchHubDeliberationByMeetingId } from "@/lib/transcriptionHub";
import { getBaseUrlCandidates } from "@/lib/transcription";
import fs from "node:fs/promises";
import path from "node:path";

function normalizeLanguage(code: string) {
  return code === "IT" ? "it" : "en";
}

async function retryMeeting(jobId: string) {
  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    include: {
      meeting: true
    }
  });
  if (!job || !job.meeting) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const meeting = job.meeting;
  try {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        provider: "TRANSCRIPTION_HUB",
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: null
      }
    });

    const hub = await fetchHubDeliberationByMeetingId(meeting.id);
    if (!hub?.transcription) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: { status: "FAILED", provider: "TRANSCRIPTION_HUB", lastError: "Transcription not found in transcription-hub" }
      });
      return NextResponse.json({ error: "Transcription not found in transcription-hub" }, { status: 404 });
    }

    const provider = String(hub.provider || "TRANSCRIPTION_HUB");
    const roundId = hub.sessionId;
    const transcriptText = extractTranscriptTextFromTranscription(hub.transcription);
    await prisma.meetingTranscript.upsert({
      where: { meetingId: meeting.id },
      update: {
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(hub.transcription)
      },
      create: {
        meetingId: meeting.id,
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(hub.transcription)
      }
    });
    if (meeting.transcriptionRoundId !== roundId) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { transcriptionRoundId: roundId }
      });
    }

    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "DONE", provider, roundId, lastError: null }
    });
    return NextResponse.json({ status: "DONE" });
  } catch (error) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        provider: "TRANSCRIPTION_HUB",
        lastError: error instanceof Error ? error.message : "Retry failed"
      }
    });
    return NextResponse.json({ error: "Retry failed" }, { status: 502 });
  }
}

async function retryMeditation(jobId: string) {
  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    include: { plan: true, user: true }
  });
  if (!job || !job.plan) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!job.audioPath) {
    return NextResponse.json({ error: "Audio file missing" }, { status: 400 });
  }

  const provider =
    job.plan.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
  const baseUrl =
    provider === "VOSK" ? process.env.VOSK_BASE_URL : process.env.DEEPGRAM_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json({ error: "Transcription service is not configured" }, { status: 500 });
  }

  const candidates = getBaseUrlCandidates(baseUrl);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Transcription service is not configured" }, { status: 500 });
  }

  try {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        provider,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: null
      }
    });

    const createRoundResponse = await fetch(`${candidates[0]}/api/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${job.plan.title} - Meditation ${job.meditationIndex ?? 0}`,
        description: `Meditation Round ${job.meditationIndex ?? 0}`,
        language: normalizeLanguage(job.plan.language)
      })
    });
    const roundPayload = await createRoundResponse.json().catch(() => null);
    if (!createRoundResponse.ok) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: roundPayload?.error ?? "Unable to create transcription round"
        }
      });
      return NextResponse.json({ error: "Unable to create transcription round" }, { status: 502 });
    }

    const roundId = roundPayload?.round?.id;
    if (!roundId) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "Invalid transcription round" }
      });
      return NextResponse.json({ error: "Invalid transcription round" }, { status: 502 });
    }

    const buffer = await fs.readFile(job.audioPath);
    const blob = new Blob([buffer], { type: "audio/webm" });
    const form = new FormData();
    const filename = path.basename(job.audioPath);
    form.append("audio", blob, filename);
    form.append("roundId", roundId);
    form.append("filename", filename);

    const transcriptionResponse = await fetch(`${candidates[0]}/api/transcribe`, {
      method: "POST",
      body: form
    });
    const transcriptionPayload = await transcriptionResponse.json().catch(() => null);
    if (!transcriptionResponse.ok) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: transcriptionPayload?.error ?? "Transcription failed"
        }
      });
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        roundId,
        lastError: null
      }
    });

    return NextResponse.json({ status: "DONE" });
  } catch (error) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Retry failed" }
    });
    return NextResponse.json({ error: "Retry failed" }, { status: 502 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await prisma.transcriptionJob.findUnique({
    where: { id: params.id },
    select: { kind: true }
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.kind === "MEETING") {
    return retryMeeting(params.id);
  }
  if (job.kind === "PAUSE") {
    return retryMeditation(params.id);
  }

  return NextResponse.json({ error: "Unsupported job type" }, { status: 400 });
}
