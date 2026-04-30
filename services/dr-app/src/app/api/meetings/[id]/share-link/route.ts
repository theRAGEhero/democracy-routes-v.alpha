import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

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
      members: {
        where: { userId: session.user.id }
      },
      dataspace: {
        include: { members: { select: { userId: true } } }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some((member) => member.role === "HOST");
  const isDataspaceMember = meeting.dataspace
    ? meeting.dataspace.members.some((member) => member.userId === session.user.id)
    : false;

  if (!isAdmin && !isHost && !(meeting.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shareLink = await prisma.meetingShareLink.upsert({
    where: { meetingId: meeting.id },
    update: {
      expiresAt: meeting.expiresAt ?? null
    },
    create: {
      meetingId: meeting.id,
      token: generateToken(),
      expiresAt: meeting.expiresAt ?? null
    }
  });

  const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return NextResponse.json({
    shareUrl: `${appBaseUrl}/share/meetings/${shareLink.token}`
  });
}
