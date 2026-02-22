import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ImapFlow } from "imapflow";

function parseBool(value: string | undefined) {
  return value === "true" || value === "1";
}

function formatAddressList(list: Array<{ name?: string; address?: string }> | undefined) {
  if (!list || list.length === 0) return "";
  return list
    .map((entry) => {
      if (entry.name && entry.address) return `${entry.name} <${entry.address}>`;
      return entry.address ?? entry.name ?? "";
    })
    .filter(Boolean)
    .join(", ");
}

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const host = process.env.IMAP_HOST;
  const port = process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993;
  const secure = parseBool(process.env.IMAP_SECURE);
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "IMAP is not configured" }, { status: 500 });
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX");
    const total = mailbox.exists ?? 0;
    const limit = 25;
    const start = Math.max(1, total - limit + 1);

    const messages: Array<{
      uid: number;
      subject: string;
      from: string;
      to: string;
      date: string | null;
      seen: boolean;
    }> = [];

    let unreadCount = 0;
    if (total > 0) {
      for await (const message of client.fetch(`${start}:${total}`, {
        envelope: true,
        flags: true,
        uid: true
      })) {
        const seen = Array.isArray(message.flags) && message.flags.includes("\\Seen");
        if (!seen) unreadCount += 1;
        messages.push({
          uid: message.uid,
          subject: message.envelope?.subject ?? "(no subject)",
          from: formatAddressList(message.envelope?.from),
          to: formatAddressList(message.envelope?.to),
          date: message.envelope?.date ? message.envelope.date.toISOString() : null,
          seen
        });
      }
    }

    messages.sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;
      return bDate - aDate;
    });

    return NextResponse.json({ messages, total, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read inbox";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
}
