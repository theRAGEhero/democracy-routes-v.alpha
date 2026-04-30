import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { maybeRunMeetingAiAgents } from "@/lib/meetingAiAgentRuntime";
import {
  appendChatMessageToTranscriptPayload,
  formatChatMessageForTranscriptText,
  mergeTranscriptContext
} from "@/lib/meetingTranscriptContext";

type TranscriptionStatusPayload = {
  state: string;
  label: string;
  detail: string;
  lastChunkAt?: string | null;
  lastTranscriptAt?: string | null;
  pendingFinalizeCount?: number;
  retryingFinalizeCount?: number;
  nextRetryAt?: string | null;
  lastError?: string | null;
};

type ChatMessage = {
  ts: string;
  peerId: string;
  name: string;
  text: string;
};

type LiveLine = {
  id: string;
  text: string;
  time?: number;
  speaker?: number | string;
  speakerId?: string;
  speakerName?: string;
  mappedPeerId?: string;
  mappedPeerName?: string;
  mappingConfidence?: number | null;
  startSec?: number | null;
  endSec?: number | null;
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
  speakerMappings?: Record<string, string>;
};

function getDrVideoBase() {
  return String(process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

async function fetchRoomTranscriptionStatus(roomId: string): Promise<TranscriptionStatusPayload | null> {
  if (!roomId) return null;
  const adminKey = String(process.env.DR_VIDEO_ADMIN_API_KEY || process.env.DR_VIDEO_ACCESS_SECRET || "").trim();
  try {
    const response = await fetch(
      `${getDrVideoBase()}/api/rooms/state?roomId=${encodeURIComponent(roomId)}`,
      {
        cache: "no-store",
        headers: adminKey ? { "x-api-key": adminKey } : {}
      }
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.transcriptionHealth ?? null;
  } catch {
    return null;
  }
}

function getDrVideoAdminHeaders() {
  const adminKey = String(process.env.DR_VIDEO_ADMIN_API_KEY || process.env.DR_VIDEO_ACCESS_SECRET || "").trim();
  return adminKey ? ({ "x-api-key": adminKey } as Record<string, string>) : undefined;
}

async function fetchRoomChatMessages(roomId: string, after?: string | null): Promise<ChatMessage[]> {
  if (!roomId) return [];
  const url = new URL(`${getDrVideoBase()}/api/rooms/chat`);
  url.searchParams.set("roomId", roomId);
  if (after) url.searchParams.set("after", after);
  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: getDrVideoAdminHeaders()
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.messages) ? payload.messages : [];
  } catch {
    return [];
  }
}

async function postRoomChatMessage(roomId: string, peerId: string, name: string, text: string): Promise<ChatMessage | null> {
  if (!roomId) return null;
  try {
    const response = await fetch(`${getDrVideoBase()}/api/rooms/chat`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getDrVideoAdminHeaders()
      },
      body: JSON.stringify({ roomId, peerId, name, text })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return payload?.message ?? null;
  } catch {
    return null;
  }
}

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

function normalizeLiveLineSpeaker(line: LiveLine, speakerMappings: Record<string, string> = {}) {
  const rawSpeaker = line.speaker;
  const speakerText = typeof rawSpeaker === "string" ? rawSpeaker.trim() : rawSpeaker;
  const extracted = extractSpeakerFromLabeledText(line.text);
  const remembered =
    (line.speakerId ? speakerMappings[String(line.speakerId).trim()] : null) ||
    (line.mappedPeerName ? String(line.mappedPeerName).trim() : "") ||
    (line.speakerName ? String(line.speakerName).trim() : "");
  if (remembered) {
    return {
      ...line,
      speaker: remembered
    };
  }
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

function resolveIncomingSpeaker({
  speaker,
  speakerId,
  speakerName,
  mappedPeerName,
  speakerMappings
}: {
  speaker: number | string | undefined;
  speakerId?: string;
  speakerName?: string;
  mappedPeerName?: string;
  speakerMappings: Record<string, string>;
}) {
  const speakerNameTrimmed = String(speakerName || "").trim();
  if (speakerNameTrimmed) return speakerNameTrimmed;

  const mappedPeerNameTrimmed = String(mappedPeerName || "").trim();
  if (mappedPeerNameTrimmed) return mappedPeerNameTrimmed;

  const speakerIdTrimmed = String(speakerId || "").trim();
  if (speakerIdTrimmed && speakerMappings[speakerIdTrimmed]) {
    return speakerMappings[speakerIdTrimmed];
  }

  if (typeof speaker === "string") {
    const trimmed = speaker.trim();
    if (trimmed && !/^speaker(?:[\s_-]?\d+)?$/i.test(trimmed) && !/^peer[_-]/i.test(trimmed)) {
      return trimmed;
    }
  }

  return speaker;
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
  const afterChatTs = searchParams.get("afterChat");
  const includeStatus = searchParams.get("includeStatus") === "1";

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
    const transcriptionStatus = includeStatus
      ? await fetchRoomTranscriptionStatus(meeting.roomId).catch(() => null)
      : null;
    const chatMessages = await fetchRoomChatMessages(meeting.roomId, afterChatTs);
    return NextResponse.json({
      lines: [],
      transcriptionStatus,
      chatMessages,
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
    const transcriptionStatus = includeStatus
      ? await fetchRoomTranscriptionStatus(meeting.roomId).catch(() => null)
      : null;
    const chatMessages = await fetchRoomChatMessages(meeting.roomId, afterChatTs);
    const speakerMappings =
      payload.speakerMappings && typeof payload.speakerMappings === "object" ? payload.speakerMappings : {};
    const allLines = Array.isArray(payload.liveLines)
      ? payload.liveLines.map((line) => normalizeLiveLineSpeaker(line, speakerMappings))
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
      transcriptionStatus,
      chatMessages,
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
    const transcriptionStatus = includeStatus
      ? await fetchRoomTranscriptionStatus(meeting.roomId).catch(() => null)
      : null;
    return NextResponse.json({
      lines: [],
      transcriptionStatus,
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
    include: {
      members: { where: { userId: session.user.id } }
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

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const kind = typeof body?.kind === "string" ? body.kind.trim() : "";

  if (kind === "chat") {
    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }
    if (text.length > 800) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    const senderName = String(session.user.email || "").trim() || "participant";
    const senderPeerId = `app-user:${session.user.id}`;
    const message = await postRoomChatMessage(meeting.roomId, senderPeerId, senderName, text);

    if (!message) {
      return NextResponse.json({ error: "Unable to send chat message" }, { status: 502 });
    }

    const transcriptRecord = await prisma.meetingTranscript.findUnique({
      where: { meetingId: meeting.id }
    });
    const transcriptJson = JSON.stringify(
      appendChatMessageToTranscriptPayload(transcriptRecord?.transcriptJson, {
        id: `${message.ts}-${message.peerId}`,
        ts: message.ts,
        peerId: message.peerId,
        name: message.name,
        text: message.text
      })
    );
    const chatText = formatChatMessageForTranscriptText(message);
    const previousText = String(transcriptRecord?.transcriptText || "").trim();
    const nextTranscriptText = previousText
      ? `${previousText}\n${chatText}`.trim()
      : chatText;

    await prisma.meetingTranscript.upsert({
      where: { meetingId: meeting.id },
      update: {
        provider: meeting.transcriptionProvider,
        roundId: meeting.transcriptionRoundId ?? null,
        transcriptJson,
        transcriptText: nextTranscriptText
      },
      create: {
        meetingId: meeting.id,
        provider: meeting.transcriptionProvider,
        roundId: meeting.transcriptionRoundId ?? null,
        transcriptJson,
        transcriptText: nextTranscriptText
      }
    });

    void maybeRunMeetingAiAgents(meeting.id).catch(() => null);

    return NextResponse.json({ ok: true, message });
  }

  const speaker = body?.speaker;
  const speakerId = typeof body?.speakerId === "string" ? body.speakerId.trim() : "";
  const speakerName = typeof body?.speakerName === "string" ? body.speakerName.trim() : "";
  const mappedPeerId = typeof body?.mappedPeerId === "string" ? body.mappedPeerId.trim() : "";
  const mappedPeerName = typeof body?.mappedPeerName === "string" ? body.mappedPeerName.trim() : "";
  const mappingConfidence =
    typeof body?.mappingConfidence === "number" ? body.mappingConfidence : null;
  const startSec = typeof body?.startSec === "number" ? body.startSec : null;
  const endSec = typeof body?.endSec === "number" ? body.endSec : null;
  const time = typeof body?.time === "number" ? body.time : undefined;

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

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

  const speakerMappings =
    payload.speakerMappings && typeof payload.speakerMappings === "object" ? payload.speakerMappings : {};
  if (speakerId && mappedPeerName) {
    speakerMappings[speakerId] = mappedPeerName;
  }

  const resolvedSpeaker = resolveIncomingSpeaker({
    speaker,
    speakerId,
    speakerName,
    mappedPeerName,
    speakerMappings
  });

  const liveLines = Array.isArray(payload.liveLines) ? payload.liveLines : [];
  const existingKeys = new Set(liveLines.map((line) => normalizeLineKey(line)));
  const newLine: LiveLine = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    speaker: resolvedSpeaker,
    speakerId: speakerId || undefined,
    speakerName: speakerName || undefined,
    mappedPeerId: mappedPeerId || undefined,
    mappedPeerName: mappedPeerName || undefined,
    mappingConfidence,
    startSec,
    endSec,
    time
  };
  const lineKey = normalizeLineKey(newLine);
  if (existingKeys.has(lineKey)) {
    return NextResponse.json({ status: "duplicate" });
  }

  const updatedLines = [...liveLines, newLine];
  const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
  const participants = Array.isArray(payload.participants) ? payload.participants : [];

  const participantIdentifier = mappedPeerId || speakerId || buildSpeakerId(resolvedSpeaker);
  const participantName =
    String(resolvedSpeaker || "").trim() || buildSpeakerName(resolvedSpeaker);
  if (!participants.some((participant) => participant.identifier === participantIdentifier)) {
    participants.push({ identifier: participantIdentifier, name: participantName });
  }

  contributions.push({
    identifier: newLine.id,
    text: newLine.text,
    madeBy: participantIdentifier
  });

  const transcriptJson = JSON.stringify(mergeTranscriptContext(transcriptRecord?.transcriptJson, {
    contributions,
    participants,
    liveLines: updatedLines,
    speakerMappings
  }));

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
