import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeCode(value: string | null) {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || "https://democracyroutes.com").replace(/\/$/, "");
}

function buildWelcomeMessage() {
  const appBaseUrl = getAppBaseUrl();
  return [
    "Welcome to Democracy Routes.",
    "This bot helps you link Telegram to the platform so you can receive meeting, dataspace, and workflow notifications.",
    "",
    `Register or sign in: ${appBaseUrl}/register`,
    `Platform: ${appBaseUrl}`,
    "",
    "To link this Telegram chat to your account:",
    "1. Open your profile settings on Democracy Routes.",
    "2. Copy the Telegram verification code shown there.",
    "3. Send that code here in this chat.",
    "",
    "Once linked, this bot will send you platform notifications here."
  ].join("\n");
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch {
    // best-effort
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 500 });
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = await request.json().catch(() => null);
  const message = payload?.message ?? payload?.edited_message ?? null;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id ? String(message.chat.id) : null;
  const chatType = typeof message?.chat?.type === "string" ? String(message.chat.type) : "";
  const isPrivateChat = chatType === "private";

  const commandMatch = text.match(/^\/(start|help)(@\w+)?(\s|$)/i);
  if (chatId && commandMatch) {
    await sendTelegramMessage(botToken, chatId, buildWelcomeMessage());
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith("/")) {
    return NextResponse.json({ ok: true });
  }
  const code = normalizeCode(text);
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  const dataspace = await prisma.dataspace.findFirst({
    where: { telegramGroupLinkCode: code }
  });

  if (dataspace && chatId) {
    await prisma.dataspace.update({
      where: { id: dataspace.id },
      data: {
        telegramGroupChatId: chatId,
        telegramGroupLinkCode: null,
        telegramGroupLinkedAt: new Date()
      }
    });

    await sendTelegramMessage(
      botToken,
      chatId,
      "✅ Telegram group linked to this dataspace. You will now receive updates here."
    );

    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findFirst({
    where: { telegramVerificationCode: code }
  });

  if (!user) {
    if (chatId && isPrivateChat) {
      const linkedUser = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true }
      });
      if (!linkedUser) {
        await sendTelegramMessage(botToken, chatId, buildWelcomeMessage());
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (user.telegramVerificationExpiresAt && user.telegramVerificationExpiresAt < new Date()) {
    if (chatId && isPrivateChat) {
      await sendTelegramMessage(
        botToken,
        chatId,
        [
          "That Telegram verification code has expired.",
          `Open Democracy Routes to generate a new code: ${getAppBaseUrl()}/account`
        ].join("\n")
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: chatId,
      telegramVerificationCode: null,
      telegramVerificationExpiresAt: null
    }
  });

  await sendTelegramMessage(
    botToken,
    chatId,
    "✅ Telegram linked. You will now receive notifications from Democracy Routes."
  );

  return NextResponse.json({ ok: true });
}
