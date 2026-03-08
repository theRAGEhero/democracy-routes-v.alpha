import { NextResponse } from "next/server";
import bcrypt from "@/lib/bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { changeEmailSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextEmail = parsed.data.email.trim();
  if (nextEmail === session.user.email) {
    return NextResponse.json({ error: "Email is unchanged" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: nextEmail },
    select: { id: true }
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true }
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: nextEmail }
  });

  return NextResponse.json({ message: "Email updated" });
}
