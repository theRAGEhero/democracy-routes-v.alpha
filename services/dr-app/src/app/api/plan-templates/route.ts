import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const blockSchema = z.object({
  type: z.enum(["ROUND", "MEDITATION", "POSTER", "TEXT", "RECORD", "FORM"]),
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
  meditationAnimationId: z.string().optional().nullable(),
  meditationAudioUrl: z.string().optional().nullable()
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
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
      updatedAt: true,
      isPublic: true,
      createdById: true
    }
  });

  const parsed = templates.map((template: (typeof templates)[number]) => {
    let blocks = [];
    try {
      blocks = JSON.parse(template.blocksJson);
    } catch (error) {
      blocks = [];
    }
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      updatedAt: template.updatedAt.toISOString(),
      isPublic: template.isPublic,
      createdById: template.createdById,
      blocks
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
      createdById: user.id,
      isPublic: Boolean(parsed.data.isPublic)
    },
    select: { id: true }
  });

  return NextResponse.json({ id: template.id });
}
