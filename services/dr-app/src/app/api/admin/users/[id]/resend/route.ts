import { NextResponse } from "next/server";
import bcrypt from "@/lib/bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateTempPassword } from "@/lib/utils";
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

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: params.id },
    data: {
      passwordHash,
      mustChangePassword: true
    }
  });

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const emailResult = await sendMail({
    to: user.email,
    subject: "Your account is ready",
    html: `<p>Your account is ready.</p>
      <p>Email: ${user.email}</p>
      <p>Temporary password: <strong>${tempPassword}</strong></p>
      <p>Login here: <a href="${appBaseUrl}/login">${appBaseUrl}/login</a></p>
      <p>At first login you will be asked to change your password.</p>`,
    text: `Your account is ready. Email: ${user.email}. Temporary password: ${tempPassword}. Login: ${appBaseUrl}/login. At first login you will be asked to change your password.`
  });

  return NextResponse.json({
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error
  });
}
