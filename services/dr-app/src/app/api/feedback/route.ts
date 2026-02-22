import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const feedbackSchema = z.object({
  message: z.string().min(3, "Message is too short").max(2000, "Message is too long"),
  pagePath: z.string().min(1, "Page is required").max(500, "Page is too long")
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.feedback.create({
    data: {
      userId: session.user.id,
      userEmail: session.user.email,
      pagePath: parsed.data.pagePath,
      message: parsed.data.message
    }
  });

  return NextResponse.json({ ok: true });
}
