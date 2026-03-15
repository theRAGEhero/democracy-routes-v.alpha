"use client";

import { useEffect, useMemo, useState } from "react";

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
  | ({ kind: "line"; showSpeaker: boolean } & LiveLine)
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
  enabled: boolean;
  visible: boolean;
  className?: string;
};

const POLL_MS = 2000;

function formatSpeaker(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "Speaker";
  return `Speaker ${speaker}`;
}

function normalizeSpeakerKey(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "__unknown__";
  return String(speaker);
}

export function LiveTranscriptPanel({ meetingId, enabled, visible, className = "" }: Props) {
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mergedLines = useMemo(() => lines.slice(-200), [lines]);
  const renderedItems = useMemo<RenderItem[]>(() => {
    const lineItems: RenderItem[] = mergedLines.map((line, index) => {
      const previous = index > 0 ? mergedLines[index - 1] : null;
      const speakerChanged =
        !previous ||
        normalizeSpeakerKey(previous.speaker) !== normalizeSpeakerKey(line.speaker);
      return {
        ...line,
        kind: "line",
        showSpeaker: speakerChanged
      };
    });

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
      const aTime = a.kind === "line" ? a.time ?? 0 : a.sortTime;
      const bTime = b.kind === "line" ? b.time ?? 0 : b.sortTime;
      return aTime - bTime;
    });
  }, [mergedLines, agentMessages]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/live-transcript`, {
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
            setLines(nextLines);
            setAgentMessages(nextAgentMessages);
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
          <p className="mt-1 text-[11px] text-slate-400">Deepgram Live · Auto</p>
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
              item.kind === "line" ? (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  {item.showSpeaker ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {formatSpeaker(item.speaker)}
                    </p>
                  ) : null}
                  <p className={`${item.showSpeaker ? "mt-1" : ""} text-[13px] leading-5 text-slate-800`}>
                    {item.text}
                  </p>
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
