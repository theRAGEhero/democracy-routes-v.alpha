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

  const settings =
    (await prisma.registrationSettings.findFirst()) ??
    (await prisma.registrationSettings.create({ data: {} }));

  return NextResponse.json({
    registrationOpen: settings.registrationOpen,
    requireCode: settings.requireCode,
    requireEmailConfirmation: settings.requireEmailConfirmation
  });
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
  const registrationOpen = Boolean(body?.registrationOpen);
  const requireCode = Boolean(body?.requireCode);
  const requireEmailConfirmation = Boolean(body?.requireEmailConfirmation);

  const existing =
    (await prisma.registrationSettings.findFirst()) ??
    (await prisma.registrationSettings.create({ data: {} }));

  const settings = await prisma.registrationSettings.update({
    where: { id: existing.id },
    data: { registrationOpen, requireCode, requireEmailConfirmation }
  });

  return NextResponse.json({
    registrationOpen: settings.registrationOpen,
    requireCode: settings.requireCode,
    requireEmailConfirmation: settings.requireEmailConfirmation
  });
}
