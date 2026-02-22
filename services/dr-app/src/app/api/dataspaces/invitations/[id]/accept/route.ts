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

  const invite = await prisma.dataspaceInvite.findUnique({
    where: { id: params.id },
    include: { dataspace: true }
  });

  if (!invite || invite.userId !== session.user.id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status === "ACCEPTED") {
    return NextResponse.json({ message: "Invite already accepted" });
  }

  await prisma.dataspaceInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED" }
  });

  const existingMember = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: invite.dataspaceId,
        userId: invite.userId
      }
    }
  });

  if (!existingMember) {
    await prisma.dataspaceMember.create({
      data: {
        dataspaceId: invite.dataspaceId,
        userId: invite.userId
      }
    });
  }

  return NextResponse.json({ message: "Invite accepted" });
}
