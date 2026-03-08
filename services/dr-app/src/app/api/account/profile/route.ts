import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { profileSettingsSchema } from "@/lib/validators";

function normalizeTelegramHandle(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const telegramHandle = normalizeTelegramHandle(parsed.data.telegramHandle ?? null);
  const personalDescription = parsed.data.personalDescription?.trim() || null;
  const calComLink = parsed.data.calComLink?.trim() || null;
  const avatarUrl = parsed.data.avatarUrl?.trim() || null;

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramHandle: true, telegramChatId: true }
  });

  let telegramVerificationCode: string | null = null;
  let telegramVerificationExpiresAt: Date | null = null;
  const needsVerification =
    telegramHandle &&
    (existing?.telegramHandle !== telegramHandle || !existing?.telegramChatId);

  if (needsVerification) {
    telegramVerificationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    telegramVerificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      telegramHandle,
      personalDescription,
      calComLink,
      avatarUrl,
      notifyEmailMeetingInvites: parsed.data.notifyEmailMeetingInvites ?? undefined,
      notifyTelegramMeetingInvites: parsed.data.notifyTelegramMeetingInvites ?? undefined,
      notifyEmailPlanInvites: parsed.data.notifyEmailPlanInvites ?? undefined,
      notifyTelegramPlanInvites: parsed.data.notifyTelegramPlanInvites ?? undefined,
      notifyEmailDataspaceInvites: parsed.data.notifyEmailDataspaceInvites ?? undefined,
      notifyTelegramDataspaceInvites: parsed.data.notifyTelegramDataspaceInvites ?? undefined,
      notifyEmailDataspaceActivity: parsed.data.notifyEmailDataspaceActivity ?? undefined,
      notifyTelegramDataspaceActivity: parsed.data.notifyTelegramDataspaceActivity ?? undefined,
      telegramChatId:
        existing?.telegramHandle !== telegramHandle ? null : undefined,
      telegramVerificationCode,
      telegramVerificationExpiresAt
    }
  });

  return NextResponse.json({
    message: "Profile updated",
    telegramVerificationCode:
      needsVerification ? updated.telegramVerificationCode : null
  });
}
