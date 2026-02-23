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
      transcript: true,
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" || meeting.members.length > 0 || meeting.createdById === session.user.id;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingJob = await prisma.transcriptionJob.findFirst({
    where: { meetingId: meeting.id, kind: "MEETING" }
  });

  if (meeting.transcript?.transcriptJson) {
    try {
      const cached = JSON.parse(meeting.transcript.transcriptJson);
      return NextResponse.json({
        transcription: cached,
        roundId: meeting.transcript.roundId ?? meeting.transcriptionRoundId,
        provider: meeting.transcript.provider,
        source: "db"
      });
    } catch {
      // invalid cached payload: fall through to not-found
    }
  }

  if (existingJob) {
    await prisma.transcriptionJob.update({
      where: { id: existingJob.id },
      data: {
        status: "FAILED",
        provider: "TRANSCRIPTION_HUB",
        roundId: null,
        lastAttemptAt: new Date(),
        lastError: "Transcription not found in database"
      }
    });
  }

  const requestUrl = new URL(request.url);
  const auto = String(requestUrl.searchParams.get("auto") || "").toLowerCase();
  const autoRequested = auto === "1" || auto === "true" || auto === "yes";
  if (autoRequested) {
    return NextResponse.json({
      transcription: null,
      roundId: meeting.transcriptionRoundId ?? null,
      provider: null,
      source: "none"
    });
  }

  return NextResponse.json({ error: "Transcription not found in database" }, { status: 404 });
}
