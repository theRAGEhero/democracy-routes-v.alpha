import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

const forgotSchema = z.object({
  email: z.string().trim().email("Invalid email")
});

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `forgot-password:${ip}`,
    limit: 6,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.isDeleted) {
    return NextResponse.json({ ok: true });
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: expiresAt
    }
  });

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
  const resetLink = `${appBaseUrl}/reset-password?token=${rawToken}`;
  const emailResult = await sendMail({
    to: user.email,
    subject: "Reset your password",
    html: `
      <p>We received a password reset request for your Democracy Routes account.</p>
      <p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
    text: `Reset your password: ${resetLink}`
  });

  return NextResponse.json({ ok: true, emailSent: emailResult.ok });
}
