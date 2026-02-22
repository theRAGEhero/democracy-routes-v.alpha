import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  if (dataspace.isPrivate && dataspace.personalOwnerId !== session.user.id) {
    return NextResponse.json({ error: "Dataspace is private" }, { status: 403 });
  }

  const existing = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: dataspace.id,
        userId: session.user.id
      }
    }
  });

  if (existing) {
    return NextResponse.json({ message: "Already joined" });
  }

  await prisma.dataspaceMember.create({
    data: {
      dataspaceId: dataspace.id,
      userId: session.user.id
    }
  });

  return NextResponse.json({ message: "Joined" });
}
