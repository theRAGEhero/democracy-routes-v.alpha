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

  const invite = await prisma.meetingInvite.findUnique({
    where: { id: params.id },
    include: { meeting: true }
  });

  if (!invite || invite.userId !== session.user.id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status === "ACCEPTED") {
    return NextResponse.json({ message: "Invite already accepted" });
  }

  await prisma.meetingInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED" }
  });

  const existingMember = await prisma.meetingMember.findUnique({
    where: {
      meetingId_userId: {
        meetingId: invite.meetingId,
        userId: invite.userId
      }
    }
  });

  if (!existingMember) {
    await prisma.meetingMember.create({
      data: {
        meetingId: invite.meetingId,
        userId: invite.userId,
        role: "GUEST"
      }
    });
  }

  return NextResponse.json({ message: "Invite accepted" });
}
