import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeCode(value: string | null) {
  if (!value) return "";
  return value.trim().toUpperCase();
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

  const commandMatch = text.match(/^\/(start|help)(@\w+)?(\s|$)/i);
  if (chatId && commandMatch) {
    await sendTelegramMessage(
      botToken,
      chatId,
      [
        "Welcome to Democracy Routes notifications.",
        "Send the verification code shown in your profile settings to link this chat.",
        "After linking, you will receive dataspace updates and plan alerts.",
        "",
        "Need help? Contact your admin."
      ].join("\n")
    );
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
    return NextResponse.json({ ok: true });
  }

  if (user.telegramVerificationExpiresAt && user.telegramVerificationExpiresAt < new Date()) {
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
