type HubSession = {
  session_id: string;
  meeting_id?: string | null;
  room_id?: string | null;
  provider?: string | null;
  language?: string | null;
  ended_at?: string | null;
};

type HubLatestResponse = {
  ok: boolean;
  session?: HubSession;
};

type HubDeliberationResponse = {
  ok: boolean;
  sessionId: string;
  deliberation?: unknown;
};

export type HubMeetingTranscription = {
  meetingId: string;
  sessionId: string;
  provider: string;
  transcription: unknown;
};

function normalizeBaseUrl(baseUrlRaw: string) {
  return String(baseUrlRaw || "").trim().replace(/\/+$/, "");
}

function getHubConfig() {
  const baseUrl = normalizeBaseUrl(process.env.TRANSCRIPTION_HUB_BASE_URL || "");
  const apiKey = String(process.env.TRANSCRIPTION_HUB_API_KEY || "").trim();
  return { baseUrl, apiKey };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeaders(apiKey: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

export function extractTranscriptTextFromTranscription(transcription: any) {
  const fromTopLevel = transcription?.contributions;
  const fromDeliberation = transcription?.deliberation?.contributions;
  const contributions = Array.isArray(fromTopLevel)
    ? fromTopLevel
    : Array.isArray(fromDeliberation)
      ? fromDeliberation
      : [];
  return contributions
    .map((entry: any) => entry?.text)
    .filter((text: any) => typeof text === "string")
    .join(" ")
    .trim();
}

export async function fetchHubDeliberationByMeetingId(meetingId: string): Promise<HubMeetingTranscription | null> {
  const { baseUrl, apiKey } = getHubConfig();
  const safeMeetingId = String(meetingId || "").trim();
  if (!baseUrl || !safeMeetingId) return null;

  const headers = buildHeaders(apiKey);

  const latestResponse = await fetchWithTimeout(
    `${baseUrl}/api/meetings/${encodeURIComponent(safeMeetingId)}/latest`,
    { headers }
  );

  if (!latestResponse.ok) return null;
  const latestPayload = (await latestResponse.json().catch(() => null)) as HubLatestResponse | null;
  const sessionId = String(latestPayload?.session?.session_id || "").trim();
  if (!sessionId) return null;

  const deliberationResponse = await fetchWithTimeout(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/deliberation`,
    { headers }
  );

  if (!deliberationResponse.ok) return null;
  const deliberationPayload = (await deliberationResponse.json().catch(() => null)) as HubDeliberationResponse | null;
  if (!deliberationPayload?.deliberation) return null;

  return {
    meetingId: safeMeetingId,
    sessionId,
    provider: String(latestPayload?.session?.provider || "TRANSCRIPTION_HUB"),
    transcription: deliberationPayload.deliberation
  };
}

export async function fetchHubDeliberationByMeetingIds(meetingIds: string[]) {
  const out = new Map<string, HubMeetingTranscription>();
  const unique = Array.from(
    new Set((meetingIds || []).map((id) => String(id || "").trim()).filter(Boolean))
  );

  for (const meetingId of unique) {
    try {
      const hit = await fetchHubDeliberationByMeetingId(meetingId);
      if (hit?.transcription) out.set(meetingId, hit);
    } catch {
      // best effort in hub-first fallback paths
    }
  }

  return out;
}
