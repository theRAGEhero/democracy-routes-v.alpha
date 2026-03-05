import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import crypto from "crypto";

function generateLinkCode() {
  return `DS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { id: true, personalOwnerId: true, createdById: true }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = generateLinkCode();

  await prisma.dataspace.update({
    where: { id: params.id },
    data: {
      telegramGroupLinkCode: code,
      telegramGroupChatId: null,
      telegramGroupLinkedAt: null
    }
  });

  return NextResponse.json({ code });
}
