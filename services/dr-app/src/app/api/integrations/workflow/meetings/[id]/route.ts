import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      roomId: true,
      dataspaceId: true,
      createdAt: true,
      scheduledStartAt: true,
      expiresAt: true,
      timezone: true,
      language: true,
      transcriptionProvider: true,
      transcriptionRoundId: true,
      transcript: {
        select: {
          provider: true,
          roundId: true,
          transcriptText: true
        }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: meeting.id,
    title: meeting.title,
    roomId: meeting.roomId,
    dataspaceId: meeting.dataspaceId,
    createdAt: meeting.createdAt.toISOString(),
    scheduledStartAt: meeting.scheduledStartAt ? meeting.scheduledStartAt.toISOString() : null,
    expiresAt: meeting.expiresAt ? meeting.expiresAt.toISOString() : null,
    timezone: meeting.timezone ?? null,
    language: meeting.language,
    transcriptionProvider: meeting.transcriptionProvider,
    transcriptionRoundId: meeting.transcriptionRoundId,
    meetingTranscript: meeting.transcript
      ? {
          provider: meeting.transcript.provider,
          roundId: meeting.transcript.roundId,
          transcriptText: meeting.transcript.transcriptText
        }
      : null
  });
}
