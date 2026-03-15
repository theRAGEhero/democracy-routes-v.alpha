import { prisma } from "@/lib/prisma";
import { getSiteSetting } from "@/lib/siteSettings";

export type LimitedTranscriptionProvider = "DEEPGRAM" | "VOSK" | "WHISPERREMOTE" | "AUTOREMOTE";

const PROVIDER_KEYS: Record<LimitedTranscriptionProvider, string> = {
  DEEPGRAM: "transcriptionLimitDeepgram",
  VOSK: "transcriptionLimitVosk",
  WHISPERREMOTE: "transcriptionLimitWhisperRemote",
  AUTOREMOTE: "transcriptionLimitWhisperRemote"
};

function parseLimit(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export async function getProviderConcurrencyLimit(provider: LimitedTranscriptionProvider) {
  return parseLimit(await getSiteSetting(PROVIDER_KEYS[provider]));
}

export async function getProviderActiveCount(provider: LimitedTranscriptionProvider) {
  if (provider === "WHISPERREMOTE" || provider === "AUTOREMOTE") {
    return prisma.remoteWorkerJob.count({
      where: {
        provider,
        status: "CLAIMED"
      }
    });
  }

  return prisma.transcriptionJob.count({
    where: {
      kind: "MEETING",
      provider,
      status: "RUNNING"
    }
  });
}

export async function canStartProviderWork(provider: LimitedTranscriptionProvider) {
  const [limit, active] = await Promise.all([
    getProviderConcurrencyLimit(provider),
    getProviderActiveCount(provider)
  ]);

  return {
    provider,
    limit,
    active,
    allowed: limit <= 0 || active < limit
  };
}
