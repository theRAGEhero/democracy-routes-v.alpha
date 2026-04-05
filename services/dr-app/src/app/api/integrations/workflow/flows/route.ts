import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";
import { blockTypeSchema } from "@/lib/blockType";

export const dynamic = "force-dynamic";

const participantSchema = z.object({
  type: z.enum(["email", "id"]),
  value: z.string().min(1)
});

const blockSchema = z.object({
  type: blockTypeSchema,
  duration_seconds: z.number().int().positive().max(21600),
  start_mode: z
    .enum([
      "specific_datetime",
      "when_x_join",
      "organizer_manual",
      "when_x_join_and_datetime",
      "random_selection_among_x"
    ])
    .optional()
    .nullable(),
  start_date: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  timezone: z.string().trim().max(100).optional().nullable(),
  required_participants: z.number().int().min(1).max(100000).optional().nullable(),
  agreement_required: z.boolean().optional().nullable(),
  agreement_deadline: z.string().optional().nullable(),
  minimum_participants: z.number().int().min(1).max(100000).optional().nullable(),
  allow_start_before_full: z.boolean().optional().nullable(),
  pool_size: z.number().int().min(1).max(100000).optional().nullable(),
  selected_participants: z.number().int().min(1).max(100000).optional().nullable(),
  selection_rule: z.enum(["random"]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  participant_mode: z
    .enum(["manual_selected", "dataspace_invite_all", "dataspace_random", "ai_search_users"])
    .optional()
    .nullable(),
  participant_user_ids: z.array(z.string().min(1).max(64)).optional().nullable(),
  participant_dataspace_ids: z.array(z.string().min(1).max(64)).optional().nullable(),
  participant_count: z.number().int().min(1).max(100000).optional().nullable(),
  participant_query: z.string().trim().max(500).optional().nullable(),
  participant_note: z.string().trim().max(500).optional().nullable(),
  round_max_participants: z.number().int().min(2).max(12).optional().nullable(),
  form_question: z.string().trim().max(240).optional().nullable(),
  form_choices: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(120)
      })
    )
    .optional()
    .nullable(),
  poster_id: z.string().optional().nullable(),
  poster_title: z.string().optional(),
  poster_content: z.string().optional(),
  embed_url: z.string().trim().max(500).optional().nullable(),
  harmonica_url: z.string().trim().max(500).optional().nullable(),
  matching_mode: z.enum(["polar", "anti", "random"]).optional().nullable(),
  meditation_animation_id: z.string().optional().nullable(),
  meditation_audio_url: z.string().optional().nullable()
});

const createWorkflowPlanSchema = z.object({
  title: z.string().min(1),
  start_at: z.string().min(1),
  round_duration_minutes: z.number().int().positive().max(240),
  rounds_count: z.number().int().positive().max(100),
  sync_mode: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
  max_participants_per_room: z.number().int().min(2).max(12).default(2),
  allow_odd_group: z.boolean().optional().default(false),
  timezone: z.string().max(100).optional().nullable(),
  dataspace_id: z.string().optional().nullable(),
  language: z.string().min(2).max(10).default("EN"),
  transcription_provider: z
    .enum(["DEEPGRAM", "DEEPGRAMLIVE", "VOSK"])
    .default("DEEPGRAM"),
  participants: z.array(participantSchema).min(1),
  created_by_email: z.string().email().optional(),
  blocks: z.array(blockSchema).optional()
});

const listQuerySchema = z.object({
  dataspace_id: z.string().optional(),
  updated_since: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

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

type WorkflowBlockInput = {
  type: "START" | "PARTICIPANTS" | "DISCUSSION" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "GROUPING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
  durationSeconds: number;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
  posterTitle?: string | null;
  posterContent?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | "random" | null;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

function buildDefaultBlocks(roundsCount: number, roundDurationMinutes: number) {
  const blocks: WorkflowBlockInput[] = [];
  const roundDurationSeconds = roundDurationMinutes * 60;
  for (let round = 1; round <= roundsCount; round += 1) {
    blocks.push({ type: "DISCUSSION", durationSeconds: roundDurationSeconds });
  }
  return blocks;
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

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updatedSince = parsed.data.updated_since
    ? new Date(parsed.data.updated_since)
    : null;
  if (parsed.data.updated_since && (!updatedSince || Number.isNaN(updatedSince.getTime()))) {
    return NextResponse.json({ error: "Invalid updated_since" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.dataspace_id) {
    where.dataspaceId = parsed.data.dataspace_id;
  }
  if (updatedSince) {
    where.updatedAt = { gte: updatedSince };
  }

  const flows = await prisma.plan.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset,
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
      updatedAt: true
    }
  });

  return NextResponse.json({
    flows: flows.map((plan: (typeof flows)[number]) => ({
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
      updatedAt: plan.updatedAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createWorkflowPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startAt = new Date(parsed.data.start_at);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start_at" }, { status: 400 });
  }
  if (startAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });
  }

  const creator =
    parsed.data.created_by_email
      ? await prisma.user.findUnique({ where: { email: parsed.data.created_by_email } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (parsed.data.dataspace_id) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: parsed.data.dataspace_id },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
    }
  }

  const emailParticipants = parsed.data.participants
    .filter((participant) => participant.type === "email")
    .map((participant) => participant.value.toLowerCase());
  const idParticipants = parsed.data.participants
    .filter((participant) => participant.type === "id")
    .map((participant) => participant.value);

  const userFilters: Array<{ email?: { in: string[] }; id?: { in: string[] } }> = [];
  if (emailParticipants.length) {
    userFilters.push({ email: { in: emailParticipants } });
  }
  if (idParticipants.length) {
    userFilters.push({ id: { in: idParticipants } });
  }

  const users = await prisma.user.findMany({
    where: { OR: userFilters },
    select: { id: true }
  });

  if (users.length !== emailParticipants.length + idParticipants.length) {
    return NextResponse.json({ error: "Some participants were not found" }, { status: 404 });
  }

  if (users.length < 2) {
    return NextResponse.json({ error: "Not enough valid participants" }, { status: 400 });
  }

  const maxParticipantsPerRoom = parsed.data.max_participants_per_room;
  const allowOddGroup = Boolean(parsed.data.allow_odd_group);
  const blocksInput =
    parsed.data.blocks && parsed.data.blocks.length > 0
      ? parsed.data.blocks.map((block) => ({
          type: block.type,
          durationSeconds: block.duration_seconds,
          startMode: block.start_mode ?? null,
          startDate: block.start_date ?? null,
          startTime: block.start_time ?? null,
          timezone: block.timezone ?? null,
          requiredParticipants: block.required_participants ?? null,
          agreementRequired: block.agreement_required ?? null,
          agreementDeadline: block.agreement_deadline ?? null,
          minimumParticipants: block.minimum_participants ?? null,
          allowStartBeforeFull: block.allow_start_before_full ?? null,
          poolSize: block.pool_size ?? null,
          selectedParticipants: block.selected_participants ?? null,
          selectionRule: block.selection_rule ?? null,
          note: block.note ?? null,
          participantMode: block.participant_mode ?? null,
          participantUserIds: block.participant_user_ids ?? null,
          participantDataspaceIds: block.participant_dataspace_ids ?? null,
          participantCount: block.participant_count ?? null,
          participantQuery: block.participant_query ?? null,
          participantNote: block.participant_note ?? null,
          roundMaxParticipants: block.round_max_participants ?? null,
          formQuestion: block.form_question ?? null,
          formChoices: block.form_choices ?? null,
          posterId: block.poster_id ?? null,
          posterTitle: block.poster_title ?? null,
          posterContent: block.poster_content ?? null,
          embedUrl: block.embed_url ?? null,
          harmonicaUrl: block.harmonica_url ?? null,
          matchingMode: block.matching_mode ?? null,
          meditationAnimationId: block.meditation_animation_id ?? null,
          meditationAudioUrl: block.meditation_audio_url ?? null
        }))
      : buildDefaultBlocks(parsed.data.rounds_count, parsed.data.round_duration_minutes);

  const roundBlocks = blocksInput.filter((block) => block.type === "DISCUSSION");
  if (roundBlocks.length < 1) {
    return NextResponse.json({ error: "Add at least one round block." }, { status: 400 });
  }
  const missingEmbed = blocksInput.some(
    (block) => block.type === "EMBED" && !block.embedUrl
  );
  if (missingEmbed) {
    return NextResponse.json({ error: "Embed blocks require a URL." }, { status: 400 });
  }
  const missingHarmonica = blocksInput.some(
    (block) => block.type === "HARMONICA" && !block.harmonicaUrl
  );
  if (missingHarmonica) {
    return NextResponse.json({ error: "Harmonica blocks require a URL." }, { status: 400 });
  }

  const providedPosterIds = blocksInput
    .filter((block) => block.type === "PROMPT" && block.posterId)
    .map((block) => block.posterId as string);
  if (providedPosterIds.length > 0) {
    const posters = await prisma.poster.findMany({
      where: { id: { in: providedPosterIds } },
      select: { id: true }
    });
    if (posters.length !== providedPosterIds.length) {
      return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    }
  }

  const resolvedBlocks: WorkflowBlockInput[] = [];
  for (const block of blocksInput) {
    if (block.type !== "PROMPT") {
      resolvedBlocks.push(block);
      continue;
    }

    let posterId = block.posterId ?? null;
    if (!posterId) {
      if (!block.posterTitle || !block.posterContent) {
        return NextResponse.json(
          { error: "Poster blocks require a title and content." },
          { status: 400 }
        );
      }
      const poster = await prisma.poster.create({
        data: {
          title: block.posterTitle,
          content: block.posterContent,
          createdById: creator.id
        },
        select: { id: true }
      });
      posterId = poster.id;
    }

    resolvedBlocks.push({ ...block, posterId });
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
      const roomId = generateRoomId(
        parsed.data.language,
        parsed.data.transcription_provider
      );
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
  const blocksData = resolvedBlocks.map((block, index) => {
    if (block.type === "DISCUSSION") {
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
      roundNumber: block.type === "DISCUSSION" ? roundCounter : null
    };
  });

  const firstRoundSeconds = roundBlocks[0]?.durationSeconds ?? 600;
  const firstMeditationBlock = resolvedBlocks.find((block) => block.type === "PAUSE");
  const firstMeditationSeconds = firstMeditationBlock?.durationSeconds ?? 300;

  const plan = await prisma.plan.create({
    data: {
      title: parsed.data.title,
      createdById: creator.id,
      startAt,
      timezone: parsed.data.timezone || null,
      roundDurationMinutes: Math.max(1, Math.round(firstRoundSeconds / 60)),
      roundsCount: roundBlocks.length,
      syncMode: parsed.data.sync_mode,
      maxParticipantsPerRoom,
      allowOddGroup,
      language: parsed.data.language,
      transcriptionProvider: parsed.data.transcription_provider,
      meditationEnabled: resolvedBlocks.some((block) => block.type === "PAUSE"),
      meditationAtStart: false,
      meditationBetweenRounds: false,
      meditationAtEnd: false,
      meditationDurationMinutes: Math.max(1, Math.round(firstMeditationSeconds / 60)),
      meditationAnimationId: firstMeditationBlock?.meditationAnimationId ?? null,
      meditationAudioUrl: firstMeditationBlock?.meditationAudioUrl ?? null,
      dataspaceId: parsed.data.dataspace_id ?? null,
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

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3015";

  return NextResponse.json({
    plan_id: plan.id,
    plan_url: `${baseUrl}/flows/${plan.id}`
  });
}
