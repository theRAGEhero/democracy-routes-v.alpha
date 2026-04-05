import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { maybeRunMeetingAiAgents } from "@/lib/meetingAiAgentRuntime";

type LiveLine = {
  id: string;
  text: string;
  time?: number;
  speaker?: number | string;
};

type TranscriptPayload = {
  contributions?: Array<{
    identifier: string;
    text: string;
    madeBy?: string;
  }>;
  participants?: Array<{
    identifier: string;
    name?: string;
  }>;
  liveLines?: LiveLine[];
};

function buildSpeakerId(speaker: number | string | undefined) {
  if (speaker === undefined || speaker === null) return "speaker";
  return `speaker-${speaker}`;
}

function buildSpeakerName(speaker: number | string | undefined) {
  if (speaker === undefined || speaker === null) return "Speaker";
  return `Speaker ${speaker}`;
}

function normalizeLineKey(line: LiveLine) {
  return `${line.speaker ?? "unknown"}::${line.time ?? "na"}::${line.text}`;
}

function extractSpeakerFromLabeledText(text: string) {
  const match = String(text || "").match(/^\[[^\]]+\]\s+([^:]+):\s/);
  return match?.[1]?.trim() || null;
}

function normalizeLiveLineSpeaker(line: LiveLine) {
  const rawSpeaker = line.speaker;
  const speakerText = typeof rawSpeaker === "string" ? rawSpeaker.trim() : rawSpeaker;
  const extracted = extractSpeakerFromLabeledText(line.text);
  if (
    typeof speakerText === "string" &&
    (/^speaker[_-]/i.test(speakerText) || /^peer[_-]/i.test(speakerText))
  ) {
    if (extracted) {
      return {
        ...line,
        speaker: extracted
      };
    }
  }
  if (
    (!speakerText || speakerText === "speaker") &&
    extracted
  ) {
    return {
      ...line,
      speaker: extracted
    };
  }
  return line;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const afterLineId = searchParams.get("after");
  const afterAgentId = searchParams.get("afterAgent");

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      transcript: true,
      members: { where: { userId: session.user.id } },
      aiAgentMessages: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              username: true,
              color: true
            }
          }
        },
        orderBy: { createdAt: "asc" },
        take: 50
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" ||
    meeting.members.length > 0 ||
    meeting.createdById === session.user.id;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!meeting.transcript?.transcriptJson) {
    return NextResponse.json({
      lines: [],
      agentMessages: (afterAgentId ? [] : meeting.aiAgentMessages).map((message) => ({
        id: message.id,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
        agent: {
          id: message.agent.id,
          name: message.agent.name,
          username: message.agent.username,
          color: message.agent.color
        }
      }))
    });
  }

  try {
    const payload = JSON.parse(meeting.transcript.transcriptJson) as TranscriptPayload;
    const allLines = Array.isArray(payload.liveLines)
      ? payload.liveLines.map(normalizeLiveLineSpeaker)
      : [];
    const lines =
      afterLineId && allLines.length
        ? (() => {
            const index = allLines.findIndex((line) => line.id === afterLineId);
            return index >= 0 ? allLines.slice(index + 1) : allLines;
          })()
        : allLines;
    const agentMessages =
      afterAgentId && meeting.aiAgentMessages.length
        ? (() => {
            const index = meeting.aiAgentMessages.findIndex((message) => message.id === afterAgentId);
            return index >= 0 ? meeting.aiAgentMessages.slice(index + 1) : meeting.aiAgentMessages;
          })()
        : meeting.aiAgentMessages;
    return NextResponse.json({
      lines,
      agentMessages: agentMessages.map((message) => ({
        id: message.id,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
        agent: {
          id: message.agent.id,
          name: message.agent.name,
          username: message.agent.username,
          color: message.agent.color
        }
      }))
    });
  } catch {
    return NextResponse.json({
      lines: [],
      agentMessages: (afterAgentId ? [] : meeting.aiAgentMessages).map((message) => ({
        id: message.id,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
        agent: {
          id: message.agent.id,
          name: message.agent.name,
          username: message.agent.username,
          color: message.agent.color
        }
      }))
    });
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

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: { members: { where: { userId: session.user.id } } }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" ||
    meeting.members.length > 0 ||
    meeting.createdById === session.user.id;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const speaker = body?.speaker;
  const time = typeof body?.time === "number" ? body.time : undefined;

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const newLine: LiveLine = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    speaker,
    time
  };

  const transcriptRecord = await prisma.meetingTranscript.findUnique({
    where: { meetingId: meeting.id }
  });

  let payload: TranscriptPayload = {};
  if (transcriptRecord?.transcriptJson) {
    try {
      payload = JSON.parse(transcriptRecord.transcriptJson) as TranscriptPayload;
    } catch {
      payload = {};
    }
  }

  const liveLines = Array.isArray(payload.liveLines) ? payload.liveLines : [];
  const existingKeys = new Set(liveLines.map((line) => normalizeLineKey(line)));
  const lineKey = normalizeLineKey(newLine);
  if (existingKeys.has(lineKey)) {
    return NextResponse.json({ status: "duplicate" });
  }

  const updatedLines = [...liveLines, newLine];
  const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
  const participants = Array.isArray(payload.participants) ? payload.participants : [];

  const speakerId = buildSpeakerId(speaker);
  const speakerName = buildSpeakerName(speaker);
  if (!participants.some((participant) => participant.identifier === speakerId)) {
    participants.push({ identifier: speakerId, name: speakerName });
  }

  contributions.push({
    identifier: newLine.id,
    text: newLine.text,
    madeBy: speakerId
  });

  const transcriptJson = JSON.stringify({
    ...payload,
    contributions,
    participants,
    liveLines: updatedLines
  });

  await prisma.meetingTranscript.upsert({
    where: { meetingId: meeting.id },
    update: {
      provider: meeting.transcriptionProvider,
      roundId: meeting.transcriptionRoundId ?? null,
      transcriptJson,
      transcriptText: [transcriptRecord?.transcriptText, newLine.text].filter(Boolean).join(" ").trim()
    },
    create: {
      meetingId: meeting.id,
      provider: meeting.transcriptionProvider,
      roundId: meeting.transcriptionRoundId ?? null,
      transcriptJson,
      transcriptText: newLine.text
    }
  });

  void maybeRunMeetingAiAgents(meeting.id).catch(() => null);

  return NextResponse.json({ status: "ok" });
}
