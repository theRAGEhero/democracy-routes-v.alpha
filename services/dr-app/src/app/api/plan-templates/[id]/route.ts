import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const agreementDeadlineSchema = z
  .union([z.string(), z.number().int().min(0)])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null;
    return String(value);
  });

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional(),
  settings: z
    .object({
      syncMode: z.enum(["SERVER", "CLIENT"]).optional(),
      maxParticipantsPerRoom: z.number().int().min(2).max(12).optional(),
      allowOddGroup: z.boolean().optional(),
      language: z.string().trim().min(2).max(12).optional(),
      transcriptionProvider: z.string().trim().min(2).max(40).optional(),
      timezone: z.string().trim().max(80).optional().nullable(),
      dataspaceId: z.string().trim().max(64).optional().nullable(),
      requiresApproval: z.boolean().optional(),
      capacity: z.number().int().min(1).max(5000).optional().nullable()
    })
    .optional(),
  blocks: z
    .array(
      z.object({
        type: z.enum(["START", "PARTICIPANTS", "PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING", "BREAK", "HARMONICA", "DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"]),
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
      })
    )
    .optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const template = await prisma.planTemplate.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true }
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && template.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: {
    name?: string;
    description?: string | null;
    isPublic?: boolean;
    blocksJson?: string;
    settingsJson?: string | null;
  } = {};

  if (parsed.data.name) updateData.name = parsed.data.name;
  if ("description" in parsed.data) updateData.description = parsed.data.description ?? null;
  if (typeof parsed.data.isPublic === "boolean") updateData.isPublic = parsed.data.isPublic;
  if ("settings" in parsed.data) updateData.settingsJson = parsed.data.settings ? JSON.stringify(parsed.data.settings) : null;
  if (parsed.data.blocks) updateData.blocksJson = JSON.stringify(parsed.data.blocks);

  await prisma.planTemplate.update({
    where: { id: params.id },
    data: updateData
  });

  return NextResponse.json({ ok: true });
}
