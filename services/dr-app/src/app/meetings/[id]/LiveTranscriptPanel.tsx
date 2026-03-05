"use client";

import { useEffect, useMemo, useState } from "react";

type LiveLine = {
  id: string;
  text: string;
  time?: number;
  speaker?: number | string;
};

type Props = {
  meetingId: string;
  enabled: boolean;
  visible: boolean;
};

const POLL_MS = 2000;

function formatSpeaker(speaker?: number | string) {
  if (speaker === undefined || speaker === null || speaker === "") return "Speaker";
  return `Speaker ${speaker}`;
}

export function LiveTranscriptPanel({ meetingId, enabled, visible }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mergedLines = useMemo(() => lines.slice(-200), [lines]);

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
          if (active) {
            setError(null);
            setLines(nextLines);
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
    <div className={`relative h-full ${collapsed ? "w-8" : "w-full lg:w-80"}`}>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute right-0 top-3 z-10 rounded-l bg-slate-900/80 px-2 py-1 text-[11px] font-semibold text-white"
      >
        {collapsed ? "Transcript" : "Collapse"}
      </button>
      <div
        className={`h-full border-l border-slate-200 bg-white/90 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase text-slate-600">Live transcript</h3>
          <span className="text-[10px] text-slate-400">Auto</span>
        </div>
        <div className="h-full overflow-auto px-3 py-2 text-xs text-slate-800">
          {error ? <p className="text-xs text-amber-700">{error}</p> : null}
          {mergedLines.length === 0 && !error ? (
            <p className="text-xs text-slate-500">Waiting for live transcription…</p>
          ) : (
            <div className="space-y-2">
              {mergedLines.map((line) => (
                <div key={line.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    {formatSpeaker(line.speaker)}
                  </p>
                  <p className="text-slate-800">{line.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
