import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
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

export async function sendMail({ to, subject, html, text }: MailPayload) {
  if (!isSmtpConfigured()) {
    console.warn("SMTP not configured. Skipping email to", to);
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
      text
    });

    return { ok: true };
  } catch (error) {
    console.error("Email send failed", error);
    return { ok: false, error: "Email send failed" };
  }
}
