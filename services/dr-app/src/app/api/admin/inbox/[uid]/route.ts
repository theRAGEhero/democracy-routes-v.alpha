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

function decodeQuotedPrintable(input: string) {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
}

function stripHtml(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractBodyFromSource(sourceText: string) {
  if (!sourceText) return "";

  const normalized = sourceText.replace(/\r\n/g, "\n");
  const parts = normalized.split(/\n\n/);
  if (parts.length < 2) return normalized.trim();

  const headerBlock = parts.shift() || "";
  let body = parts.join("\n\n").trim();
  const lowerHeaders = headerBlock.toLowerCase();

  if (lowerHeaders.includes("quoted-printable")) {
    body = decodeQuotedPrintable(body);
  }

  if (/<html[\s>]/i.test(body) || /content-type:\s*text\/html/i.test(lowerHeaders)) {
    body = stripHtml(body);
  }

  return body
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function GET(
  _request: Request,
  { params }: { params: { uid: string } }
) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uid = Number(params.uid);
  if (!Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ error: "Invalid uid" }, { status: 400 });
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
    auth: { user, pass }
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const message = await client.fetchOne(String(uid), {
      uid: true,
      envelope: true,
      flags: true,
      source: true,
      bodyStructure: true
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    let sourceText = "";
    if (message.source) {
      sourceText = Buffer.isBuffer(message.source)
        ? message.source.toString("utf8")
        : String(message.source);
    }

    const extractedBody = extractBodyFromSource(sourceText);

    return NextResponse.json({
      message: {
        uid: message.uid,
        subject: message.envelope?.subject ?? "(no subject)",
        from: formatAddressList(message.envelope?.from),
        to: formatAddressList(message.envelope?.to),
        date: message.envelope?.date ? message.envelope.date.toISOString() : null,
        seen: Array.isArray(message.flags) && message.flags.includes("\\Seen"),
        bodyText: extractedBody || sourceText || ""
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read message";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}
