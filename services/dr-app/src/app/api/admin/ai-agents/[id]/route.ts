import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const agentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/),
  systemPrompt: z.string().trim().min(1).max(12000),
  instructionPrompt: z.string().trim().max(12000).optional().nullable(),
  model: z.string().trim().min(1).max(120),
  defaultIntervalSeconds: z.number().int().min(15).max(3600).default(60),
  enabled: z.boolean().default(true)
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await prisma.aiAgent.findUnique({
    where: { id: params.id }
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.aiAgent.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const slugConflict = await prisma.aiAgent.findFirst({
    where: {
      slug: parsed.data.slug,
      NOT: { id: params.id }
    },
    select: { id: true }
  });
  if (slugConflict) {
    return NextResponse.json({ error: "Slug already exists." }, { status: 400 });
  }

  const agent = await prisma.aiAgent.update({
    where: { id: params.id },
    data: parsed.data
  });

  return NextResponse.json({ agent });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.aiAgent.delete({
    where: { id: params.id }
  });

  return NextResponse.json({ ok: true });
}
