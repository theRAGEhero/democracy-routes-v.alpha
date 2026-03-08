import { NextResponse } from "next/server";
import bcrypt from "@/lib/bcrypt";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(12, "Minimum 12 characters"),
    confirmPassword: z.string().min(12, "Minimum 12 characters")
  })
  .refine((data) => /[a-zA-Z]/.test(data.password), {
    message: "Password must include letters",
    path: ["password"]
  })
  .refine((data) => /[0-9]/.test(data.password), {
    message: "Password must include a number",
    path: ["password"]
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit({
    key: `reset-password:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash
    }
  });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetExpiresAt: null
    }
  });

  return NextResponse.json({ ok: true });
}
