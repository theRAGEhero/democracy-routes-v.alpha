import { prisma } from "@/lib/prisma";
import { normalizeTelegramHandle, resolveTelegramChatId, sendTelegramMessage } from "@/lib/telegram";

type NotifyPayload = {
  dataspaceId: string;
  title: string;
  link: string;
  type: "MEETING" | "PLAN";
};

export async function notifyDataspaceSubscribers({
  dataspaceId,
  title,
  link,
  type
}: NotifyPayload) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const subscribers = await prisma.dataspaceSubscription.findMany({
    where: { dataspaceId },
    include: {
      user: {
        select: { id: true, telegramHandle: true, telegramChatId: true }
      }
    }
  });

  if (subscribers.length === 0) return;

  const label = type === "PLAN" ? "Plan" : "Meeting";
  const message = `${label} created: ${title}\n${link}`;

  for (const subscription of subscribers) {
    const handle = normalizeTelegramHandle(subscription.user.telegramHandle);
    if (!handle) continue;

    let chatId = subscription.user.telegramChatId
      ? Number(subscription.user.telegramChatId)
      : null;

    if (!chatId) {
      const resolved = await resolveTelegramChatId(handle);
      if (resolved) {
        chatId = resolved;
        await prisma.user.update({
          where: { id: subscription.user.id },
          data: { telegramChatId: String(resolved) }
        });
      }
    }

    if (!chatId) continue;

    await sendTelegramMessage(chatId, message);
  }
}
