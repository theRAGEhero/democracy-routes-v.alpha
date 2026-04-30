import { prisma } from "@/lib/prisma";
import {
  normalizeTelegramHandle,
  resolveTelegramChatId,
  sendTelegramDocument,
  sendTelegramMessage
} from "@/lib/telegram";
import {
  buildMeetingInvitationIcs,
  buildMeetingInvitationIcsFilename
} from "@/lib/meetingCalendarInvite";

type InviteKind = "meeting" | "plan" | "dataspace";

type InviteRecipient = {
  id: string;
  telegramHandle?: string | null;
  telegramChatId?: string | null;
};

type MeetingInviteDetails = {
  title?: string | null;
  description?: string | null;
  scheduledStartAt?: Date | null;
  expiresAt?: Date | null;
  timezone?: string | null;
  language?: string | null;
  transcriptionProvider?: string | null;
  hostEmail?: string | null;
  inviteeName?: string | null;
  createdAt?: Date | null;
};

function formatDateTime(value: Date | null | undefined, timezone?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || "UTC"
    }).format(value);
  } catch {
    return value.toISOString();
  }
}

function buildInviteMessage(
  kind: InviteKind,
  title: string,
  link: string,
  details?: MeetingInviteDetails | null
) {
  const label =
    kind === "plan" ? "template" : kind === "dataspace" ? "dataspace" : "meeting";
  if (kind !== "meeting" || !details) {
    return `You are invited to the ${label} "${title}".\n${link}`;
  }

  const lines = [
    details.inviteeName ? `Hello ${details.inviteeName},` : "Hello,",
    "",
    `You are invited to the meeting "${title}".`
  ];

  const description = String(details.description || "").trim();
  if (description) {
    lines.push("", description);
  }

  const start = formatDateTime(details.scheduledStartAt, details.timezone);
  const expires = formatDateTime(details.expiresAt, details.timezone);
  if (start) lines.push("", `Starts: ${start}`);
  if (expires) lines.push(`Expires: ${expires}`);
  if (details.timezone) lines.push(`Timezone: ${details.timezone}`);
  if (details.language) lines.push(`Language: ${details.language}`);
  if (details.transcriptionProvider) lines.push(`Transcription: ${details.transcriptionProvider}`);
  if (details.hostEmail) lines.push(`Host: ${details.hostEmail}`);

  lines.push("", `Open meeting: ${link}`);
  lines.push("A calendar invite file is attached.");
  return lines.join("\n");
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
  link: string,
  details?: MeetingInviteDetails | null
) {
  if (!enabled || !process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, skipped: true as const };
  }

  const chatId = await getTelegramChatId(recipient);
  if (!chatId) {
    return { ok: false, skipped: true as const };
  }

  const messageResult = await sendTelegramMessage(chatId, buildInviteMessage(kind, title, link, details));
  if (!messageResult.ok || kind !== "meeting") {
    return messageResult;
  }

  const ics = buildMeetingInvitationIcs({
    uid: `${title}-${link}`,
    title,
    description: details?.description || null,
    scheduledStartAt: details?.scheduledStartAt || null,
    expiresAt: details?.expiresAt || null,
    timezone: details?.timezone || null,
    language: details?.language || null,
    transcriptionProvider: details?.transcriptionProvider || null,
    hostEmail: details?.hostEmail || null,
    accessUrl: link,
    inviteeName: details?.inviteeName || null,
    createdAt: details?.createdAt || null
  });
  const documentResult = await sendTelegramDocument(
    chatId,
    buildMeetingInvitationIcsFilename(title),
    ics,
    `Calendar invite for "${title}"`
  );

  if (!documentResult.ok) {
    return { ok: false, error: documentResult.error };
  }

  return { ok: true };
}
