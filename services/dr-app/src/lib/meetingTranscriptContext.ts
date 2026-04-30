type TranscriptChatMessage = {
  id: string;
  ts: string;
  peerId: string;
  name: string;
  text: string;
};

type TranscriptPayload = Record<string, unknown> & {
  chatMessages?: TranscriptChatMessage[];
  chat_log?: {
    messages?: TranscriptChatMessage[];
  };
};

function asPayload(value: unknown): TranscriptPayload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as TranscriptPayload)
    : {};
}

export function parseMeetingTranscriptPayload(raw: string | null | undefined) {
  if (!raw) return {} as TranscriptPayload;
  try {
    return asPayload(JSON.parse(raw));
  } catch {
    return {} as TranscriptPayload;
  }
}

function normalizeChatMessages(payload: TranscriptPayload) {
  const direct = Array.isArray(payload.chatMessages) ? payload.chatMessages : [];
  if (direct.length > 0) {
    return direct.filter((item) => item && typeof item === "object") as TranscriptChatMessage[];
  }
  const nested = payload.chat_log;
  const messages = nested && Array.isArray(nested.messages) ? nested.messages : [];
  return messages.filter((item) => item && typeof item === "object") as TranscriptChatMessage[];
}

function uniqueChatMessages(messages: TranscriptChatMessage[]) {
  const seen = new Set<string>();
  const out: TranscriptChatMessage[] = [];
  for (const message of messages) {
    const key = `${message.ts}::${message.peerId}::${message.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(message);
  }
  return out;
}

export function mergeTranscriptContext(existingRaw: string | null | undefined, nextPayload: unknown) {
  const existing = parseMeetingTranscriptPayload(existingRaw);
  const next = asPayload(nextPayload);
  const existingChat = normalizeChatMessages(existing);
  const nextChat = normalizeChatMessages(next);
  const mergedChat = uniqueChatMessages([...existingChat, ...nextChat]);

  return {
    ...existing,
    ...next,
    chatMessages: mergedChat,
    chat_log: {
      ...(existing.chat_log && typeof existing.chat_log === "object" ? existing.chat_log : {}),
      ...(next.chat_log && typeof next.chat_log === "object" ? next.chat_log : {}),
      messages: mergedChat
    }
  } satisfies TranscriptPayload;
}

export function appendChatMessageToTranscriptPayload(
  existingRaw: string | null | undefined,
  message: TranscriptChatMessage
) {
  const existing = parseMeetingTranscriptPayload(existingRaw);
  const mergedChat = uniqueChatMessages([...normalizeChatMessages(existing), message]);
  return {
    ...existing,
    chatMessages: mergedChat,
    chat_log: {
      ...(existing.chat_log && typeof existing.chat_log === "object" ? existing.chat_log : {}),
      messages: mergedChat
    }
  } satisfies TranscriptPayload;
}

export function extractTranscriptChatMessages(raw: string | null | undefined) {
  return normalizeChatMessages(parseMeetingTranscriptPayload(raw));
}

export function formatChatMessageForTranscriptText(message: {
  name?: string | null;
  text: string;
}) {
  const name = String(message.name || "").trim() || "Participant";
  return `[CHAT] ${name}: ${String(message.text || "").trim()}`;
}
