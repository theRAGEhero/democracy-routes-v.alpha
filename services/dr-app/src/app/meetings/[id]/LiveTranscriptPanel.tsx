"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTranscriptionProviderLabel } from "@/lib/transcriptionProviders";

type LiveLine = {
  id: string;
  text: string;
  time?: number;
  speaker?: number | string;
};

type AgentMessage = {
  id: string;
  text: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    username: string;
    color: string;
  };
};

type ChatMessage = {
  ts: string;
  peerId: string;
  name: string;
  text: string;
};

type TranscriptionStatus = {
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

type RenderItem =
  | {
      kind: "line-group";
      id: string;
      speaker?: number | string;
      texts: string[];
      time?: number;
    }
  | {
      kind: "agent";
      id: string;
      text: string;
      createdAt: string;
      sortTime: number;
      agent: AgentMessage["agent"];
    };

type Props = {
  meetingId: string;
  provider: string;
  enabled: boolean;
  visible: boolean;
  className?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

const POLL_MS = 600;
const TRANSCRIPT_FLUSH_MS = 260;
const TRANSCRIPT_STICKY_THRESHOLD_PX = 56;

const PERSON_BUBBLE_STYLES = [
  {
    border: "border-sky-200",
    bg: "bg-sky-50/90",
    badge: "bg-sky-100 text-sky-800",
    text: "text-sky-950"
  },
  {
    border: "border-emerald-200",
    bg: "bg-emerald-50/90",
    badge: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-950"
  },
  {
    border: "border-amber-200",
    bg: "bg-amber-50/90",
    badge: "bg-amber-100 text-amber-800",
    text: "text-amber-950"
  },
  {
    border: "border-fuchsia-200",
    bg: "bg-fuchsia-50/90",
    badge: "bg-fuchsia-100 text-fuchsia-800",
    text: "text-fuchsia-950"
  },
  {
    border: "border-violet-200",
    bg: "bg-violet-50/90",
    badge: "bg-violet-100 text-violet-800",
    text: "text-violet-950"
  },
  {
    border: "border-rose-200",
    bg: "bg-rose-50/90",
    badge: "bg-rose-100 text-rose-800",
    text: "text-rose-950"
  }
] as const;

function hashSpeakerKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getPersonBubbleStyle(speaker?: number | string) {
  const key = normalizeSpeakerKey(speaker);
  const index = hashSpeakerKey(key) % PERSON_BUBBLE_STYLES.length;
  return PERSON_BUBBLE_STYLES[index];
}

function getChatBubbleStyle(name?: string, peerId?: string) {
  const key = `${String(name || "").trim().toLowerCase()}::${String(peerId || "").trim().toLowerCase()}`;
  return getPersonBubbleStyle(key || "participant");
}

function formatSpeaker(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "Speaker";
  if (typeof speaker === "string") {
    const trimmed = speaker.trim();
    if (!trimmed) return "Speaker";
    if (/^speaker[\s_-]?\d+$/i.test(trimmed)) return `Speaker ${trimmed.replace(/^speaker[\s_-]?/i, "")}`;
    return trimmed;
  }
  return `Speaker ${speaker}`;
}

function extractInlineSpeakerLabel(text: string) {
  const match = String(text || "").match(/^\[[^\]]+\]\s+([^:]+):\s*/);
  return match?.[1]?.trim() || null;
}

function stripInlineSpeakerLabel(text: string) {
  return String(text || "")
    .replace(/^\[[^\]]+\]\s+[^:]+:\s*/i, "")
    .trim();
}

function isGenericSpeakerLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  return /^speaker(?:[\s_-]?\d+)?$/i.test(normalized) || /^peer[_-]/i.test(normalized);
}

function effectiveSpeakerKey(line: LiveLine) {
  const explicit = String(line.speaker ?? "").trim();
  const inline = extractInlineSpeakerLabel(line.text);
  if (explicit && !isGenericSpeakerLabel(explicit)) return explicit.toLowerCase();
  if (inline && !isGenericSpeakerLabel(inline)) return inline.toLowerCase();
  return normalizeSpeakerKey(line.speaker).toLowerCase();
}

function effectiveSpeakerLabel(line: LiveLine) {
  const explicit = String(line.speaker ?? "").trim();
  const inline = extractInlineSpeakerLabel(line.text);
  if (explicit && !isGenericSpeakerLabel(explicit)) return explicit;
  if (inline && !isGenericSpeakerLabel(inline)) return inline;
  return line.speaker;
}

function normalizeSpeakerKey(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "__unknown__";
  return String(speaker);
}

function buildLineGroups(lines: LiveLine[]) {
  const groups: Array<Extract<RenderItem, { kind: "line-group" }>> = [];
  for (const line of lines) {
    const nextSpeakerKey = effectiveSpeakerKey(line);
    const nextText = stripInlineSpeakerLabel(line.text);
    if (!nextText) continue;
    const previous = groups[groups.length - 1];
    if (
      previous &&
      normalizeSpeakerKey(previous.speaker).toLowerCase() === nextSpeakerKey
    ) {
      previous.texts.push(nextText);
      previous.time = line.time ?? previous.time;
      continue;
    }
    groups.push({
      kind: "line-group",
      id: line.id,
      speaker: effectiveSpeakerLabel(line),
      texts: [nextText],
      time: line.time
    });
  }
  return groups;
}

function compactTranscriptTexts(texts: string[]) {
  const cleaned = texts.map((text) => String(text || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "";

  return cleaned.reduce((combined, current) => {
    if (!combined) return current;
    const previousEndsSentence = /[.!?…:;]$/.test(combined);
    const currentStartsLower = /^[a-z]/.test(current);
    if (previousEndsSentence && !currentStartsLower) {
      return `${combined}\n${current}`;
    }
    return `${combined} ${current}`;
  }, "");
}

function statusToneClasses(status: TranscriptionStatus | null) {
  if (!status) return "bg-slate-100 text-slate-700";
  if (status.state === "live") return "bg-emerald-50 text-emerald-700";
  if (status.state === "finalize_retrying") return "bg-amber-50 text-amber-800";
  if (status.state === "chunk_stalled" || status.state === "provider_silent") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function isNearBottom(element: HTMLElement | null) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= TRANSCRIPT_STICKY_THRESHOLD_PX;
}

function mergeUniqueByKey<T>(current: T[], incoming: T[], keyOf: (item: T) => string, limit: number) {
  if (!incoming.length) return current;
  const seen = new Set(current.map((item) => keyOf(item)));
  const next = [...current];
  for (const item of incoming) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next.slice(-limit);
}

export function LiveTranscriptPanel({
  meetingId,
  provider,
  enabled,
  visible,
  className = "",
  expanded = true,
  onToggleExpanded
}: Props) {
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linesRef = useRef<LiveLine[]>([]);
  const agentMessagesRef = useRef<AgentMessage[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const pollCountRef = useRef(0);
  const pendingLinesRef = useRef<LiveLine[]>([]);
  const pendingAgentMessagesRef = useRef<AgentMessage[]>([]);
  const pendingChatMessagesRef = useRef<ChatMessage[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const mergedLines = useMemo(() => lines.slice(-200), [lines]);
  const renderedItems = useMemo<RenderItem[]>(() => {
    const lineItems: RenderItem[] = buildLineGroups(mergedLines);

    const agentItems: RenderItem[] = agentMessages.slice(-50).map((message) => ({
      kind: "agent",
      id: message.id,
      text: message.text,
      createdAt: message.createdAt,
      sortTime: Number.isFinite(new Date(message.createdAt).getTime())
        ? new Date(message.createdAt).getTime()
        : Date.now(),
      agent: message.agent
    }));

    return [...lineItems, ...agentItems].sort((a, b) => {
      const aTime = a.kind === "line-group" ? a.time ?? 0 : a.sortTime;
      const bTime = b.kind === "line-group" ? b.time ?? 0 : b.sortTime;
      return aTime - bTime;
    });
  }, [mergedLines, agentMessages]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    agentMessagesRef.current = agentMessages;
  }, [agentMessages]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    setLines([]);
    setAgentMessages([]);
    setChatMessages([]);
    setChatDraft("");
    setChatError(null);
    setTranscriptionStatus(null);
    setError(null);
    linesRef.current = [];
    agentMessagesRef.current = [];
    chatMessagesRef.current = [];
    pendingLinesRef.current = [];
    pendingAgentMessagesRef.current = [];
    pendingChatMessagesRef.current = [];
    pollCountRef.current = 0;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [meetingId]);

  function flushPendingUpdates() {
    flushTimerRef.current = null;
    const nextLines = pendingLinesRef.current;
    const nextAgentMessages = pendingAgentMessagesRef.current;
    const nextChatMessages = pendingChatMessagesRef.current;
    pendingLinesRef.current = [];
    pendingAgentMessagesRef.current = [];
    pendingChatMessagesRef.current = [];

    const shouldStickTranscript = isNearBottom(transcriptScrollRef.current);
    const shouldStickChat = isNearBottom(chatScrollRef.current);

    if (nextLines.length) {
      setLines((current) => mergeUniqueByKey(current, nextLines, (item) => item.id, 500));
    }
    if (nextAgentMessages.length) {
      setAgentMessages((current) => mergeUniqueByKey(current, nextAgentMessages, (item) => item.id, 120));
    }
    if (nextChatMessages.length) {
      setChatMessages((current) =>
        mergeUniqueByKey(current, nextChatMessages, (item) => `${item.ts}-${item.peerId}-${item.text}`, 240)
      );
    }

    requestAnimationFrame(() => {
      if (shouldStickTranscript && transcriptScrollRef.current) {
        transcriptScrollRef.current.scrollTo({
          top: transcriptScrollRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
      if (shouldStickChat && chatScrollRef.current) {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    });
  }

  function scheduleFlushPendingUpdates() {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushPendingUpdates();
    }, TRANSCRIPT_FLUSH_MS);
  }

  async function handleSendChat() {
    const text = chatDraft.trim();
    if (!text || sendingChat) return;

    setSendingChat(true);
    setChatError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/live-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "chat", text })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setChatError(payload?.error ?? "Unable to send message");
        return;
      }
      const message = payload?.message;
      if (message?.ts && message?.text) {
        const shouldStickChat = isNearBottom(chatScrollRef.current);
        setChatMessages((current) =>
          mergeUniqueByKey(current, [message], (item) => `${item.ts}-${item.peerId}-${item.text}`, 240)
        );
        requestAnimationFrame(() => {
          if (shouldStickChat && chatScrollRef.current) {
            chatScrollRef.current.scrollTo({
              top: chatScrollRef.current.scrollHeight,
              behavior: "smooth"
            });
          }
        });
      }
      setChatDraft("");
    } catch {
      setChatError("Unable to send message");
    } finally {
      setSendingChat(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const search = new URLSearchParams();
        const lastLineId = linesRef.current[linesRef.current.length - 1]?.id;
        const lastAgentMessageId = agentMessagesRef.current[agentMessagesRef.current.length - 1]?.id;
        const lastChatTs = chatMessagesRef.current[chatMessagesRef.current.length - 1]?.ts;
        if (lastLineId) search.set("after", lastLineId);
        if (lastAgentMessageId) search.set("afterAgent", lastAgentMessageId);
        if (lastChatTs) search.set("afterChat", lastChatTs);
        pollCountRef.current += 1;
        if (pollCountRef.current === 1 || pollCountRef.current % 8 === 0) {
          search.set("includeStatus", "1");
        }

        const response = await fetch(`/api/meetings/${meetingId}/live-transcript?${search.toString()}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          if (active) setError("Unable to load live transcript.");
        } else {
          const payload = await response.json().catch(() => null);
          const nextLines = Array.isArray(payload?.lines) ? payload.lines : [];
          const nextAgentMessages = Array.isArray(payload?.agentMessages) ? payload.agentMessages : [];
          const nextChatMessages = Array.isArray(payload?.chatMessages) ? payload.chatMessages : [];
          const nextTranscriptionStatus =
            payload?.transcriptionStatus && typeof payload.transcriptionStatus === "object"
              ? (payload.transcriptionStatus as TranscriptionStatus)
              : null;
          if (active) {
            setError(null);
            setTranscriptionStatus((current) => {
              if (
                current?.state === nextTranscriptionStatus?.state &&
                current?.label === nextTranscriptionStatus?.label &&
                current?.detail === nextTranscriptionStatus?.detail &&
                current?.pendingFinalizeCount === nextTranscriptionStatus?.pendingFinalizeCount &&
                current?.retryingFinalizeCount === nextTranscriptionStatus?.retryingFinalizeCount &&
                current?.nextRetryAt === nextTranscriptionStatus?.nextRetryAt &&
                current?.lastError === nextTranscriptionStatus?.lastError
              ) {
                return current;
              }
              return nextTranscriptionStatus;
            });
            if (!lastLineId) {
              setLines(nextLines.slice(-500));
            } else if (nextLines.length) {
              pendingLinesRef.current = pendingLinesRef.current.concat(nextLines);
            }
            if (!lastAgentMessageId) {
              setAgentMessages(nextAgentMessages.slice(-120));
            } else if (nextAgentMessages.length) {
              pendingAgentMessagesRef.current = pendingAgentMessagesRef.current.concat(nextAgentMessages);
            }
            if (!lastChatTs) {
              setChatMessages(nextChatMessages.slice(-240));
            } else if (nextChatMessages.length) {
              pendingChatMessagesRef.current = pendingChatMessagesRef.current.concat(nextChatMessages);
            }
            if ((lastLineId && nextLines.length) || (lastAgentMessageId && nextAgentMessages.length) || (lastChatTs && nextChatMessages.length)) {
              scheduleFlushPendingUpdates();
            }
          }
        }
      } catch {
        if (active) setError("Unable to load live transcript.");
      } finally {
        if (active) {
          timer = setTimeout(poll, POLL_MS);
        }
      }
    }

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [enabled, meetingId]);

  if (!enabled || !visible) {
    return null;
  }

  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Live transcription
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">{getTranscriptionProviderLabel(provider)} · Auto</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusToneClasses(transcriptionStatus)}`}>
            {transcriptionStatus?.label || "Live"}
          </span>
          {onToggleExpanded ? (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="dr-button-outline px-2.5 py-1 text-[11px]"
            >
              {expanded ? "Collapse" : "Open"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={transcriptScrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs text-slate-800">
          {error ? <p className="text-xs text-amber-700">{error}</p> : null}
          {transcriptionStatus?.detail ? (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <p>{transcriptionStatus.detail}</p>
              {transcriptionStatus.pendingFinalizeCount ? (
                <p className="mt-1">
                  Pending finalize jobs: {transcriptionStatus.pendingFinalizeCount}
                  {transcriptionStatus.nextRetryAt
                    ? ` · next retry ${new Date(transcriptionStatus.nextRetryAt).toLocaleTimeString()}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}
          {renderedItems.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">
              Waiting for live transcription…
            </div>
          ) : (
            <div className="space-y-2.5">
              {renderedItems.map((item) => {
                if (item.kind === "line-group") {
                  const style = getPersonBubbleStyle(item.speaker);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-[22px] border px-3 py-2.5 shadow-sm transition-all duration-300 ${style.border} ${style.bg}`}
                    >
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}
                      >
                        {formatSpeaker(item.speaker)}
                      </span>
                      <p className={`mt-2 whitespace-pre-line text-[13px] leading-5 ${style.text}`}>
                        {compactTranscriptTexts(item.texts)}
                      </p>
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className="rounded-[22px] border px-3 py-2.5 shadow-sm transition-all duration-300"
                    style={{
                      borderColor: `${item.agent.color || "#0ea5e9"}55`,
                      backgroundColor: `${item.agent.color || "#0ea5e9"}12`
                    }}
                  >
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        color: item.agent.color || "#0ea5e9",
                        backgroundColor: `${item.agent.color || "#0ea5e9"}22`
                      }}
                    >
                      {item.agent.name} · AI participant
                    </span>
                    <p className="mt-2 text-[13px] leading-5 text-slate-800">{item.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 bg-slate-50/75 px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Room chat
              </h4>
              <p className="mt-1 text-[11px] text-slate-400">Messages shared by participants in this room.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {chatMessages.length}
            </span>
          </div>
          <div className="flex h-[220px] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-auto px-3 py-3">
              {chatMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[12px] text-slate-500">
                  No chat messages yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((message) => {
                    const style = getChatBubbleStyle(message.name, message.peerId);
                    return (
                      <div
                        key={`${message.ts}-${message.peerId}`}
                        className={`rounded-[22px] border px-3 py-2.5 shadow-sm transition-all duration-300 ${style.border} ${style.bg}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}
                          >
                            {message.name || "Participant"}
                          </span>
                          <p className="text-[10px] text-slate-500">
                            {new Date(message.ts).toLocaleTimeString()}
                          </p>
                        </div>
                        <p className={`mt-2 text-[13px] leading-5 ${style.text}`}>{message.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={2}
                  maxLength={800}
                  placeholder="Write a message..."
                  className="dr-input min-h-[56px] flex-1 resize-none rounded-2xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  className="dr-button px-3 py-2 text-xs"
                  disabled={sendingChat || !chatDraft.trim()}
                >
                  {sendingChat ? "Sending..." : "Send"}
                </button>
              </div>
              {chatError ? <p className="mt-2 text-[11px] text-red-600">{chatError}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
