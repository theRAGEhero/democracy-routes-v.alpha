export const LIVE_TRANSCRIPTION_PROVIDERS = ["DEEPGRAMLIVE", "GLADIALIVE"] as const;

export function isLiveTranscriptionProvider(provider: string | null | undefined) {
  return LIVE_TRANSCRIPTION_PROVIDERS.includes(String(provider || "").trim().toUpperCase() as (typeof LIVE_TRANSCRIPTION_PROVIDERS)[number]);
}

export function getTranscriptionProviderLabel(provider: string | null | undefined) {
  const normalized = String(provider || "").trim().toUpperCase();
  if (normalized === "DEEPGRAMLIVE") return "Deepgram Live";
  if (normalized === "GLADIALIVE") return "Gladia Live";
  if (normalized === "VOSK") return "Vosk";
  if (normalized === "WHISPERREMOTE") return "Whisper Remote";
  if (normalized === "AUTOREMOTE") return "Auto Remote";
  return "Deepgram";
}

export function getRoomProviderSuffix(provider: string | null | undefined) {
  const normalized = String(provider || "").trim().toUpperCase();
  if (normalized === "VOSK") return "VOSK";
  if (normalized === "DEEPGRAMLIVE") return "DEEPGRAMLIVE";
  if (normalized === "GLADIALIVE") return "GLADIALIVE";
  return "DEEPGRAM";
}
