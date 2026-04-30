import {
  buildMeetingInvitationIcs,
  buildMeetingInvitationIcsFilename
} from "@/lib/meetingCalendarInvite";

type MeetingInviteEmailArgs = {
  inviteKind: "registered" | "guest";
  meeting: {
    title: string;
    description?: string | null;
    scheduledStartAt?: Date | null;
    expiresAt?: Date | null;
    timezone?: string | null;
    language?: string | null;
    transcriptionProvider?: string | null;
    createdBy?: { email?: string | null } | null;
    createdAt?: Date | null;
  };
  accessUrl: string;
  registerUrl?: string | null;
  inviteeName?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function buildInfoRows(args: MeetingInviteEmailArgs) {
  const rows: Array<{ label: string; value: string }> = [];
  const start = formatDateTime(args.meeting.scheduledStartAt, args.meeting.timezone);
  const expires = formatDateTime(args.meeting.expiresAt, args.meeting.timezone);
  if (start) rows.push({ label: "Starts", value: start });
  if (expires) rows.push({ label: "Expires", value: expires });
  if (args.meeting.timezone) rows.push({ label: "Timezone", value: args.meeting.timezone });
  if (args.meeting.language) rows.push({ label: "Language", value: args.meeting.language });
  if (args.meeting.transcriptionProvider) {
    rows.push({ label: "Transcription", value: args.meeting.transcriptionProvider });
  }
  if (args.meeting.createdBy?.email) rows.push({ label: "Host", value: args.meeting.createdBy.email });
  return rows;
}

export function buildMeetingInviteEmail(args: MeetingInviteEmailArgs) {
  const greetingName = String(args.inviteeName || "").trim();
  const title = args.meeting.title || "Meeting";
  const description = String(args.meeting.description || "").trim();
  const details = buildInfoRows(args);
  const primaryLabel =
    args.inviteKind === "guest" ? "Join the meeting without registration" : "Open meeting";
  const secondaryLine =
    args.inviteKind === "guest" && args.registerUrl
      ? `Prefer an account? Register first: ${args.registerUrl}`
      : null;

  const detailsHtml =
    details.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;border-collapse:collapse;">
          ${details
            .map(
              (item) => `<tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">${escapeHtml(item.label)}</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;vertical-align:top;text-align:right;">${escapeHtml(item.value)}</td>
              </tr>`
            )
            .join("")}
        </table>`
      : "";

  const html =
    `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">Democracy Routes</div>
        <h1 style="margin:14px 0 0;font-size:28px;line-height:1.15;">${escapeHtml(title)}</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#334155;">
          ${greetingName ? `Hello ${escapeHtml(greetingName)}, ` : ""}you have been invited to join this meeting.
        </p>
        ${
          description
            ? `<div style="margin-top:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;font-size:14px;line-height:1.7;color:#334155;">${escapeHtml(description)}</div>`
            : ""
        }
        ${detailsHtml}
        <div style="margin-top:24px;">
          <a href="${escapeHtml(args.accessUrl)}" style="display:inline-block;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:700;">${escapeHtml(primaryLabel)}</a>
        </div>
        <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#475569;">
          <div>Direct link: <a href="${escapeHtml(args.accessUrl)}" style="color:#0f172a;">${escapeHtml(args.accessUrl)}</a></div>
          <div style="margin-top:6px;">A calendar invite (.ics) is attached to this email.</div>
          ${secondaryLine ? `<div style="margin-top:6px;">${escapeHtml(secondaryLine)}</div>` : ""}
        </div>
      </div>
    </div>
  </body>
</html>`;

  const lines = [
    greetingName ? `Hello ${greetingName},` : "Hello,",
    "",
    `You have been invited to the meeting ${title}.`,
    description ? "" : "",
    description || "",
    ...details.map((item) => `${item.label}: ${item.value}`),
    "",
    `${primaryLabel}: ${args.accessUrl}`,
    "Calendar invite (.ics) attached.",
    secondaryLine || ""
  ].filter(Boolean);

  return {
    subject: `Invitation: ${title}`,
    html,
    text: lines.join("\n"),
    attachments: [
      {
        filename: buildMeetingInvitationIcsFilename(title),
        content: buildMeetingInvitationIcs({
          uid: `${title}-${args.accessUrl}`,
          title,
          description: description || null,
          scheduledStartAt: args.meeting.scheduledStartAt,
          expiresAt: args.meeting.expiresAt,
          timezone: args.meeting.timezone,
          language: args.meeting.language,
          transcriptionProvider: args.meeting.transcriptionProvider,
          hostEmail: args.meeting.createdBy?.email || null,
          accessUrl: args.accessUrl,
          inviteeName: args.inviteeName || null,
          createdAt: args.meeting.createdAt || null
        }),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH"
      }
    ]
  };
}
