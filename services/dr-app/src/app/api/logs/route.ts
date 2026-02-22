import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const logSchema = z.object({
  level: z.enum(["error", "warn", "info"]).default("error"),
  scope: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  meta: z.record(z.unknown()).optional().nullable()
});

function safeStringify(value: unknown) {
  try {
    const text = JSON.stringify(value);
    if (!text) return null;
    return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
  } catch (error) {
    return null;
  }
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

  const body = await request.json().catch(() => null);
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.appLog.create({
    data: {
      level: parsed.data.level,
      scope: parsed.data.scope,
      message: parsed.data.message,
      meta: safeStringify(parsed.data.meta),
      userId: user?.id ?? null
    }
  });

  return NextResponse.json({ id: entry.id });
}
