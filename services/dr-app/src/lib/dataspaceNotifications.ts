import { prisma } from "@/lib/prisma";
import { normalizeTelegramHandle, resolveTelegramChatId, sendTelegramMessage } from "@/lib/telegram";

type NotifyPayload = {
  dataspaceId: string;
  title: string;
  link: string;
  type: "MEETING" | "PLAN" | "NOTES";
};

export async function notifyDataspaceSubscribers({
  dataspaceId,
  title,
  link,
  type
}: NotifyPayload) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: dataspaceId },
    select: {
      id: true,
      notifyAllActivity: true,
      notifyMeetings: true,
      notifyPlans: true,
      notifyTexts: true,
      telegramGroupChatId: true
    }
  });

  if (!dataspace) return;

  const allowedBySpace =
    dataspace.notifyAllActivity ||
    (type === "MEETING" && dataspace.notifyMeetings) ||
    (type === "PLAN" && dataspace.notifyPlans) ||
    (type === "NOTES" && dataspace.notifyTexts);

  if (!allowedBySpace) return;

  const subscribers = await prisma.dataspaceSubscription.findMany({
    where: { dataspaceId },
    include: {
      user: {
        select: {
          id: true,
          telegramHandle: true,
          telegramChatId: true,
          notifyTelegramDataspaceActivity: true
        }
      }
    }
  });

  if (subscribers.length === 0 && !dataspace.telegramGroupChatId) return;

  const label = type === "PLAN" ? "Template" : type === "NOTES" ? "Text" : "Meeting";
  const message = `${label} created: ${title}\n${link}`;

  if (dataspace.telegramGroupChatId) {
    await sendTelegramMessage(Number(dataspace.telegramGroupChatId), message);
  }

  for (const subscription of subscribers) {
    if (!subscription.user.notifyTelegramDataspaceActivity) continue;
    const allowedByUser =
      subscription.notifyAllActivity ||
      (type === "MEETING" && subscription.notifyMeetings) ||
      (type === "PLAN" && subscription.notifyPlans) ||
      (type === "NOTES" && subscription.notifyTexts);
    if (!allowedByUser) continue;
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
