type HubSegment = {
  seq: number;
  text: string;
  isFinal: boolean;
  startMs: number | null;
  endMs: number | null;
  speakerTag: string | null;
  mappedUserId: string | null;
  mappedUserName: string | null;
  confidence: number | null;
  payload: Record<string, unknown>;
};

type IngestMeetingTranscriptParams = {
  meetingId: string;
  roomId: string;
  sessionId: string;
  provider: string;
  language: string | null;
  transcriptText: string;
  transcriptJson?: unknown;
  startedAt?: string | null;
  endedAt?: string | null;
  metadata?: Record<string, unknown>;
};

function getHubConfig() {
  return {
    baseUrl: String(process.env.TRANSCRIPTION_HUB_BASE_URL || "").trim().replace(/\/+$/, ""),
    apiKey: String(process.env.TRANSCRIPTION_HUB_API_KEY || "").trim()
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTimeToMs(value: unknown) {
  const n = asNumber(value);
  if (n == null) return null;
  return n > 1000 ? Math.round(n) : Math.round(n * 1000);
}

function buildSegmentsFromTranscript(transcriptText: string, transcriptJson?: unknown): HubSegment[] {
  const root = asObject(transcriptJson);
  const chunkList = Array.isArray(root?.chunks) ? root?.chunks : Array.isArray(root?.segments) ? root?.segments : [];
  const chunks = Array.isArray(chunkList) ? chunkList : [];

  const out = chunks
    .map((chunk, index) => {
      const record = asObject(chunk);
      const text = String(record?.text || "").trim();
      if (!text) return null;
      const timestamp = Array.isArray(record?.timestamp) ? record?.timestamp : [];
      const startMs = timestamp.length > 0 ? normalizeTimeToMs(timestamp[0]) : normalizeTimeToMs(record?.start);
      const endMs = timestamp.length > 1 ? normalizeTimeToMs(timestamp[1]) : normalizeTimeToMs(record?.end);
      return {
        seq: index + 1,
        text,
        isFinal: true,
        startMs,
        endMs,
        speakerTag: null,
        mappedUserId: null,
        mappedUserName: null,
        confidence: asNumber(record?.confidence),
        payload: record || {}
      } satisfies HubSegment;
    })
    .filter(Boolean) as HubSegment[];

  if (out.length > 0) return out;

  const fallbackText = String(transcriptText || "").trim();
  if (!fallbackText) return [];
  return [
    {
      seq: 1,
      text: fallbackText,
      isFinal: true,
      startMs: null,
      endMs: null,
      speakerTag: null,
      mappedUserId: null,
      mappedUserName: null,
      confidence: null,
      payload: root || {}
    }
  ];
}

function buildDeliberationPayload(segments: HubSegment[], meetingId: string, provider: string, language: string | null) {
  return {
    "@context": {
      del: "https://w3id.org/deliberation/ontology#",
      schema: "https://schema.org/"
    },
    "@type": "del:Deliberation",
    schema: {
      provider,
      language: language || null,
      meeting_id: meetingId
    },
    contributions: segments.map((segment) => ({
      speaker: segment.mappedUserName || segment.speakerTag || "speaker_0",
      text: segment.text,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      confidence: segment.confidence
    })),
    stats: {
      total_contributions: segments.length
    }
  };
}

export async function ingestMeetingTranscriptToHub(params: IngestMeetingTranscriptParams) {
  const { baseUrl, apiKey } = getHubConfig();
  if (!baseUrl) {
    return { ok: false, reason: "hub_url_not_configured" as const };
  }

  const transcriptText = String(params.transcriptText || "").trim();
  if (!transcriptText) {
    return { ok: false, reason: "empty_transcript" as const };
  }

  const segments = buildSegmentsFromTranscript(transcriptText, params.transcriptJson);
  const deliberation = buildDeliberationPayload(segments, params.meetingId, params.provider, params.language);
  const eventId = [
    "dr-app",
    params.provider,
    params.meetingId,
    params.sessionId,
    "finalized"
  ].join(":");

  const response = await fetch(`${baseUrl}/api/ingest/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({
      source: "dr-app",
      eventId,
      roomId: params.roomId,
      sessionId: params.sessionId,
      meetingId: params.meetingId,
      runId: params.sessionId,
      provider: params.provider,
      language: params.language,
      status: "finalized",
      startedAt: params.startedAt || null,
      endedAt: params.endedAt || new Date().toISOString(),
      metadata: {
        deliberationStyle: true,
        mirroredBy: "dr-app",
        ...(params.metadata || {})
      },
      segments,
      artifacts: [
        {
          type: "deliberation",
          uri: null,
          payload: deliberation
        },
        {
          type: "raw",
          uri: null,
          payload: params.transcriptJson && typeof params.transcriptJson === "object"
            ? params.transcriptJson
            : { text: transcriptText }
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      reason: "hub_ingest_failed" as const,
      status: response.status,
      body: text.slice(0, 1000)
    };
  }

  const payload = await response.json().catch(() => null);
  return {
    ok: true,
    sessionId: params.sessionId,
    payload
  };
}
