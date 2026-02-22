import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : null;
  const dataspaceId = body?.dataspaceId ?? null;

  const existing = await prisma.text.findUnique({
    where: { id: params.id },
    select: { createdById: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Text not found" }, { status: 404 });
  }
  if (existing.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const updated = await prisma.text.update({
    where: { id: params.id },
    data: {
      content: content ?? undefined,
      dataspaceId
    },
    select: { id: true }
  });

  return NextResponse.json({ id: updated.id });
}
