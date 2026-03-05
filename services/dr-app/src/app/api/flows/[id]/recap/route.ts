import { NextResponse } from "next/server";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";
import { prisma } from "@/lib/prisma";
import { extractTranscriptTextFromTranscription, fetchHubDeliberationByMeetingId } from "@/lib/transcriptionHub";

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

    try {
      const hub = await fetchHubDeliberationByMeetingId(meeting.id);
      if (!hub?.transcription) continue;
      const transcriptText = extractTranscriptTextFromTranscription(hub.transcription);
      await prisma.meetingTranscript.upsert({
        where: { meetingId: meeting.id },
        update: {
          provider: String(hub.provider || "TRANSCRIPTION_HUB"),
          roundId: hub.sessionId,
          transcriptText,
          transcriptJson: JSON.stringify(hub.transcription)
        },
        create: {
          meetingId: meeting.id,
          provider: String(hub.provider || "TRANSCRIPTION_HUB"),
          roundId: hub.sessionId,
          transcriptText,
          transcriptJson: JSON.stringify(hub.transcription)
        }
      });
      if (meeting.transcriptionRoundId !== hub.sessionId) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { transcriptionRoundId: hub.sessionId }
        });
      }
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
