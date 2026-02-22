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

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: true
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const membership = meeting.members.find(
    (member: (typeof meeting.members)[number]) => member.userId === session.user.id
  );
  if (membership?.role === "HOST") {
    return NextResponse.json({ error: "Host cannot leave the meeting" }, { status: 400 });
  }

  if (membership) {
    await prisma.meetingMember.delete({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId: session.user.id
        }
      }
    });
  }

  await prisma.meetingInvite.deleteMany({
    where: {
      meetingId: meeting.id,
      userId: session.user.id
    }
  });

  return NextResponse.json({ message: "Left meeting" });
}
