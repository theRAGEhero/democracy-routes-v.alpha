import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createPlanSchema } from "@/lib/validators";
import { notifyDataspaceSubscribers } from "@/lib/dataspaceNotifications";
import { getRequestId, logError } from "@/lib/logger";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

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
  type: "ROUND" | "MEDITATION" | "POSTER" | "TEXT" | "RECORD" | "FORM";
  durationSeconds: number;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
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
      type: "MEDITATION",
      durationSeconds: meditationDurationSeconds,
      meditationAnimationId: data.meditationAnimationId ?? null,
      meditationAudioUrl: data.meditationAudioUrl ?? null
    });
  }

  for (let round = 1; round <= data.roundsCount; round += 1) {
    blocks.push({ type: "ROUND", durationSeconds: roundDurationSeconds });
    if (data.meditationEnabled && data.meditationBetweenRounds && round < data.roundsCount) {
      blocks.push({
        type: "MEDITATION",
        durationSeconds: meditationDurationSeconds,
        meditationAnimationId: data.meditationAnimationId ?? null,
        meditationAudioUrl: data.meditationAudioUrl ?? null
      });
    }
  }

  if (data.meditationEnabled && data.meditationAtEnd) {
    blocks.push({
      type: "MEDITATION",
      durationSeconds: meditationDurationSeconds,
      meditationAnimationId: data.meditationAnimationId ?? null,
      meditationAudioUrl: data.meditationAudioUrl ?? null
    });
  }

  return blocks;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `plan-create:${session.user.id}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invitedEmails = Array.from(
    new Set(
      (parsed.data.inviteEmails ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  if (startAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
  }

  const participantsById = new Set(parsed.data.participantIds);
  const existingUsers = parsed.data.participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: parsed.data.participantIds } },
        select: { id: true, email: true }
      })
    : [];

  const existingEmails = new Set(
    existingUsers.map((user: (typeof existingUsers)[number]) => user.email.toLowerCase())
  );

  const inviteTargets = invitedEmails.filter((email) => !existingEmails.has(email));
  const inviteUsers =
    inviteTargets.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: inviteTargets } },
          select: { id: true, email: true, isGuest: true }
        })
      : [];

  const missingInviteEmails = inviteTargets.filter(
    (email) =>
      !inviteUsers.some(
        (user: (typeof inviteUsers)[number]) => user.email.toLowerCase() === email
      )
  );

  if (missingInviteEmails.length > 0) {
    const createUsers = await Promise.all(
      missingInviteEmails.map(async (email) => {
        const tempPassword = crypto.randomBytes(32).toString("base64url");
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        return prisma.user.create({
          data: {
            email,
            passwordHash,
            role: "USER",
            isGuest: true,
            mustChangePassword: false,
            emailVerifiedAt: null
          },
          select: { id: true, email: true, isGuest: true }
        });
      })
    );
    createUsers.forEach((user: (typeof createUsers)[number]) => inviteUsers.push(user));
  }

  existingUsers.forEach((user: (typeof existingUsers)[number]) => participantsById.add(user.id));
  inviteUsers.forEach((user: (typeof inviteUsers)[number]) => participantsById.add(user.id));

  const participants = Array.from(participantsById);
  if (participants.length < 1) {
    return NextResponse.json(
      { error: "Select at least one participant (including invited guests)." },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: participants } },
    select: { id: true }
  });

  if (parsed.data.dataspaceId) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: parsed.data.dataspaceId },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
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
  const roundBlocks = blocksInput.filter((block) => block.type === "ROUND");
  const missingPoster = blocksInput.some(
    (block) => block.type === "POSTER" && !block.posterId
  );

  if (roundBlocks.length < 1) {
    if (blocksInput.length < 1) {
      return NextResponse.json({ error: "Add at least one block." }, { status: 400 });
    }
  }
  if (missingPoster) {
    return NextResponse.json({ error: "Select a poster for every poster block." }, { status: 400 });
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
    if (block.type === "ROUND") {
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
      meditationAnimationId: block.meditationAnimationId ?? null,
      meditationAudioUrl: block.meditationAudioUrl ?? null,
      roundNumber: block.type === "ROUND" ? roundCounter : null
    };
  });
  const firstRoundSeconds = roundBlocks[0]?.durationSeconds ?? 600;
  const firstMeditationBlock = blocksInput.find((block) => block.type === "MEDITATION");
  const firstMeditationSeconds = firstMeditationBlock?.durationSeconds ?? 300;

  const plan = await prisma.plan.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      createdById: session.user.id,
      dataspaceId: parsed.data.dataspaceId ?? null,
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
      meditationEnabled: blocksInput.some((block) => block.type === "MEDITATION"),
      meditationAtStart: false,
      meditationBetweenRounds: false,
      meditationAtEnd: false,
      meditationDurationMinutes: Math.max(1, Math.round(firstMeditationSeconds / 60)),
      meditationAnimationId: firstMeditationBlock?.meditationAnimationId ?? null,
      meditationAudioUrl: firstMeditationBlock?.meditationAudioUrl ?? null,
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

  if (plan.dataspaceId) {
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    try {
      await notifyDataspaceSubscribers({
        dataspaceId: plan.dataspaceId,
        title: plan.title,
        link: `${appBaseUrl}/flows/${plan.id}`,
        type: "PLAN"
      });
    } catch (error) {
      logError("telegram_notify_failed", error, {
        requestId,
        scope: "plan",
        dataspaceId: plan.dataspaceId,
        planId: plan.id
      });
    }
  }

  return NextResponse.json({ id: plan.id });
}
