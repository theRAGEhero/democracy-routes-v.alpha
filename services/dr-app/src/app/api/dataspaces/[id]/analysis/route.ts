import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const analysisSchema = z.object({
  prompt: z.string().min(1).max(5000),
  provider: z.enum(["gemini", "ollama"]).optional()
});

function extractTranscriptText(raw: string | null) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const fromTopLevel = parsed?.contributions;
    const fromDeliberation = parsed?.deliberation?.contributions;
    const contributions = Array.isArray(fromTopLevel)
      ? fromTopLevel
      : Array.isArray(fromDeliberation)
        ? fromDeliberation
        : [];
    return contributions
      .map((entry: any) => entry?.text)
      .filter((text: any) => typeof text === "string")
      .join(" ");
  } catch {
    return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = analysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: { select: { id: true, email: true } } } },
      plans: { select: { id: true, title: true } },
      meetings: {
        select: {
          id: true,
          title: true,
          createdAt: true,
          transcript: { select: { transcriptText: true, transcriptJson: true } },
          members: { include: { user: { select: { email: true } } } },
          createdBy: { select: { email: true } }
        }
      },
      texts: {
        select: {
          id: true,
          content: true,
          createdBy: { select: { email: true } }
        }
      }
    }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isMember = dataspace.members.some(
    (member: (typeof dataspace.members)[number]) => member.userId === session.user.id
  );
  if (!isAdmin && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const planIds = dataspace.plans.map((plan) => plan.id);
  const [textEntries, meditationSessions, recordSessions, planPairs] = await Promise.all([
    planIds.length
      ? prisma.planTextEntry.findMany({
          where: { planId: { in: planIds } },
          select: {
            blockId: true,
            content: true,
            user: { select: { email: true } }
          }
        })
      : [],
    planIds.length
      ? prisma.planMeditationSession.findMany({
          where: { planId: { in: planIds } },
          select: {
            meditationIndex: true,
            roundAfter: true,
            transcriptText: true,
            createdAt: true,
            user: { select: { email: true } }
          },
          orderBy: { createdAt: "asc" }
        })
      : [],
    planIds.length
      ? prisma.planRecordSession.findMany({
          where: { planId: { in: planIds } },
          select: {
            id: true,
            transcriptText: true,
            user: { select: { email: true } }
          }
        })
      : [],
    planIds.length
      ? prisma.planPair.findMany({
          where: { planRound: { planId: { in: planIds } }, meetingId: { not: null } },
          select: {
            meetingId: true,
            planRound: { select: { roundNumber: true } },
            userA: { select: { email: true } },
            userB: { select: { email: true } }
          }
        })
      : []
  ]);

  const meetingTranscriptMap = new Map<
    string,
    { meetingId: string; roundNumber: number; participants: string[]; transcriptText: string }
  >();

  dataspace.meetings.forEach((meeting: (typeof dataspace.meetings)[number]) => {
    const text =
      meeting.transcript?.transcriptText?.trim() ||
      extractTranscriptText(meeting.transcript?.transcriptJson ?? null);
    if (!text) return;
    const participants = [
      meeting.createdBy?.email ?? null,
      ...meeting.members.map((member) => member.user.email)
    ].filter(Boolean) as string[];
    meetingTranscriptMap.set(meeting.id, {
      meetingId: meeting.id,
      roundNumber: 0,
      participants: Array.from(new Set(participants)),
      transcriptText: text
    });
  });

  const pairMeetings = planPairs
    .filter((pair) => pair.meetingId)
    .map((pair) => ({
      meetingId: pair.meetingId as string,
      roundNumber: pair.planRound.roundNumber,
      participants: [pair.userA?.email, pair.userB?.email].filter(Boolean) as string[]
    }));
  const pairMeetingIds = Array.from(new Set(pairMeetings.map((pair) => pair.meetingId)));
  const pairTranscripts = pairMeetingIds.length
    ? await prisma.meetingTranscript.findMany({
        where: { meetingId: { in: pairMeetingIds } },
        select: { meetingId: true, transcriptText: true, transcriptJson: true }
      })
    : [];

  pairMeetings.forEach((pair) => {
    if (meetingTranscriptMap.has(pair.meetingId)) return;
    const transcript = pairTranscripts.find((item) => item.meetingId === pair.meetingId);
    const text =
      transcript?.transcriptText?.trim() ||
      extractTranscriptText(transcript?.transcriptJson ?? null);
    if (!text) return;
    meetingTranscriptMap.set(pair.meetingId, {
      meetingId: pair.meetingId,
      roundNumber: pair.roundNumber,
      participants: pair.participants,
      transcriptText: text
    });
  });

  const recap = {
    textEntries: [
      ...textEntries.map((entry: (typeof textEntries)[number]) => ({
        blockId: entry.blockId,
        content: entry.content,
        userEmail: entry.user.email
      })),
      ...dataspace.texts.map((text: (typeof dataspace.texts)[number]) => ({
        blockId: `dataspace-text:${text.id}`,
        content: text.content,
        userEmail: text.createdBy.email
      })),
      ...recordSessions.map((session: (typeof recordSessions)[number]) => ({
        blockId: `record:${session.id}`,
        content: session.transcriptText ?? "",
        userEmail: session.user.email
      }))
    ].filter((entry) => entry.content && entry.content.trim().length > 0),
    meditationSessions: meditationSessions.map(
      (session: (typeof meditationSessions)[number]) => ({
        meditationIndex: session.meditationIndex,
        roundAfter: session.roundAfter,
        transcriptText: session.transcriptText ?? "",
        userEmail: session.user.email,
        createdAt: session.createdAt.toISOString()
      })
    ),
    meetingTranscripts: Array.from(meetingTranscriptMap.values()),
    participants: dataspace.members.map((member) => member.user.email)
  };

  if (
    recap.textEntries.length === 0 &&
    recap.meditationSessions.length === 0 &&
    recap.meetingTranscripts.length === 0
  ) {
    return NextResponse.json({ error: "No dataspace activity to analyze." }, { status: 400 });
  }

  const baseUrl = process.env.ANALYZE_TABLES_API_URL || "http://localhost:3001";
  const apiKey = process.env.ANALYZE_TABLES_API_KEY;
  const provider = parsed.data.provider ?? "gemini";

  const response = await fetch(`${baseUrl}/api/plan-analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({
      plan: {
        id: dataspace.id,
        title: dataspace.name,
        startAt: dataspace.createdAt.toISOString(),
        timezone: null,
        roundsCount: dataspace.plans.length,
        roundDurationMinutes: 0,
        language: "MIXED",
        transcriptionProvider: "MIXED"
      },
      recap,
      prompt: parsed.data.prompt,
      provider
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Failed to analyze dataspace", details: errorData },
      { status: response.status }
    );
  }

  const payload = await response.json();
  return NextResponse.json({
    analysis: payload.analysis,
    createdAt: payload.timestamp ?? new Date().toISOString(),
    provider
  });
}
