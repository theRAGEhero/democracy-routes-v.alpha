import { NextResponse } from "next/server";
import bcrypt from "@/lib/bcrypt";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `register:${ip}`,
    limit: 8,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings =
    (await prisma.registrationSettings.findFirst()) ??
    (await prisma.registrationSettings.create({ data: {} }));

  if (!settings.registrationOpen) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 403 });
  }

  const code = parsed.data.code?.trim() || "";
  if (settings.requireCode) {
    if (!code) {
      return NextResponse.json({ error: "Registration code required" }, { status: 400 });
    }
    const validCode = await prisma.registrationCode.findFirst({
      where: { code, enabled: true }
    });
    if (!validCode) {
      return NextResponse.json({ error: "Invalid registration code" }, { status: 400 });
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const requireEmailConfirmation = settings.requireEmailConfirmation;
  const verificationToken = requireEmailConfirmation
    ? crypto.randomBytes(32).toString("base64url")
    : null;
  const verificationExpiresAt = requireEmailConfirmation
    ? new Date(Date.now() + 1000 * 60 * 60 * 24)
    : null;

  const user = existing
    ? existing.isGuest
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: "USER",
            isGuest: false,
            privacyPolicyAccepted: true,
            mustChangePassword: false,
            emailVerifiedAt: requireEmailConfirmation ? null : new Date(),
            emailVerificationToken: verificationToken,
            emailVerificationExpiresAt: verificationExpiresAt
          }
        })
      : null
    : await prisma.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
          role: "USER",
          isGuest: false,
          privacyPolicyAccepted: true,
          mustChangePassword: false,
          emailVerifiedAt: requireEmailConfirmation ? null : new Date(),
          emailVerificationToken: verificationToken,
          emailVerificationExpiresAt: verificationExpiresAt
        }
      });

  if (!user) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  if (requireEmailConfirmation && verificationToken) {
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
    const activationLink = `${appBaseUrl}/activate?token=${verificationToken}`;
    const emailResult = await sendMail({
      to: user.email,
      subject: "Confirm your account",
      html: `
        <p>Your Democracy Routes account is almost ready.</p>
        <p>Click to activate: <a href="${activationLink}">${activationLink}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
      text: `Confirm your account: ${activationLink}`
    });

    return NextResponse.json({
      id: user.id,
      verificationRequired: true,
      emailSent: emailResult.ok
    });
  }

  return NextResponse.json({ id: user.id, verificationRequired: false });
}
