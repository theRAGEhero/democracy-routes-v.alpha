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
  enabled: z.boolean().default(true)
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.aiAgent.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.aiAgent.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true }
  });
  if (exists) {
    return NextResponse.json({ error: "Slug already exists." }, { status: 400 });
  }

  const agent = await prisma.aiAgent.create({
    data: {
      ...parsed.data,
      createdById: session.user.id
    }
  });

  return NextResponse.json({ agent });
}
