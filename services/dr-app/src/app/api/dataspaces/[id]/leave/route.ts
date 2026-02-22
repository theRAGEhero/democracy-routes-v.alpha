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

  const membership = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    }
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { personalOwnerId: true }
  });

  if (dataspace?.personalOwnerId === session.user.id) {
    return NextResponse.json({ error: "Cannot leave your personal dataspace" }, { status: 403 });
  }

  await prisma.dataspaceMember.delete({
    where: { id: membership.id }
  });

  return NextResponse.json({ message: "Left dataspace" });
}
