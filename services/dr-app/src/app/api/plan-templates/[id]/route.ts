import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional(),
  blocks: z
    .array(
      z.object({
        type: z.enum(["PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING"]),
        durationSeconds: z.number().int().min(1).max(7200),
        roundMaxParticipants: z.number().int().min(2).max(12).optional().nullable(),
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
        embedUrl: z.string().trim().max(500).optional().nullable(),
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
  } = {};

  if (parsed.data.name) updateData.name = parsed.data.name;
  if ("description" in parsed.data) updateData.description = parsed.data.description ?? null;
  if (typeof parsed.data.isPublic === "boolean") updateData.isPublic = parsed.data.isPublic;
  if (parsed.data.blocks) updateData.blocksJson = JSON.stringify(parsed.data.blocks);

  await prisma.planTemplate.update({
    where: { id: params.id },
    data: updateData
  });

  return NextResponse.json({ ok: true });
}
