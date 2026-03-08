import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { createPlanSchema } from "@/lib/validators";
import {
  buildPlanSegmentsFromBlocks,
  buildLegacySegments,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";
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

function makeGroups(
  userIds: string[],
  maxParticipantsPerRoom: number,
  allowOddGroup: boolean
) {
  const list = [...userIds];
  if (maxParticipantsPerRoom === 2 && list.length % 2 === 1) {
    if (allowOddGroup && list.length >= 3) {
      const groups: Array<string[]> = [];
      for (let i = 0; i < list.length - 3; i += 2) {
        groups.push(list.slice(i, i + 2));
      }
      groups.push(list.slice(list.length - 3));
      return groups;
    }
    list.push("__break__");
  }

  const groups: Array<string[]> = [];
  for (let i = 0; i < list.length; i += maxParticipantsPerRoom) {
    groups.push(list.slice(i, i + maxParticipantsPerRoom));
  }
  return groups;
}

function rotate(userIds: string[]) {
  if (userIds.length <= 2) return userIds;
  const [first, ...rest] = userIds;
  const last = rest.pop();
  if (!last) return userIds;
  return [first, last, ...rest];
}

type BlockInput = {
  type: "START" | "PARTICIPANTS" | "PAIRING" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "MATCHING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
  durationSeconds: number;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | null;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

function buildDefaultBlocks(data: {
  roundsCount: number;
  roundDurationMinutes: number;
  meditationEnabled: boolean;
  meditationAtStart: boolean;
  meditationBetweenRounds: boolean;
  meditationAtEnd: boolean;
  meditationDurationMinutes: number;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
}) {
  const blocks: BlockInput[] = [];
  const roundDurationSeconds = data.roundDurationMinutes * 60;
  const meditationDurationSeconds = data.meditationDurationMinutes * 60;

  if (data.meditationEnabled && data.meditationAtStart) {
    blocks.push({
      type: "PAUSE",
      durationSeconds: meditationDurationSeconds,
      meditationAnimationId: data.meditationAnimationId ?? null,
      meditationAudioUrl: data.meditationAudioUrl ?? null
    });
  }

  for (let round = 1; round <= data.roundsCount; round += 1) {
    blocks.push({ type: "PAIRING", durationSeconds: roundDurationSeconds });
    if (data.meditationEnabled && data.meditationBetweenRounds && round < data.roundsCount) {
      blocks.push({
        type: "PAUSE",
        durationSeconds: meditationDurationSeconds,
        meditationAnimationId: data.meditationAnimationId ?? null,
        meditationAudioUrl: data.meditationAudioUrl ?? null
      });
    }
  }

  if (data.meditationEnabled && data.meditationAtEnd) {
    blocks.push({
      type: "PAUSE",
      durationSeconds: meditationDurationSeconds,
      meditationAnimationId: data.meditationAnimationId ?? null,
      meditationAudioUrl: data.meditationAudioUrl ?? null
    });
  }

  return blocks;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && plan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingBlocks = await prisma.planBlock.findMany({
    where: { planId: plan.id },
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
  });
  const normalizedBlocks: PlanBlockInput[] = existingBlocks.reduce(
    (acc: PlanBlockInput[], block: (typeof existingBlocks)[number]) => {
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
  const { totalEndMs } = schedule;

  if (Date.now() > totalEndMs) {
    return NextResponse.json({ error: "Template already concluded." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: parsed.data.participantIds } },
    select: { id: true }
  });

  if (users.length < 1) {
    return NextResponse.json({ error: "Not enough valid participants" }, { status: 400 });
  }

  if (parsed.data.dataspaceId) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: parsed.data.dataspaceId },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
    }
    const membership = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: parsed.data.dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!membership) {
      return NextResponse.json({ error: "Invalid dataspace selection" }, { status: 403 });
    }
  }
  if (parsed.data.isPublic && !parsed.data.dataspaceId) {
    return NextResponse.json({ error: "Public templates require a dataspace." }, { status: 400 });
  }

  const maxParticipantsPerRoom = parsed.data.maxParticipantsPerRoom;
  const allowOddGroup = Boolean(parsed.data.allowOddGroup);
  const blocksInput =
    parsed.data.blocks && parsed.data.blocks.length > 0
      ? parsed.data.blocks
      : buildDefaultBlocks(parsed.data);
  const roundBlocks = blocksInput.filter((block) => block.type === "PAIRING");
  const missingPoster = blocksInput.some(
    (block) => block.type === "PROMPT" && !block.posterId
  );
  const missingEmbed = blocksInput.some(
    (block) => block.type === "EMBED" && !block.embedUrl
  );
  const missingHarmonica = blocksInput.some(
    (block) => block.type === "HARMONICA" && !block.harmonicaUrl
  );

  if (roundBlocks.length < 1) {
    if (blocksInput.length < 1) {
      return NextResponse.json({ error: "Add at least one block." }, { status: 400 });
    }
  }
  if (missingPoster) {
    return NextResponse.json({ error: "Select a poster for every poster block." }, { status: 400 });
  }
  if (missingEmbed) {
    return NextResponse.json({ error: "Enter a URL for every embed block." }, { status: 400 });
  }
  if (missingHarmonica) {
    return NextResponse.json({ error: "Enter a URL for every Harmonica block." }, { status: 400 });
  }

  const posterIds = Array.from(
    new Set(
      blocksInput
        .map((block) => block.posterId)
        .filter((posterId): posterId is string => Boolean(posterId))
    )
  );
  if (posterIds.length > 0) {
    const posters = await prisma.poster.findMany({
      where: { id: { in: posterIds } },
      select: { id: true }
    });
    if (posters.length !== posterIds.length) {
      return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    }
  }
  let rotation = users.map((user: (typeof users)[number]) => user.id);
  const roundsData = [] as Array<{
    roundNumber: number;
    pairs: Array<{ userAId: string; userBId: string | null; roomId: string }>;
  }>;

  for (let i = 0; i < roundBlocks.length; i += 1) {
    const roundMax = roundBlocks[i]?.roundMaxParticipants ?? maxParticipantsPerRoom;
    const groups = makeGroups(rotation, roundMax, allowOddGroup);
    const pairs = groups.flatMap((group) => {
      const roomId = generateRoomId(parsed.data.language, parsed.data.transcriptionProvider);
      const roomPairs: Array<{ userAId: string; userBId: string | null; roomId: string }> = [];

      for (let index = 0; index < group.length; index += 2) {
        const userAId = group[index];
        if (userAId === "__break__") continue;
        const userBId = group[index + 1] ?? null;
        roomPairs.push({
          userAId,
          userBId: userBId === "__break__" ? null : userBId,
          roomId
        });
      }

      return roomPairs;
    });
    roundsData.push({ roundNumber: i + 1, pairs });
    rotation = rotate(rotation);
  }

  let roundCounter = 0;
  const blocksData = blocksInput.map((block, index) => {
    if (block.type === "PAIRING") {
      roundCounter += 1;
    }
    return {
      orderIndex: index,
      type: block.type,
      durationSeconds: block.durationSeconds,
      roundMaxParticipants: block.roundMaxParticipants ?? null,
      formQuestion: block.formQuestion ?? null,
      formChoicesJson: block.formChoices ? JSON.stringify(block.formChoices) : null,
      posterId: block.posterId ?? null,
      embedUrl: block.embedUrl ?? null,
      harmonicaUrl: block.harmonicaUrl ?? null,
      matchingMode: block.matchingMode ?? null,
      meditationAnimationId: block.meditationAnimationId ?? null,
      meditationAudioUrl: block.meditationAudioUrl ?? null,
      roundNumber: block.type === "PAIRING" ? roundCounter : null
    };
  });
  const firstRoundSeconds = roundBlocks[0]?.durationSeconds ?? 600;
  const firstMeditationBlock = blocksInput.find((block) => block.type === "PAUSE");
  const firstMeditationSeconds = firstMeditationBlock?.durationSeconds ?? 300;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.planRound.deleteMany({ where: { planId: plan.id } });
    await tx.planBlock.deleteMany({ where: { planId: plan.id } });
    await tx.plan.update({
      where: { id: plan.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        startAt,
        timezone: parsed.data.timezone || null,
        roundDurationMinutes: roundBlocks.length
          ? Math.max(1, Math.round(firstRoundSeconds / 60))
          : Math.max(1, parsed.data.roundDurationMinutes),
        roundsCount: roundBlocks.length,
        syncMode: parsed.data.syncMode,
        maxParticipantsPerRoom,
        allowOddGroup,
        language: parsed.data.language,
        transcriptionProvider: parsed.data.transcriptionProvider,
        meditationEnabled: blocksInput.some((block) => block.type === "PAUSE"),
        meditationAtStart: false,
        meditationBetweenRounds: false,
        meditationAtEnd: false,
        meditationDurationMinutes: Math.max(1, Math.round(firstMeditationSeconds / 60)),
        meditationAnimationId: firstMeditationBlock?.meditationAnimationId ?? null,
        meditationAudioUrl: firstMeditationBlock?.meditationAudioUrl ?? null,
        dataspaceId: parsed.data.dataspaceId ?? null,
        isPublic: Boolean(parsed.data.isPublic),
        requiresApproval: Boolean(parsed.data.requiresApproval),
        capacity: parsed.data.capacity ?? null,
        rounds: {
          create: roundsData.map((round) => ({
            roundNumber: round.roundNumber,
            pairs: {
              create: round.pairs.map((pair) => ({
                roomId: pair.roomId,
                userAId: pair.userAId,
                userBId: pair.userBId
              }))
            }
          }))
        },
        blocks: {
          create: blocksData
        }
      }
    });
  });

  return NextResponse.json({ id: plan.id });
}
