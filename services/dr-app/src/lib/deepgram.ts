import { getBaseUrlCandidates } from "@/lib/transcription";

async function requestWithFallback(baseUrl: string, path: string) {
  if (!baseUrl) {
    throw new Error("TRANSCRIPTION_BASE_URL is not configured");
  }

  const candidates = getBaseUrlCandidates(baseUrl);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await fetch(`${candidate}${path}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to reach transcription service");
}

export async function fetchTranscription(baseUrl: string, roundId: string) {
  const response = await requestWithFallback(baseUrl, `/api/rounds/${roundId}/transcription`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || `Transcription service returned ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export async function fetchRounds(baseUrl: string) {
  const response = await requestWithFallback(baseUrl, "/api/rounds");

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || `Transcription service returned ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
