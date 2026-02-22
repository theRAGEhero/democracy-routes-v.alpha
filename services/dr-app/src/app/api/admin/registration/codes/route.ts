import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await prisma.registrationCode.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, enabled: true, createdAt: true }
  });

  return NextResponse.json({ codes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const existing = await prisma.registrationCode.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Code already exists" }, { status: 400 });
  }

  const created = await prisma.registrationCode.create({
    data: { code, enabled: true },
    select: { id: true, code: true, enabled: true, createdAt: true }
  });

  return NextResponse.json({ code: created });
}
