import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { z } from "zod";

const posterSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  content: z.string().min(1, "Content is required").max(2000)
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posters = await prisma.poster.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ posters });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const parsed = posterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const poster = await prisma.poster.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      createdById: user.id
    },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ poster });
}
