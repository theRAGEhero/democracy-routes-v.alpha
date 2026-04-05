import { prisma } from "@/lib/prisma";
import {
  normalizeTelegramHandle,
  resolveTelegramChatId,
  sendTelegramMessage
} from "@/lib/telegram";

type InviteKind = "meeting" | "plan" | "dataspace";

type InviteRecipient = {
  id: string;
  telegramHandle?: string | null;
  telegramChatId?: string | null;
};

function buildInviteMessage(kind: InviteKind, title: string, link: string) {
  const label =
    kind === "plan" ? "template" : kind === "dataspace" ? "dataspace" : "meeting";
  return `You are invited to the ${label} "${title}".\n${link}`;
}

async function getTelegramChatId(recipient: InviteRecipient) {
  if (recipient.telegramChatId) {
    const parsed = Number(recipient.telegramChatId);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const handle = normalizeTelegramHandle(recipient.telegramHandle);
  if (!handle) return null;

  const resolved = await resolveTelegramChatId(handle);
  if (!resolved) return null;

  await prisma.user.update({
    where: { id: recipient.id },
    data: { telegramChatId: String(resolved) }
  });

  return resolved;
}

export async function sendTelegramInvite(
  recipient: InviteRecipient,
  enabled: boolean | null | undefined,
  kind: InviteKind,
  title: string,
  link: string
) {
  if (!enabled || !process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, skipped: true as const };
  }

  const chatId = await getTelegramChatId(recipient);
  if (!chatId) {
    return { ok: false, skipped: true as const };
  }

  return sendTelegramMessage(chatId, buildInviteMessage(kind, title, link));
}
