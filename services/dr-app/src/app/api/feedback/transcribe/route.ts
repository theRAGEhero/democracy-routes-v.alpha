import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSiteSetting } from "@/lib/siteSettings";

const POLL_DELAY_MS = 1500;
const POLL_LIMIT = 40;

type Provider = "DEEPGRAM" | "VOSK";

type DeliberationOntology = {
  contributions?: Array<{ text?: string | null }>;
};

function getProviderBaseUrl(provider: Provider) {
  return provider === "VOSK" ? process.env.VOSK_BASE_URL : process.env.DEEPGRAM_BASE_URL;
}

function sanitizeText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function extractTranscriptText(deliberation: DeliberationOntology | null | undefined) {
  return sanitizeText((deliberation?.contributions ?? []).map((item) => item?.text));
}

async function createRound(baseUrl: string, provider: Provider) {
  const response = await fetch(`${baseUrl}/api/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Feedback ${new Date().toISOString()}`,
      description: "Temporary feedback transcription round",
      language: "en"
    }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.round?.id) {
    throw new Error(`${provider} round creation failed`);
  }
  return String(payload.round.id);
}

async function deleteRound(baseUrl: string, roundId: string) {
  try {
    await fetch(`${baseUrl}/api/rounds/${roundId}`, { method: "DELETE", cache: "no-store" });
  } catch {
    // best-effort cleanup
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollVoskTranscript(baseUrl: string, roundId: string) {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const roundResponse = await fetch(`${baseUrl}/api/rounds/${roundId}`, { cache: "no-store" });
    const roundPayload = await roundResponse.json().catch(() => null);
    const status = roundPayload?.round?.status;

    if (status === "completed") {
      const transcriptResponse = await fetch(`${baseUrl}/api/rounds/${roundId}/transcription`, { cache: "no-store" });
      const transcriptPayload = await transcriptResponse.json().catch(() => null);
      if (!transcriptResponse.ok) {
        throw new Error("Vosk transcription retrieval failed");
      }
      return transcriptPayload as DeliberationOntology;
    }

    if (status === "error") {
      throw new Error("Vosk transcription failed");
    }

    await wait(POLL_DELAY_MS);
  }

  throw new Error("Vosk transcription timed out");
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = await getSiteSetting("feedbackTranscriptionProvider");
  return NextResponse.json({
    provider: provider === "DEEPGRAM" || provider === "VOSK" ? provider : "NONE",
    enabled: provider === "DEEPGRAM" || provider === "VOSK"
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerSetting = await getSiteSetting("feedbackTranscriptionProvider");
  const provider: Provider | null =
    providerSetting === "DEEPGRAM" || providerSetting === "VOSK" ? providerSetting : null;

  if (!provider) {
    return NextResponse.json({ error: "Feedback transcription is disabled" }, { status: 400 });
  }

  const baseUrl = getProviderBaseUrl(provider)?.replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json({ error: `${provider} is not configured` }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  const filename = audio.name || `feedback-${Date.now()}.webm`;
  let roundId: string | null = null;

  try {
    roundId = await createRound(baseUrl, provider);

    const providerForm = new FormData();
    providerForm.append("audio", audio, filename);
    providerForm.append("roundId", roundId);
    providerForm.append("filename", filename);

    const transcribeResponse = await fetch(`${baseUrl}/api/transcribe`, {
      method: "POST",
      body: providerForm,
      cache: "no-store"
    });
    const transcribePayload = await transcribeResponse.json().catch(() => null);

    if (!transcribeResponse.ok) {
      throw new Error(transcribePayload?.error ?? `${provider} transcription failed`);
    }

    let deliberation: DeliberationOntology | null = null;

    if (provider === "DEEPGRAM") {
      deliberation = (transcribePayload?.deliberation ?? null) as DeliberationOntology | null;
    } else {
      deliberation = await pollVoskTranscript(baseUrl, roundId);
    }

    const transcript = extractTranscriptText(deliberation);
    if (!transcript) {
      throw new Error("No transcript text returned");
    }

    return NextResponse.json({ ok: true, provider, transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (roundId) {
      void deleteRound(baseUrl, roundId);
    }
  }
}
