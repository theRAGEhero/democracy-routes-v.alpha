import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fetchRounds, fetchTranscription } from "@/lib/deepgram";

function extractTranscriptText(transcription: any) {
  const fromTopLevel = transcription?.contributions;
  const fromDeliberation = transcription?.deliberation?.contributions;
  const contributions = Array.isArray(fromTopLevel)
    ? fromTopLevel
    : Array.isArray(fromDeliberation)
      ? fromDeliberation
      : [];
  return contributions
    .map((entry: any) => entry?.text)
    .filter((text: any) => typeof text === "string")
    .join(" ");
}

async function pushTranscriptionPayload(options: {
  groupId: string | null;
  externalId: string;
  transcription: unknown;
}) {
  const ingestBaseUrl = process.env.TRANSCRIPT_INGEST_URL;
  if (!ingestBaseUrl) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.groupId) {
    headers["x-group-id"] = options.groupId;
  }

  try {
    await fetch(`${ingestBaseUrl}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        external_id: options.externalId,
        group_id: options.groupId ?? undefined,
        payload: options.transcription
      })
    });
  } catch (error) {
    console.error("Transcript ingest push failed", error);
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
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

  const url = new URL(request.url);
  const auto = url.searchParams.get("auto") === "1";
  let roundId = meeting.transcriptionRoundId;
  const provider = meeting.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
  const baseUrl =
    provider === "VOSK"
      ? process.env.VOSK_BASE_URL || ""
      : process.env.DEEPGRAM_BASE_URL || "";
  const now = new Date();
  const existingJob = await prisma.transcriptionJob.findFirst({
    where: { meetingId: meeting.id, kind: "MEETING" }
  });

  if (meeting.transcript?.transcriptJson) {
    try {
      const cached = JSON.parse(meeting.transcript.transcriptJson);
      return NextResponse.json({
        transcription: cached,
        roundId: meeting.transcript.roundId ?? roundId,
        provider: meeting.transcript.provider,
        source: "db"
      });
    } catch {
      // fall back to refetch
    }
  }

  if (!roundId && auto) {
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
    if (existingJob) {
      await prisma.transcriptionJob.update({
        where: { id: existingJob.id },
        data: {
          status: "FAILED",
          provider,
          roundId: null,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          lastError: "Transcription not linked"
        }
      });
    } else {
      await prisma.transcriptionJob.create({
        data: {
          kind: "MEETING",
          status: "FAILED",
          provider,
          meetingId: meeting.id,
          userId: session.user.id,
          roundId: null,
          attempts: 1,
          lastAttemptAt: now,
          lastError: "Transcription not linked"
        }
      });
    }
    return NextResponse.json({ error: "Transcription not linked" }, { status: 404 });
  }

  try {
    if (existingJob) {
      await prisma.transcriptionJob.update({
        where: { id: existingJob.id },
        data: {
          status: "RUNNING",
          provider,
          roundId,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          lastError: null
        }
      });
    } else {
      await prisma.transcriptionJob.create({
        data: {
          kind: "MEETING",
          status: "RUNNING",
          provider,
          meetingId: meeting.id,
          userId: session.user.id,
          roundId,
          attempts: 1,
          lastAttemptAt: now
        }
      });
    }
    const transcription = await fetchTranscription(baseUrl, roundId);
    const transcriptText = extractTranscriptText(transcription);
    await prisma.meetingTranscript.upsert({
      where: { meetingId: meeting.id },
      update: {
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(transcription)
      },
      create: {
        meetingId: meeting.id,
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(transcription)
      }
    });
    void pushTranscriptionPayload({
      groupId: meeting.dataspaceId ?? null,
      externalId: roundId,
      transcription
    });
    await prisma.transcriptionJob.updateMany({
      where: { meetingId: meeting.id, kind: "MEETING" },
      data: {
        status: "DONE",
        lastError: null,
        provider,
        roundId
      }
    });
    return NextResponse.json({ transcription, roundId, provider, source: "remote" });
  } catch (error) {
    await prisma.transcriptionJob.updateMany({
      where: { meetingId: meeting.id, kind: "MEETING" },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message : "Unable to fetch transcription",
        provider,
        roundId
      }
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch transcription" },
      { status: 502 }
    );
  }
}
