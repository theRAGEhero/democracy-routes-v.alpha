import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { blockTypeSchema } from "@/lib/blockType";

const agreementDeadlineSchema = z
  .union([z.string(), z.number().int().min(0)])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null;
    return String(value);
  });

const blockSchema = z.object({
  type: blockTypeSchema,
  durationSeconds: z.number().int().min(1).max(7200),
  startMode: z
    .enum([
      "specific_datetime",
      "when_x_join",
      "organizer_manual",
      "when_x_join_and_datetime",
      "random_selection_among_x"
    ])
    .optional()
    .nullable(),
  startDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  timezone: z.string().trim().max(100).optional().nullable(),
  requiredParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  agreementRequired: z.boolean().optional().nullable(),
  agreementDeadline: agreementDeadlineSchema,
  minimumParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  allowStartBeforeFull: z.boolean().optional().nullable(),
  poolSize: z.number().int().min(1).max(100000).optional().nullable(),
  selectedParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  selectionRule: z.enum(["random"]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  participantMode: z
    .enum(["manual_selected", "dataspace_invite_all", "dataspace_random", "ai_search_users"])
    .optional()
    .nullable(),
  participantUserIds: z.array(z.string().min(1).max(64)).optional().nullable(),
  participantDataspaceIds: z.array(z.string().min(1).max(64)).optional().nullable(),
  participantCount: z.number().int().min(1).max(100000).optional().nullable(),
  participantQuery: z.string().trim().max(500).optional().nullable(),
  participantNote: z.string().trim().max(500).optional().nullable(),
  roundMaxParticipants: z.number().int().min(2).max(12).optional().nullable(),
  aiAgentsEnabled: z.boolean().optional().nullable(),
  aiAgentIds: z.array(z.string().min(1).max(64)).optional().nullable(),
  aiAgentIntervalSeconds: z.number().int().min(15).max(3600).optional().nullable(),
  aiAgentCooldownSeconds: z.number().int().min(15).max(7200).optional().nullable(),
  aiAgentMaxReplies: z.number().int().min(1).max(100).optional().nullable(),
  aiAgentPromptOverride: z.string().trim().max(2000).optional().nullable(),
  formQuestion: z.string().trim().max(240).optional().nullable(),
  formChoices: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(120)
      })
    )
    .optional()
    .nullable(),
  posterId: z.string().optional().nullable(),
  posterTitle: z.string().trim().max(120).optional().nullable(),
  posterContent: z.string().trim().max(4000).optional().nullable(),
  embedUrl: z.string().trim().max(500).optional().nullable(),
  harmonicaUrl: z.string().trim().max(500).optional().nullable(),
  matchingMode: z.enum(["polar", "anti"]).optional().nullable(),
  meditationAnimationId: z.string().optional().nullable(),
  meditationAudioUrl: z.string().optional().nullable()
});

const templateSettingsSchema = z.object({
  syncMode: z.enum(["SERVER", "CLIENT"]).optional(),
  maxParticipantsPerRoom: z.number().int().min(2).max(12).optional(),
  allowOddGroup: z.boolean().optional(),
  language: z.string().trim().min(2).max(12).optional(),
  transcriptionProvider: z.string().trim().min(2).max(40).optional(),
  timezone: z.string().trim().max(80).optional().nullable(),
  dataspaceId: z.string().trim().max(64).optional().nullable(),
  requiresApproval: z.boolean().optional(),
  capacity: z.number().int().min(1).max(5000).optional().nullable()
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  settings: templateSettingsSchema.optional(),
  blocks: z.array(blockSchema).min(1)
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.planTemplate.findMany({
    where: {
      OR: [{ createdById: session.user.id }, { isPublic: true }]
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      blocksJson: true,
      settingsJson: true,
      updatedAt: true,
      isPublic: true,
      createdById: true
    }
  });

  const parsed = templates.map((template: (typeof templates)[number]) => {
    let blocks = [];
    let settings = null;
    try {
      blocks = JSON.parse(template.blocksJson);
    } catch (error) {
      blocks = [];
    }
    try {
      settings = template.settingsJson ? JSON.parse(template.settingsJson) : null;
    } catch (error) {
      settings = null;
    }
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      updatedAt: template.updatedAt.toISOString(),
      isPublic: template.isPublic,
      createdById: template.createdById,
      blocks,
      settings
    };
  });

  return NextResponse.json({ templates: parsed });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user =
    (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })) ??
    (session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true }
        })
      : null);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.planTemplate.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      blocksJson: JSON.stringify(parsed.data.blocks),
      settingsJson: parsed.data.settings ? JSON.stringify(parsed.data.settings) : null,
      createdById: user.id,
      isPublic: Boolean(parsed.data.isPublic)
    },
    select: { id: true }
  });

  return NextResponse.json({ id: template.id });
}
