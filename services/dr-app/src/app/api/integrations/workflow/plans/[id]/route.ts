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

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      dataspaceId: true,
      startAt: true,
      timezone: true,
      roundsCount: true,
      roundDurationMinutes: true,
      language: true,
      transcriptionProvider: true,
      createdAt: true,
      updatedAt: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        select: {
          roundNumber: true,
          pairs: {
            select: {
              roomId: true,
              userAId: true,
              userBId: true,
              meetingId: true
            }
          }
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: plan.id,
    title: plan.title,
    dataspaceId: plan.dataspaceId,
    startAt: plan.startAt.toISOString(),
    timezone: plan.timezone ?? null,
    roundsCount: plan.roundsCount,
    roundDurationMinutes: plan.roundDurationMinutes,
    language: plan.language,
    transcriptionProvider: plan.transcriptionProvider,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    rounds: plan.rounds.map((round: (typeof plan.rounds)[number]) => ({
      roundNumber: round.roundNumber,
      pairs: round.pairs.map((pair: (typeof round.pairs)[number]) => ({
        roomId: pair.roomId,
        userAId: pair.userAId,
        userBId: pair.userBId,
        meetingId: pair.meetingId
      }))
    }))
  });
}
