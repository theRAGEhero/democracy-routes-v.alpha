type MeetingCalendarInviteArgs = {
  uid?: string | null;
  title: string;
  description?: string | null;
  scheduledStartAt?: Date | null;
  expiresAt?: Date | null;
  timezone?: string | null;
  language?: string | null;
  transcriptionProvider?: string | null;
  hostEmail?: string | null;
  accessUrl: string;
  inviteeName?: string | null;
  createdAt?: Date | null;
};

function escapeIcsText(value: string) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatUtcIcs(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

export function buildMeetingInvitationIcs(args: MeetingCalendarInviteArgs) {
  const uid = String(args.uid || `meeting-${Date.now()}@democracyroutes.com`);
  const dtStamp = formatUtcIcs(new Date());
  const start = args.scheduledStartAt || args.createdAt || new Date();
  const end =
    args.expiresAt ||
    (args.scheduledStartAt ? new Date(args.scheduledStartAt.getTime() + 60 * 60 * 1000) : new Date(start.getTime() + 60 * 60 * 1000));

  const descriptionLines = [
    args.description ? String(args.description).trim() : null,
    `Join link: ${args.accessUrl}`,
    args.hostEmail ? `Host: ${args.hostEmail}` : null,
    args.timezone ? `Timezone: ${args.timezone}` : null,
    args.language ? `Language: ${args.language}` : null,
    args.transcriptionProvider ? `Transcription: ${args.transcriptionProvider}` : null,
    !args.scheduledStartAt ? "Start time was not explicitly scheduled when this invite was generated." : null
  ].filter(Boolean) as string[];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Democracy Routes//Meeting Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatUtcIcs(start)}`,
    `DTEND:${formatUtcIcs(end)}`,
    `SUMMARY:${escapeIcsText(args.title || "Meeting")}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
    `URL:${escapeIcsText(args.accessUrl)}`,
    args.hostEmail ? `ORGANIZER:mailto:${escapeIcsText(args.hostEmail)}` : null,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean) as string[];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function buildMeetingInvitationIcsFilename(title: string) {
  const base = String(title || "meeting")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "meeting";
  return `${base}.ics`;
}
