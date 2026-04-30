type TranscriptParticipant = {
  identifier: string;
  name?: string;
};

type TranscriptContribution = {
  identifier: string;
  text: string;
  madeBy?: string;
};

type TranscriptLiveLine = {
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
  contributions?: TranscriptContribution[];
  participants?: TranscriptParticipant[];
  liveLines?: TranscriptLiveLine[];
  speakerMappings?: Record<string, string>;
  chatMessages?: Array<{
    id?: string;
    ts?: string;
    peerId?: string;
    name?: string;
    text?: string;
  }>;
  chat_log?: {
    messages?: Array<{
      id?: string;
      ts?: string;
      peerId?: string;
      name?: string;
      text?: string;
    }>;
  };
};

type MeetingLike = {
  id: string;
  title: string;
  description?: string | null;
  roomId: string;
  language?: string | null;
  transcriptionProvider?: string | null;
  timezone?: string | null;
  scheduledStartAt?: Date | null;
  createdAt?: Date | null;
};

type TranscriptLike = {
  provider: string;
  roundId?: string | null;
  transcriptText?: string | null;
  transcriptJson?: string | null;
  updatedAt?: Date | null;
};

type NormalizedUtterance = {
  id: string;
  speakerId: string | null;
  speakerName: string;
  text: string;
  startSec: number | null;
  endSec: number | null;
  timeMs: number | null;
  mappingConfidence: number | null;
};

function parseTranscriptPayload(raw: string | null | undefined): TranscriptPayload {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as TranscriptPayload) : {};
  } catch {
    return {};
  }
}

function speakerLabelFromValue(value: number | string | undefined | null) {
  if (value === undefined || value === null || value === "") return "Speaker";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "Speaker";
    if (/^speaker[\s_-]?\d+$/i.test(trimmed)) {
      return `Speaker ${trimmed.replace(/^speaker[\s_-]?/i, "")}`;
    }
    return trimmed;
  }
  return `Speaker ${value}`;
}

function normalizeUtterances(payload: TranscriptPayload, transcriptText: string | null | undefined): NormalizedUtterance[] {
  const participants = Array.isArray(payload.participants) ? payload.participants : [];
  const participantMap = new Map(
    participants.map((participant) => [participant.identifier, participant.name || participant.identifier])
  );
  const speakerMappings =
    payload.speakerMappings && typeof payload.speakerMappings === "object" ? payload.speakerMappings : {};

  const lines = Array.isArray(payload.liveLines) ? payload.liveLines : [];
  if (lines.length > 0) {
    return lines.map((line, index) => {
      const speakerId = line.mappedPeerId || line.speakerId || null;
      const mappedName =
        (speakerId ? participantMap.get(speakerId) : null) ||
        (line.speakerId ? speakerMappings[line.speakerId] : null) ||
        line.mappedPeerName ||
        line.speakerName ||
        speakerLabelFromValue(line.speaker);
      return {
        id: line.id || `line-${index + 1}`,
        speakerId,
        speakerName: mappedName || "Speaker",
        text: String(line.text || "").trim(),
        startSec: typeof line.startSec === "number" ? line.startSec : null,
        endSec: typeof line.endSec === "number" ? line.endSec : null,
        timeMs: typeof line.time === "number" ? line.time : null,
        mappingConfidence: typeof line.mappingConfidence === "number" ? line.mappingConfidence : null
      };
    }).filter((line) => line.text);
  }

  const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
  if (contributions.length > 0) {
    return contributions.map((entry, index) => {
      const speakerId = entry.madeBy || null;
      return {
        id: entry.identifier || `contribution-${index + 1}`,
        speakerId,
        speakerName: (speakerId ? participantMap.get(speakerId) : null) || "Speaker",
        text: String(entry.text || "").trim(),
        startSec: null,
        endSec: null,
        timeMs: null,
        mappingConfidence: null
      };
    }).filter((line) => line.text);
  }

  const fallback = String(transcriptText || "").trim();
  if (!fallback) return [];
  return [
    {
      id: "transcript-1",
      speakerId: null,
      speakerName: "Transcript",
      text: fallback,
      startSec: null,
      endSec: null,
      timeMs: null,
      mappingConfidence: null
    }
  ];
}

function normalizeChatMessages(payload: TranscriptPayload) {
  const direct = Array.isArray(payload.chatMessages) ? payload.chatMessages : [];
  const nested = payload.chat_log && Array.isArray(payload.chat_log.messages) ? payload.chat_log.messages : [];
  const source = direct.length > 0 ? direct : nested;
  return source
    .map((entry, index) => ({
      id: String(entry?.id || `chat-${index + 1}`),
      ts: entry?.ts ? String(entry.ts) : null,
      peerId: entry?.peerId ? String(entry.peerId) : null,
      name: entry?.name ? String(entry.name) : "Participant",
      text: String(entry?.text || "").trim()
    }))
    .filter((entry) => entry.text);
}

function formatHeaderDate(meeting: MeetingLike) {
  const source = meeting.scheduledStartAt || meeting.createdAt || null;
  if (!source) return null;
  try {
    return source.toLocaleString("en-GB", {
      timeZone: meeting.timezone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return source.toISOString();
  }
}

export function buildMeetingTranscriptJsonExport(meeting: MeetingLike, transcript: TranscriptLike) {
  const payload = parseTranscriptPayload(transcript.transcriptJson);
  const utterances = normalizeUtterances(payload, transcript.transcriptText);
  const chatMessages = normalizeChatMessages(payload);
  return {
    type: "meeting_transcript",
    version: "1",
    meeting: {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description || null,
      roomId: meeting.roomId,
      language: meeting.language || null,
      provider: transcript.provider || meeting.transcriptionProvider || null,
      timezone: meeting.timezone || null,
      scheduledStartAt: meeting.scheduledStartAt?.toISOString() || null,
      transcriptRoundId: transcript.roundId || null,
      updatedAt: transcript.updatedAt?.toISOString() || null
    },
    participants: Array.isArray(payload.participants) ? payload.participants : [],
    utterances,
    chatMessages,
    rawTranscript: payload,
    transcriptText: transcript.transcriptText || ""
  };
}

export function buildMeetingTranscriptOntologyExport(meeting: MeetingLike, transcript: TranscriptLike) {
  const exported = buildMeetingTranscriptJsonExport(meeting, transcript);
  return {
    "@context": {
      del: "https://w3id.org/deliberation/ontology#",
      schema: "https://schema.org/"
    },
    "@type": "del:Deliberation",
    schema: {
      meeting_id: exported.meeting.id,
      room_id: exported.meeting.roomId,
      title: exported.meeting.title,
      provider: exported.meeting.provider,
      language: exported.meeting.language,
      timezone: exported.meeting.timezone,
      scheduled_start_at: exported.meeting.scheduledStartAt
    },
    participants: exported.participants.map((participant) => ({
      id: participant.identifier,
      name: participant.name || participant.identifier
    })),
    contributions: exported.utterances.map((entry, index) => ({
      id: entry.id || `utterance-${index + 1}`,
      speaker_id: entry.speakerId,
      speaker: entry.speakerName,
      text: entry.text,
      start_sec: entry.startSec,
      end_sec: entry.endSec,
      time_ms: entry.timeMs,
      confidence: entry.mappingConfidence
    })),
    chat_messages: exported.chatMessages.map((entry) => ({
      id: entry.id,
      speaker: entry.name,
      speaker_id: entry.peerId,
      text: entry.text,
      ts: entry.ts
    })),
    stats: {
      total_contributions: exported.utterances.length,
      total_chat_messages: exported.chatMessages.length
    }
  };
}

export function buildMeetingTranscriptTextExport(meeting: MeetingLike, transcript: TranscriptLike) {
  const payload = parseTranscriptPayload(transcript.transcriptJson);
  const utterances = normalizeUtterances(payload, transcript.transcriptText);
  const chatMessages = normalizeChatMessages(payload);
  const headerLines = [
    `Meeting: ${meeting.title}`,
    `Meeting ID: ${meeting.id}`,
    meeting.language ? `Language: ${meeting.language}` : null,
    (transcript.provider || meeting.transcriptionProvider) ? `Provider: ${transcript.provider || meeting.transcriptionProvider}` : null,
    formatHeaderDate(meeting) ? `Date: ${formatHeaderDate(meeting)}` : null
  ].filter(Boolean) as string[];

  const blocks: string[] = [];
  let currentSpeaker = "";
  for (const utterance of utterances) {
    if (utterance.speakerName !== currentSpeaker) {
      if (blocks.length > 0) blocks.push("");
      currentSpeaker = utterance.speakerName;
      blocks.push(`${currentSpeaker}:`);
    }
    blocks.push(utterance.text);
  }

  if (blocks.length === 0 && transcript.transcriptText) {
    blocks.push(transcript.transcriptText.trim());
  }

  if (chatMessages.length > 0) {
    if (blocks.length > 0) blocks.push("", "Room chat:");
    else blocks.push("Room chat:");
    for (const message of chatMessages) {
      blocks.push("");
      blocks.push(`${message.name}:`);
      blocks.push(message.text);
    }
  }

  return [...headerLines, "", ...blocks].join("\n").trim() + "\n";
}
