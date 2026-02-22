import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some(
    (member: (typeof meeting.members)[number]) => member.role === "HOST"
  );
  if (!isAdmin && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ users: [] });
  }

  const memberIds = await prisma.meetingMember.findMany({
    where: { meetingId: meeting.id },
    select: { userId: true }
  });

  const excludeIds = memberIds.map(
    (member: (typeof memberIds)[number]) => member.userId
  );

  const users = await prisma.user.findMany({
    where: {
      email: { contains: query },
      id: { notIn: excludeIds }
    },
    orderBy: { email: "asc" },
    take: 8,
    select: { id: true, email: true }
  });

  return NextResponse.json({ users });
}
