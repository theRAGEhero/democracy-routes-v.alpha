import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  getSegmentAtTime,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import { logInfo, logWarn } from "@/lib/logger";
import { normalizeBlockType } from "@/lib/blockType";

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
    select: {
      id: true,
      createdById: true,
      title: true,
      dataspaceId: true,
      startAt: true,
      roundsCount: true,
      roundDurationMinutes: true,
      language: true,
      transcriptionProvider: true,
      meditationEnabled: true,
      meditationAtStart: true,
      meditationBetweenRounds: true,
      meditationAtEnd: true,
      meditationDurationMinutes: true,
      blocks: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          durationSeconds: true,
          roundNumber: true,
          roundMaxParticipants: true,
          posterId: true,
          embedUrl: true,
          harmonicaUrl: true,
          matchingMode: true
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && plan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = normalizeBlockType(block.type) as PlanBlockType | null;
      if (!type || !["START", "PARTICIPANTS", "DISCUSSION", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "GROUPING", "BREAK", "HARMONICA", "DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(type)) {
        return acc;
      }
      acc.push({
        id: block.id,
        type,
        durationSeconds: block.durationSeconds,
        roundNumber: block.roundNumber ?? null,
        roundMaxParticipants: block.roundMaxParticipants ?? null,
        posterId: block.posterId ?? null,
        embedUrl: block.embedUrl ?? null,
        harmonicaUrl: block.harmonicaUrl ?? null,
        matchingMode: normalizeMatchingMode(block.matchingMode)
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

  const nowMs = Date.now();
  const elapsed = nowMs - plan.startAt.getTime();
  if (elapsed < 0 || nowMs >= schedule.totalEndMs) {
    logWarn("flow_skip_rejected", {
      planId: plan.id,
      planTitle: plan.title,
      actorId: session.user.id,
      dataspaceId: plan.dataspaceId ?? null,
      reason: "not_active",
      elapsedMs: elapsed,
      totalEndMs: schedule.totalEndMs,
      nowMs
    });
    return NextResponse.json({ error: "Template is not active." }, { status: 400 });
  }

  const currentSegment = getSegmentAtTime(schedule.segments, nowMs);
  if (!currentSegment?.endAtMs) {
    logWarn("flow_skip_rejected", {
      planId: plan.id,
      planTitle: plan.title,
      actorId: session.user.id,
      dataspaceId: plan.dataspaceId ?? null,
      reason: "no_active_segment",
      nowMs
    });
    return NextResponse.json({ error: "No active segment." }, { status: 400 });
  }

  const remainingMs = Math.max(0, currentSegment.endAtMs - nowMs);
  if (remainingMs === 0) {
    logInfo("flow_skip_noop", {
      planId: plan.id,
      planTitle: plan.title,
      actorId: session.user.id,
      dataspaceId: plan.dataspaceId ?? null,
      skippedType: currentSegment.type,
      blockId: currentSegment.blockId ?? null
    });
    return NextResponse.json({ status: "noop" });
  }

  const deltaMs = Math.max(remainingMs, 1000);
  const newStartAt = new Date(plan.startAt.getTime() - deltaMs);

  await prisma.plan.update({
    where: { id: plan.id },
    data: { startAt: newStartAt }
  });

  logInfo("flow_skip_completed", {
    planId: plan.id,
    planTitle: plan.title,
    actorId: session.user.id,
    dataspaceId: plan.dataspaceId ?? null,
    skippedType: currentSegment.type,
    blockId: currentSegment.blockId ?? null,
    remainingMs,
    previousStartAt: plan.startAt.toISOString(),
    newStartAt: newStartAt.toISOString()
  });

  return NextResponse.json({
    status: "skipped",
    skippedType: currentSegment.type,
    newStartAt: newStartAt.toISOString()
  });
}
