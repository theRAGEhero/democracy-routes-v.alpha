import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { importExistingDrVideoTranscriptForMeeting } from "@/lib/meetingTranscription";
import {
  buildMeetingTranscriptJsonExport,
  buildMeetingTranscriptOntologyExport,
  buildMeetingTranscriptTextExport
} from "@/lib/meetingTranscriptExport";

function sanitizeFilename(value: string) {
  return String(value || "meeting-transcript")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "meeting-transcript";
}

async function canAccessMeeting(meetingId: string, userId: string, role?: string | null) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
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

  if (!meeting.transcript) {
    return { ok: false as const, status: 404, error: "Transcript not found" };
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

  let access = await canAccessMeeting(params.id, session.user.id, session.user.role);
  if (!access.ok && access.status === 404 && access.error === "Transcript not found") {
    await importExistingDrVideoTranscriptForMeeting(params.id).catch(() => null);
    access = await canAccessMeeting(params.id, session.user.id, session.user.role);
  }
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const format = String(searchParams.get("format") || "json").trim().toLowerCase();
  const meeting = access.meeting;
  const transcript = meeting.transcript;
  if (!transcript) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }
  const baseName = sanitizeFilename(meeting.title || `meeting-${meeting.id}`);

  if (format === "txt") {
    const body = buildMeetingTranscriptTextExport(meeting, transcript);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${baseName}-transcript.txt\"`
      }
    });
  }

  const payload =
    format === "ontology"
      ? buildMeetingTranscriptOntologyExport(meeting, transcript)
      : buildMeetingTranscriptJsonExport(meeting, transcript);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${baseName}-${format === "ontology" ? "ontology" : "transcript"}.json\"`
    }
  });
}
