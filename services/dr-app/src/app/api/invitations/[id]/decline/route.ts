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
    where: { id: params.id }
  });

  if (!invite || invite.userId !== session.user.id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status === "DECLINED") {
    return NextResponse.json({ message: "Invite already declined" });
  }

  await prisma.meetingInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED" }
  });

  return NextResponse.json({ message: "Invite declined" });
}
