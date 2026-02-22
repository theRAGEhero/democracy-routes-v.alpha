import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fetchRounds, fetchTranscription } from "@/lib/deepgram";
import { getBaseUrlCandidates } from "@/lib/transcription";
import fs from "node:fs/promises";
import path from "node:path";

function normalizeLanguage(code: string) {
  return code === "IT" ? "it" : "en";
}

async function retryMeeting(jobId: string) {
  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    include: { meeting: true }
  });
  if (!job || !job.meeting) return;

  const meeting = job.meeting;
  const provider = meeting.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
  const baseUrl =
    provider === "VOSK" ? process.env.VOSK_BASE_URL || "" : process.env.DEEPGRAM_BASE_URL || "";

  let roundId = meeting.transcriptionRoundId ?? job.roundId ?? null;

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

  if (!roundId) {
    const roundsResponse = await fetchRounds(baseUrl);
    const rounds: Array<{ id?: string; name?: string; created_at?: string; status?: string }> =
      Array.isArray(roundsResponse?.rounds) ? roundsResponse.rounds : [];
    const matches = rounds.filter(
      (round) => typeof round?.name === "string" && round.name.includes(meeting.roomId)
    );
    const sorted = matches.sort((a, b) => {
      const aDate = new Date(a?.created_at ?? 0).getTime();
      const bDate = new Date(b?.created_at ?? 0).getTime();
      return bDate - aDate;
    });
    const preferred = sorted.find((round) => round.status === "completed") ?? sorted[0];
    if (preferred?.id) {
      roundId = preferred.id;
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { transcriptionRoundId: roundId }
      });
    }
  }

  if (!roundId) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: "Transcription not linked" }
    });
    return;
  }

  try {
    await fetchTranscription(baseUrl, roundId);
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "DONE", roundId, lastError: null }
    });
  } catch (error) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Retry failed" }
    });
  }
}

async function retryMeditation(jobId: string) {
  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    include: { plan: true }
  });
  if (!job || !job.plan) return;
  if (!job.audioPath) return;

  const provider =
    job.plan.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
  const baseUrl =
    provider === "VOSK" ? process.env.VOSK_BASE_URL : process.env.DEEPGRAM_BASE_URL;

  if (!baseUrl) return;
  const candidates = getBaseUrlCandidates(baseUrl);
  if (candidates.length === 0) return;

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

  try {
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
        data: { status: "FAILED", lastError: roundPayload?.error ?? "Unable to create transcription round" }
      });
      return;
    }

    const roundId = roundPayload?.round?.id;
    if (!roundId) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "Invalid transcription round" }
      });
      return;
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
        data: { status: "FAILED", lastError: transcriptionPayload?.error ?? "Transcription failed" }
      });
      return;
    }

    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "DONE", roundId, lastError: null }
    });
  } catch (error) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Retry failed" }
    });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const failedJobs = await prisma.transcriptionJob.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "asc" },
    take: 10
  });

  for (const job of failedJobs) {
    if (job.kind === "MEETING") {
      await retryMeeting(job.id);
    }
    if (job.kind === "MEDITATION") {
      await retryMeditation(job.id);
    }
  }

  return NextResponse.json({ retried: failedJobs.length });
}
