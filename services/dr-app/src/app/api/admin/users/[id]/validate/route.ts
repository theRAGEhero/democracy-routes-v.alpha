import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.isDeleted) {
    return NextResponse.json({ error: "User is deleted" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null
    },
    select: { emailVerifiedAt: true }
  });

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const emailResult = await sendMail({
    to: user.email,
    subject: "Welcome to Democracy Routes",
    html: `<p>Your account has been approved.</p>
      <p>Login here: <a href="${appBaseUrl}/login">${appBaseUrl}/login</a></p>`,
    text: `Your account has been approved. Login: ${appBaseUrl}/login`
  });

  return NextResponse.json({
    verifiedAt: updated.emailVerifiedAt?.toISOString() ?? null,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error
  });
}
