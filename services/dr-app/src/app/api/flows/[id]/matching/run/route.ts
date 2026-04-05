import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";
import { buildPlanSegmentsFromBlocks, buildLegacySegments, type PlanBlockInput, type PlanBlockType } from "@/lib/planSchedule";
import { logError, logInfo, logWarn } from "@/lib/logger";
import crypto from "crypto";
import { normalizeBlockType } from "@/lib/blockType";
import { generateFlowRoomId, nextDiscussionRoundNumber } from "@/lib/flowRuntime";
import { getRoomProviderSuffix } from "@/lib/transcriptionProviders";

function generateRoomId(language: string, transcriptionProvider: string) {
  const providerLabel = getRoomProviderSuffix(transcriptionProvider);
  const base = crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
  return `${base}-${language}-${providerLabel}`;
}

const requestSchema = z.object({
  mode: z.enum(["polar", "anti", "random"]).default("polar")
});

function buildRemixedRooms(
  participantIds: string[],
  groupSize: number,
  priorEncounterCounts: Map<string, number>
) {
  const rooms: string[][] = [];

  function pairKey(a: string, b: string) {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
  }

  for (const participantId of participantIds) {
    let bestRoomIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const room = rooms[roomIndex];
      if (room.length >= groupSize) continue;
      const score = room.reduce(
        (sum, memberId) => sum + (priorEncounterCounts.get(pairKey(participantId, memberId)) ?? 0),
        0
      );
      if (score < bestScore) {
        bestScore = score;
        bestRoomIndex = roomIndex;
      }
    }

    if (bestRoomIndex === -1) {
      rooms.push([participantId]);
    } else {
      rooms[bestRoomIndex].push(participantId);
    }
  }

  return rooms;
}

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
      dataspaceId: true,
      language: true,
      transcriptionProvider: true,
      runtimeVersion: true,
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
  const canRunRoomGrouping = plan.runtimeVersion === "ROOM_BASED";
  if (!isAdmin && !isOwner && !canRunRoomGrouping) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  logInfo("flow_matching_run_started", {
    planId: plan.id,
    planTitle: plan.title,
    actorId: viewer.user.id,
    actorEmail: viewer.user.email,
    dataspaceId: plan.dataspaceId ?? null,
    mode: parsed.data.mode,
    viewerIsGuest: viewer.isGuest
  });

  let planRecap;
  let appliedRoundNumber: number | null = null;
  let appliedRoomIds: string[] = [];

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
  const canApply = currentSegment?.type === "GROUPING" && currentSegment.blockId;
  let payload: any = null;

  if (plan.runtimeVersion === "ROOM_BASED") {
    if (!canApply) {
      return NextResponse.json({
        summary: "Grouping run skipped because the current segment is not a Grouping block.",
        rooms: [],
        appliedRoundNumber: null,
        appliedRoomIds: []
      });
    }
    const currentBlock = plan.blocks.find((block) => block.id === currentSegment.blockId);
    const targetRoundNumber = currentBlock
      ? nextDiscussionRoundNumber(plan.blocks, currentBlock.orderIndex)
      : null;
    if (!targetRoundNumber) {
      return NextResponse.json({
        summary: "No following Discussion block was found for this grouping step.",
        rooms: [],
        appliedRoundNumber: null,
        appliedRoomIds: []
      });
    }
    const targetRoundBlock = plan.blocks.find(
      (block) => block.type === "DISCUSSION" && block.roundNumber === targetRoundNumber
    );
    const groupSize = targetRoundBlock?.roundMaxParticipants ?? plan.maxParticipantsPerRoom ?? 2;
    const sessions = await prisma.planParticipantSession.findMany({
      where: {
        planId: plan.id,
        status: "APPROVED"
      },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        displayName: true
      }
    });
    const shuffled = [...sessions];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const priorMembers = targetRoundNumber > 1
      ? await prisma.planRoom.findMany({
          where: {
            planId: plan.id,
            planRound: {
              roundNumber: { lt: targetRoundNumber }
            }
          },
          select: {
            members: {
              select: {
                participantSessionId: true
              }
            }
          }
        })
      : [];
    const priorEncounterCounts = new Map<string, number>();
    for (const room of priorMembers) {
      const memberIds = room.members.map((member) => member.participantSessionId);
      for (let i = 0; i < memberIds.length; i += 1) {
        for (let j = i + 1; j < memberIds.length; j += 1) {
          const a = memberIds[i];
          const b = memberIds[j];
          const key = a < b ? `${a}::${b}` : `${b}::${a}`;
          priorEncounterCounts.set(key, (priorEncounterCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const remixedSessionIds =
      targetRoundNumber > 1
        ? buildRemixedRooms(shuffled.map((session) => session.id), groupSize, priorEncounterCounts)
        : (() => {
            const groups: string[][] = [];
            for (let i = 0; i < shuffled.length; i += groupSize) {
              groups.push(shuffled.slice(i, i + groupSize).map((session) => session.id));
            }
            return groups;
          })();
    const sessionById = new Map(shuffled.map((session) => [session.id, session]));
    const rooms: Array<{ participants: string[]; sessionIds: string[]; reason: string }> = remixedSessionIds
      .filter((group) => group.length > 0)
      .map((group) => ({
        participants: group.map((sessionId) => sessionById.get(sessionId)?.displayName ?? sessionId),
        sessionIds: group,
        reason:
          targetRoundNumber > 1
            ? "Remixed grouping that tries to reduce repeated encounters from earlier rounds."
            : "Randomized grouping for the next discussion round."
      }));

    const round = await prisma.planRound.findUnique({
      where: { planId_roundNumber: { planId: plan.id, roundNumber: targetRoundNumber } },
      select: { id: true }
    });
    if (round) {
      await prisma.$transaction(async (tx) => {
        await tx.planRoomMember.deleteMany({
          where: {
            planRoom: {
              planId: plan.id,
              planRoundId: round.id
            }
          }
        });
        await tx.planRoom.deleteMany({
          where: {
            planId: plan.id,
            planRoundId: round.id
          }
        });
        for (const room of rooms) {
          const createdRoom = await tx.planRoom.create({
            data: {
              planId: plan.id,
              planRoundId: round.id,
              blockId: currentSegment.blockId,
              roomId: generateFlowRoomId(plan.language, plan.transcriptionProvider),
              groupingMode: parsed.data.mode
            }
          });
          appliedRoomIds.push(createdRoom.roomId);
          await tx.planRoomMember.createMany({
            data: room.sessionIds.map((participantSessionId) => ({
              planRoomId: createdRoom.id,
              participantSessionId
            }))
          });
        }
      });
      appliedRoundNumber = targetRoundNumber;
    }
    payload = {
      summary: `Created ${rooms.length} discussion rooms for round ${appliedRoundNumber ?? "?"}.`,
      rooms: rooms.map((room) => ({
        participants: room.participants,
        reason: room.reason
      }))
    };
  } else {
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
      logWarn("flow_matching_run_failed", {
        planId: plan.id,
        actorId: viewer.user.id,
        dataspaceId: plan.dataspaceId ?? null,
        mode: parsed.data.mode,
        responseStatus: response.status,
        errorData
      });
      return NextResponse.json(
        { error: "Failed to run matching", details: errorData },
        { status: response.status }
      );
    }

    payload = await response.json();
  }

  if (plan.runtimeVersion !== "ROOM_BASED" && canApply && Array.isArray(payload?.rooms)) {
    const blocksById = new Map(plan.blocks.map((block) => [block.id, block]));
    const currentBlock = blocksById.get(currentSegment.blockId as string);
    let nextRoundNumber: number | null = null;
    if (currentBlock) {
      const nextRound = plan.blocks
        .filter((block) => block.orderIndex > currentBlock.orderIndex)
        .find((block) => block.type === "DISCUSSION" && block.roundNumber);
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
      logError("flow_matching_run_persist_failed", error, {
        planId: plan.id,
        actorId: viewer.user.id,
        dataspaceId: plan.dataspaceId ?? null,
        mode: parsed.data.mode
      });
      throw error;
    }
  }

  logInfo("flow_matching_run_completed", {
    planId: plan.id,
    planTitle: plan.title,
    actorId: viewer.user.id,
    dataspaceId: plan.dataspaceId ?? null,
    mode: parsed.data.mode,
    canApply,
    appliedRoundNumber,
    appliedRoomIds,
    roomCount: Array.isArray(payload?.rooms) ? payload.rooms.length : null
  });

  return NextResponse.json({ ...payload, appliedRoundNumber, appliedRoomIds });
}
