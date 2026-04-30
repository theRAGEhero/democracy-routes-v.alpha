import nodemailer from "nodemailer";
import { logError, logWarn } from "@/lib/logger";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
};

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM
};

function isSmtpConfigured() {
  return Boolean(
    smtpConfig.host &&
      smtpConfig.port &&
      smtpConfig.user &&
      smtpConfig.pass &&
      smtpConfig.from
  );
}

export async function sendMail({ to, subject, html, text, attachments }: MailPayload) {
  if (!isSmtpConfigured()) {
    logWarn("smtp_not_configured_skip_email", { to });
    return { ok: false, error: "SMTP not configured" };
  }

  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    },
    pool: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000
  });

  try {
    await transport.sendMail({
      from: smtpConfig.from,
      to,
      subject,
      html,
      text,
      attachments
    });

    return { ok: true };
  } catch (error) {
    logError("email_send_failed", error, { to, subject });
    return { ok: false, error: "Email send failed" };
  }
}
