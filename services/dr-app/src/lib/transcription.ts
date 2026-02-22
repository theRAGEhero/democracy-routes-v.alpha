export function getBaseUrlCandidates(baseUrl: string) {
  const normalized = baseUrl?.replace(/\/$/, "") ?? "";
  if (!normalized) return [];
  const candidates = [normalized];

  try {
    const url = new URL(normalized);
    const hostname = url.hostname;
    if (hostname === "deepgram-modular" || hostname === "vosk-modular") {
      const fallback = new URL(normalized);
      fallback.hostname = "127.0.0.1";
      candidates.push(fallback.toString().replace(/\/$/, ""));
    }
  } catch {
    // ignore invalid URL
  }

  return Array.from(new Set(candidates));
}
