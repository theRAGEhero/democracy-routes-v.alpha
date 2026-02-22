import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; inviteId: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: { members: true }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some(
    (member: (typeof meeting.members)[number]) =>
      member.userId === session.user.id && member.role === "HOST"
  );

  if (!isAdmin && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.meetingInvite.findUnique({
    where: { id: params.inviteId }
  });

  if (!invite || invite.meetingId !== meeting.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await prisma.meetingInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED" }
  });

  return NextResponse.json({ message: "Request declined" });
}
