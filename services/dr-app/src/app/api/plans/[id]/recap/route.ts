import { NextResponse } from "next/server";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";
import { prisma } from "@/lib/prisma";
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

async function refreshPlanMeetingTranscripts(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      rounds: {
        include: {
          pairs: {
            select: {
              meetingId: true
            }
          }
        }
      }
    }
  });

  if (!plan) return;

  const meetingIds = Array.from(
    new Set(
      plan.rounds
        .flatMap((round) => round.pairs.map((pair) => pair.meetingId))
        .filter((id): id is string => typeof id === "string")
    )
  );

  if (meetingIds.length === 0) return;

  const meetings = await prisma.meeting.findMany({
    where: { id: { in: meetingIds } },
    select: {
      id: true,
      roomId: true,
      transcriptionProvider: true,
      transcriptionRoundId: true,
      transcript: {
        select: {
          transcriptText: true,
          transcriptJson: true
        }
      }
    }
  });

  for (const meeting of meetings) {
    if (meeting.transcript?.transcriptText || meeting.transcript?.transcriptJson) {
      continue;
    }

    const provider = meeting.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
    const baseUrl =
      provider === "VOSK"
        ? process.env.VOSK_BASE_URL || ""
        : process.env.DEEPGRAM_BASE_URL || "";

    if (!baseUrl) continue;

    let roundId = meeting.transcriptionRoundId;
    if (!roundId) {
      try {
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
      } catch {
        continue;
      }
    }

    if (!roundId) continue;

    try {
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
    } catch {
      continue;
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("refresh") === "1") {
      await refreshPlanMeetingTranscripts(params.id);
    }
    const { recap } = await getPlanRecapData(params.id, viewer);
    return NextResponse.json(recap);
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
