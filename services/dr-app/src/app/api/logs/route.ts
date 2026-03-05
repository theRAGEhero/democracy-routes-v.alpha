import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getRequestId } from "@/lib/logger";
import { postEventHubEvent } from "@/lib/eventHub";

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
  const requestId = getRequestId(request);
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

  const mergedMeta = {
    ...(parsed.data.meta && typeof parsed.data.meta === "object" ? parsed.data.meta : {}),
    requestId
  };

  const entry = await prisma.appLog.create({
    data: {
      level: parsed.data.level,
      scope: parsed.data.scope,
      message: parsed.data.message,
      meta: safeStringify(mergedMeta),
      userId: user?.id ?? null
    }
  });

  await postEventHubEvent({
    source: "dr-app",
    type: parsed.data.scope || "client_log",
    severity: parsed.data.level,
    message: parsed.data.message,
    actorId: user?.id ?? null,
    payload: mergedMeta
  });

  return NextResponse.json({ id: entry.id });
}
