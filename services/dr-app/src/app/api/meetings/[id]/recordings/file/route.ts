import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function getDrVideoBase() {
  return String(process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

function normalizeRoomId(value: string) {
  return String(value || "").trim().toLowerCase();
}

async function canAccessMeeting(meetingId: string, userId: string, role?: string | null) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      members: { where: { userId }, select: { id: true } },
      dataspace: { include: { members: { where: { userId }, select: { id: true } } } }
    }
  });

  if (!meeting) {
    return { ok: false as const, status: 404, error: "Meeting not found" };
  }

  const isAdmin = role === "ADMIN";
  const isMember = meeting.members.length > 0 || meeting.createdById === userId;
  const isDataspaceMember = meeting.dataspace ? meeting.dataspace.members.length > 0 : false;
  const allowed = isAdmin || isMember || (meeting.isPublic && isDataspaceMember);

  if (!allowed) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, meeting };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canAccessMeeting(params.id, session.user.id, session.user.role);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const requestUrl = new URL(request.url);
  const sessionId = String(requestUrl.searchParams.get("sessionId") || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const upstream = await fetch(
    `${getDrVideoBase()}/api/recordings/file?roomId=${encodeURIComponent(
      normalizeRoomId(access.meeting.roomId)
    )}&sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "video/webm");
  headers.set("Cache-Control", "private, max-age=60");
  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  const contentDisposition = upstream.headers.get("Content-Disposition");
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}
