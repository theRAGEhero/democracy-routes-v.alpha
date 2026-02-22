import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  buildPlanSegmentsFromBlocks,
  buildLegacySegments,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, type: true, durationSeconds: true, roundNumber: true, posterId: true }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && plan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = block.type as PlanBlockType;
      if (!["ROUND", "MEDITATION", "POSTER", "TEXT", "RECORD", "FORM"].includes(type)) {
        return acc;
      }
      acc.push({
        id: block.id,
        type,
        durationSeconds: block.durationSeconds,
        roundNumber: block.roundNumber ?? null,
        posterId: block.posterId ?? null
      });
      return acc;
    },
    []
  );
  const schedule =
    normalizedBlocks.length > 0
      ? buildPlanSegmentsFromBlocks(plan.startAt, normalizedBlocks)
      : buildLegacySegments({
          startAt: plan.startAt,
          roundsCount: plan.roundsCount,
          roundDurationMinutes: plan.roundDurationMinutes,
          meditationEnabled: plan.meditationEnabled,
          meditationAtStart: plan.meditationAtStart,
          meditationBetweenRounds: plan.meditationBetweenRounds,
          meditationAtEnd: plan.meditationAtEnd,
          meditationDurationMinutes: plan.meditationDurationMinutes
        });
  const { totalEndMs } = schedule;

  if (Date.now() > totalEndMs) {
    return NextResponse.json({ error: "Plan already concluded." }, { status: 400 });
  }

  const now = new Date();
  if (plan.startAt.getTime() <= now.getTime()) {
    return NextResponse.json({ startAt: plan.startAt.toISOString(), updated: false });
  }

  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: { startAt: now },
    select: { startAt: true }
  });

  return NextResponse.json({ startAt: updated.startAt.toISOString(), updated: true });
}
