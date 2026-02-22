import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true }
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dataspaceId = body?.dataspaceId ?? null;

  if (dataspaceId) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!member) {
      return NextResponse.json({ error: "Invalid dataspace selection" }, { status: 403 });
    }
  }

  const text = await prisma.text.create({
    data: {
      createdById: user.id,
      dataspaceId
    },
    select: { id: true }
  });

  return NextResponse.json({ id: text.id });
}
