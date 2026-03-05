import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import { getBaseUrlCandidates } from "@/lib/transcription";
import fs from "node:fs/promises";
import path from "node:path";

function normalizeLanguage(code: string) {
  return code === "IT" ? "it" : "en";
}

function extractTranscriptText(deliberation: any) {
  const contributions = deliberation?.contributions;
  if (!Array.isArray(contributions)) return "";
  return contributions
    .map((entry) => entry?.text)
    .filter((text) => typeof text === "string")
    .join(" ");
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const plan = isAdmin
    ? await prisma.plan.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          title: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true
        }
      })
    : await prisma.plan.findFirst({
        where: {
          id: params.id,
          OR: [
            {
              rounds: {
                some: {
                  pairs: {
                    some: {
                      OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
                    }
                  }
                }
              }
            },
            {
              participants: { some: { userId: viewer.user.id, status: "APPROVED" } }
            }
          ]
        },
        select: {
          id: true,
          title: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true
        }
      });
  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (!plan.meditationEnabled) {
    return NextResponse.json({ error: "Meditation is not enabled" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return NextResponse.json({ error: "Invalid audio upload" }, { status: 400 });
  }
  const audio = formData.get("audio") as File | null;
  const meditationIndex = Number(formData.get("meditationIndex"));
  const roundAfter = Number(formData.get("roundAfter") ?? "");

  if (!audio) {
    return NextResponse.json({ error: "Audio is required" }, { status: 400 });
  }
  if (!Number.isFinite(meditationIndex)) {
    return NextResponse.json({ error: "Meditation index is required" }, { status: 400 });
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const uploadsDir = path.join(process.cwd(), "data", "meditation-audio", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const safeName = `${plan.id}-${viewer.user.id}-${Date.now()}-${audio.name || `meditation-${meditationIndex}.webm`}`;
  const audioPath = path.join(uploadsDir, safeName);
  await fs.writeFile(audioPath, audioBuffer);

  const job = await prisma.transcriptionJob.create({
    data: {
      kind: "PAUSE",
      status: "RUNNING",
      provider: plan.transcriptionProvider,
      planId: plan.id,
      userId: viewer.user.id,
      meditationIndex,
      attempts: 1,
      lastAttemptAt: new Date(),
      audioPath
    }
  });

  const baseUrl =
    plan.transcriptionProvider === "VOSK"
      ? process.env.VOSK_BASE_URL
      : process.env.DEEPGRAM_BASE_URL;

  if (!baseUrl) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: "Transcription service is not configured" }
    });
    return NextResponse.json({ error: "Transcription service is not configured" }, { status: 500 });
  }

  const candidates = getBaseUrlCandidates(baseUrl);
  if (candidates.length === 0) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: "Transcription service is not configured" }
    });
    return NextResponse.json({ error: "Transcription service is not configured" }, { status: 500 });
  }

  let createRoundResponse: Response | null = null;
  let createRoundError: unknown = null;
  for (const candidate of candidates) {
    try {
      createRoundResponse = await fetch(`${candidate}/api/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${plan.title} - Meditation ${meditationIndex}`,
          description: `Meditation Round ${meditationIndex}`,
          language: normalizeLanguage(plan.language)
        })
      });
      break;
    } catch (error) {
      createRoundError = error;
    }
  }

  if (!createRoundResponse) {
    const message = createRoundError instanceof Error ? createRoundError.message : "Unable to reach transcription service";
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: message }
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const roundPayload = await createRoundResponse.json().catch(() => null);
  if (!createRoundResponse.ok) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: roundPayload?.error ?? "Unable to create transcription round" }
    });
    return NextResponse.json(
      { error: roundPayload?.error ?? "Unable to create transcription round" },
      { status: 502 }
    );
  }

  const roundId = roundPayload?.round?.id;
  if (!roundId) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: "Invalid transcription round" }
    });
    return NextResponse.json({ error: "Invalid transcription round" }, { status: 502 });
  }

  const audioForm = new FormData();
  audioForm.append("audio", audio);
  audioForm.append("roundId", roundId);
  audioForm.append("filename", audio.name || `meditation-${meditationIndex}.webm`);

  let transcriptionResponse: Response | null = null;
  let transcriptionError: unknown = null;
  for (const candidate of candidates) {
    try {
      transcriptionResponse = await fetch(`${candidate}/api/transcribe`, {
        method: "POST",
        body: audioForm
      });
      break;
    } catch (error) {
      transcriptionError = error;
    }
  }

  if (!transcriptionResponse) {
    const message =
      transcriptionError instanceof Error ? transcriptionError.message : "Unable to reach transcription service";
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: message, roundId }
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const transcriptionPayload = await transcriptionResponse.json().catch(() => null);
  if (!transcriptionResponse.ok) {
    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: transcriptionPayload?.error ?? "Transcription failed", roundId }
    });
    return NextResponse.json(
      { error: transcriptionPayload?.error ?? "Transcription failed" },
      { status: 502 }
    );
  }

  const transcriptText = extractTranscriptText(transcriptionPayload?.deliberation);

  const sessionRecord = await prisma.planMeditationSession.create({
    data: {
      planId: plan.id,
      userId: viewer.user.id,
      meditationIndex,
      roundAfter: Number.isFinite(roundAfter) ? roundAfter : null,
      provider: plan.transcriptionProvider,
      language: plan.language,
      roundId,
      transcriptText,
      transcriptJson: transcriptionPayload?.deliberation
        ? JSON.stringify(transcriptionPayload.deliberation)
        : null
    }
  });

  await prisma.transcriptionJob.update({
    where: { id: job.id },
    data: { status: "DONE", roundId, lastError: null }
  });

  return NextResponse.json({
    id: sessionRecord.id,
    meditationIndex: sessionRecord.meditationIndex,
    roundAfter: sessionRecord.roundAfter,
    transcriptText: sessionRecord.transcriptText
  });
}
