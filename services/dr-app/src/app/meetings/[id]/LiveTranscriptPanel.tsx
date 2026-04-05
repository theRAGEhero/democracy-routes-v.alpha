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
};

const POLL_MS = 600;

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

function normalizeSpeakerKey(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "__unknown__";
  return String(speaker);
}

function buildLineGroups(lines: LiveLine[]) {
  const groups: Array<Extract<RenderItem, { kind: "line-group" }>> = [];
  for (const line of lines) {
    const previous = groups[groups.length - 1];
    if (
      previous &&
      normalizeSpeakerKey(previous.speaker) === normalizeSpeakerKey(line.speaker)
    ) {
      previous.texts.push(line.text);
      previous.time = line.time ?? previous.time;
      continue;
    }
    groups.push({
      kind: "line-group",
      id: line.id,
      speaker: line.speaker,
      texts: [line.text],
      time: line.time
    });
  }
  return groups;
}

export function LiveTranscriptPanel({ meetingId, provider, enabled, visible, className = "" }: Props) {
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const linesRef = useRef<LiveLine[]>([]);
  const agentMessagesRef = useRef<AgentMessage[]>([]);

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
    setLines([]);
    setAgentMessages([]);
    setError(null);
    linesRef.current = [];
    agentMessagesRef.current = [];
  }, [meetingId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const search = new URLSearchParams();
        const lastLineId = linesRef.current[linesRef.current.length - 1]?.id;
        const lastAgentMessageId = agentMessagesRef.current[agentMessagesRef.current.length - 1]?.id;
        if (lastLineId) search.set("after", lastLineId);
        if (lastAgentMessageId) search.set("afterAgent", lastAgentMessageId);

        const response = await fetch(`/api/meetings/${meetingId}/live-transcript?${search.toString()}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          if (active) setError("Unable to load live transcript.");
        } else {
          const payload = await response.json().catch(() => null);
          const nextLines = Array.isArray(payload?.lines) ? payload.lines : [];
          const nextAgentMessages = Array.isArray(payload?.agentMessages) ? payload.agentMessages : [];
          if (active) {
            setError(null);
            setLines((current) => {
              if (!lastLineId) return nextLines;
              if (!nextLines.length) return current;
              return [...current, ...nextLines];
            });
            setAgentMessages((current) => {
              if (!lastAgentMessageId) return nextAgentMessages;
              if (!nextAgentMessages.length) return current;
              return [...current, ...nextAgentMessages];
            });
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
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Live
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs text-slate-800">
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {renderedItems.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">
            Waiting for live transcription…
          </div>
        ) : (
          <div className="space-y-2.5">
            {renderedItems.map((item) =>
              item.kind === "line-group" ? (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {formatSpeaker(item.speaker)}
                  </p>
                  <div className="mt-1 space-y-1">
                    {item.texts.map((text, index) => (
                      <p key={`${item.id}-${index}`} className="text-[13px] leading-5 text-slate-800">
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="rounded-2xl border px-3 py-2"
                  style={{
                    borderColor: `${item.agent.color || "#0ea5e9"}55`,
                    backgroundColor: `${item.agent.color || "#0ea5e9"}12`
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: item.agent.color || "#0ea5e9" }}
                  >
                    {item.agent.name} · AI participant
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-800">{item.text}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
