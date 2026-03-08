import { NextResponse } from "next/server";
import bcrypt from "@/lib/bcrypt";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { adminResetPasswordSchema } from "@/lib/validators";

export async function DELETE(
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

  if (session.user.id === params.id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (existing.isDeleted) {
    return NextResponse.json({ error: "User is deleted" }, { status: 400 });
  }
  if (existing.isDeleted) {
    return NextResponse.json({ message: "User already deleted" });
  }

  const tempPassword = crypto.randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      mustChangePassword: true,
      passwordHash,
      role: "USER"
    },
    select: { deletedAt: true }
  });

  return NextResponse.json({
    message: "User deleted",
    deletedAt: updated.deletedAt?.toISOString() ?? null
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (existing.isDeleted) {
    return NextResponse.json({ error: "User is deleted" }, { status: 400 });
  }
  if (existing.isDeleted) {
    return NextResponse.json({ error: "User is deleted" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.user.update({
    where: { id: params.id },
    data: {
      passwordHash,
      mustChangePassword: true
    }
  });

  return NextResponse.json({ message: "Password reset" });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;

  if (role !== "ADMIN" && role !== "USER") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (session.user.id === params.id && role !== "ADMIN") {
    return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { role }
  });

  return NextResponse.json({ message: "Role updated", role });
}
