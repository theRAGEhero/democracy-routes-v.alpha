import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";
import { buildPlanSegmentsFromBlocks, buildLegacySegments, type PlanBlockInput, type PlanBlockType } from "@/lib/planSchedule";
import crypto from "crypto";

function generateRoomId(language: string, transcriptionProvider: string) {
  const providerLabel =
    transcriptionProvider === "VOSK"
      ? "VOSK"
      : transcriptionProvider === "DEEPGRAMLIVE"
        ? "DEEPGRAMLIVE"
        : "DEEPGRAM";
  const base = crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
  return `${base}-${language}-${providerLabel}`;
}

const requestSchema = z.object({
  mode: z.enum(["polar", "anti"]).default("polar")
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      createdById: true,
      maxParticipantsPerRoom: true,
      roundsCount: true,
      roundDurationMinutes: true,
      title: true,
      startAt: true,
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
          orderIndex: true,
          type: true,
          durationSeconds: true,
          roundNumber: true,
          roundMaxParticipants: true,
          posterId: true,
          embedUrl: true,
          harmonicaUrl: true
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const isOwner = plan.createdById === viewer.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let planRecap;
  try {
    planRecap = await getPlanRecapData(params.id, viewer);
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const baseUrl = process.env.DR_MATCHING_BASE_URL || "http://dr-matching:3002";
  const apiKey = process.env.DR_MATCHING_API_KEY;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({
      plan: {
        id: plan.id,
        title: plan.title,
        maxParticipantsPerRoom: plan.maxParticipantsPerRoom ?? 2,
        roundsCount: plan.roundsCount,
        roundDurationMinutes: plan.roundDurationMinutes
      },
      recap: planRecap.recap,
      mode: parsed.data.mode,
      groupSize: plan.maxParticipantsPerRoom ?? 2
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Failed to run matching", details: errorData },
      { status: response.status }
    );
  }

  const payload = await response.json();

  let appliedRoundNumber: number | null = null;
  let appliedRoomIds: string[] = [];

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = block.type as PlanBlockType;
      if (!["START", "PARTICIPANTS", "PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING", "BREAK", "HARMONICA", "DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(type)) {
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
        harmonicaUrl: block.harmonicaUrl ?? null
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
  const currentSegment = schedule.segments.find(
    (segment) => segment.startAtMs <= nowMs && nowMs < segment.endAtMs
  );
  const canApply = currentSegment?.type === "MATCHING" && currentSegment.blockId;

  if (canApply && Array.isArray(payload?.rooms)) {
    const blocksById = new Map(plan.blocks.map((block) => [block.id, block]));
    const currentBlock = blocksById.get(currentSegment.blockId as string);
    let nextRoundNumber: number | null = null;
    if (currentBlock) {
      const nextRound = plan.blocks
        .filter((block) => block.orderIndex > currentBlock.orderIndex)
        .find((block) => block.type === "PAIRING" && block.roundNumber);
      nextRoundNumber = nextRound?.roundNumber ?? null;
    }

    if (nextRoundNumber) {
      const participantEmails = new Set<string>();
      payload.rooms.forEach((room: { participants?: string[] }) => {
        (room.participants || []).forEach((email) => participantEmails.add(String(email).toLowerCase()));
      });
      const users = await prisma.user.findMany({
        where: { email: { in: Array.from(participantEmails) } },
        select: { id: true, email: true }
      });
      const userIdByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));

      const newPairs: Array<{ userAId: string; userBId: string | null; roomId: string }> = [];
      const roomIds: string[] = [];
      payload.rooms.forEach((room: { participants?: string[] }) => {
        const participants = (room.participants || [])
          .map((email) => userIdByEmail.get(String(email).toLowerCase()) || null)
          .filter((id): id is string => Boolean(id));
        if (participants.length === 0) return;
        const roomId = generateRoomId(plan.language, plan.transcriptionProvider);
        roomIds.push(roomId);
        for (let i = 0; i < participants.length; i += 2) {
          const userAId = participants[i];
          const userBId = participants[i + 1] ?? null;
          if (!userAId) continue;
          newPairs.push({ userAId, userBId, roomId });
        }
      });

      if (newPairs.length > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.planPair.deleteMany({
            where: { planRound: { planId: plan.id, roundNumber: nextRoundNumber } }
          });
          const round = await tx.planRound.findUnique({
            where: { planId_roundNumber: { planId: plan.id, roundNumber: nextRoundNumber } },
            select: { id: true }
          });
          if (!round) return;
          await tx.planPair.createMany({
            data: newPairs.map((pair) => ({
              planRoundId: round.id,
              roomId: pair.roomId,
              userAId: pair.userAId,
              userBId: pair.userBId
            }))
          });
        });
        appliedRoundNumber = nextRoundNumber;
        appliedRoomIds = roomIds;
      }
    }
  }

  try {
    await prisma.matchingRun.create({
      data: {
        planId: plan.id,
        mode: parsed.data.mode,
        resultJson: JSON.stringify(payload),
        createdById: viewer.user.id
      }
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      !["P2021", "P2022"].includes(error.code)
    ) {
      throw error;
    }
  }

  return NextResponse.json({ ...payload, appliedRoundNumber, appliedRoomIds });
}
