import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RouteContext = {
  params: {
    id: string;
  };
};

type IncomingStat = {
  participantKey?: string;
  participantName?: string;
  voiceActivityMs?: number;
};

async function loadMeetingForUser(meetingId: string, userId: string, role: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      members: { where: { userId } }
    }
  });

  if (!meeting) {
    return { error: NextResponse.json({ error: "Meeting not found" }, { status: 404 }) };
  }

  const canAccess =
    role === "ADMIN" ||
    meeting.createdById === userId ||
    meeting.members.length > 0;

  if (!canAccess) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { meeting };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loaded = await loadMeetingForUser(params.id, session.user.id, session.user.role);
  if ("error" in loaded) return loaded.error;

  const stats = await prisma.meetingParticipationStat.findMany({
    where: { meetingId: params.id },
    orderBy: [{ voiceActivityMs: "desc" }, { participantName: "asc" }]
  });

  const totalVoiceActivityMs = stats.reduce((sum, item) => sum + Math.max(0, item.voiceActivityMs || 0), 0);

  return NextResponse.json({
    totalVoiceActivityMs,
    participants: stats.map((item) => ({
      id: item.id,
      participantKey: item.participantKey,
      participantName: item.participantName,
      voiceActivityMs: item.voiceActivityMs,
      updatedAt: item.updatedAt.toISOString()
    }))
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loaded = await loadMeetingForUser(params.id, session.user.id, session.user.role);
  if ("error" in loaded) return loaded.error;

  const body = await request.json().catch(() => null);
  const participants = Array.isArray(body?.participants) ? (body.participants as IncomingStat[]) : [];

  const normalized = participants
    .map((item) => ({
      participantKey: String(item?.participantKey || "").trim(),
      participantName: String(item?.participantName || "").trim(),
      voiceActivityMs: Math.max(0, Math.round(Number(item?.voiceActivityMs) || 0))
    }))
    .filter((item) => item.participantKey && item.participantName);

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No participation stats provided" }, { status: 400 });
  }

  await prisma.$transaction(
    normalized.map((item) =>
      prisma.meetingParticipationStat.upsert({
        where: {
          meetingId_participantKey: {
            meetingId: params.id,
            participantKey: item.participantKey
          }
        },
        update: {
          participantName: item.participantName,
          voiceActivityMs: item.voiceActivityMs
        },
        create: {
          meetingId: params.id,
          participantKey: item.participantKey,
          participantName: item.participantName,
          voiceActivityMs: item.voiceActivityMs
        }
      })
    )
  );

  return NextResponse.json({ status: "ok", count: normalized.length });
}
