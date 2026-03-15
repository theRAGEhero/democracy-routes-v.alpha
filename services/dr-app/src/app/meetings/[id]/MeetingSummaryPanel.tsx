"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  meetingId: string;
  enabled: boolean;
  className?: string;
};

type SummaryStatus = {
  stage: "ready" | "waiting_for_transcript" | "queued" | "running" | "failed" | "idle";
  label: string;
  detail: string;
  error?: string | null;
};

type SummaryPayload = {
  markdown: string;
  generatedTitle: string | null;
  generatedDescription: string | null;
  providerModel: string | null;
  updatedAt: string | null;
};

type InlineChunk = { type: "text" | "bold" | "code"; value: string };

function parseInlineMarkdown(text: string): InlineChunk[] {
  const chunks: InlineChunk[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      chunks.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      chunks.push({ type: "code", value: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: "text", value: text.slice(lastIndex) });
  }

  return chunks;
}

function renderInline(text: string) {
  return parseInlineMarkdown(text).map((chunk, index) => {
    if (chunk.type === "bold") return <strong key={`b-${index}`}>{chunk.value}</strong>;
    if (chunk.type === "code") {
      return (
        <code key={`c-${index}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
          {chunk.value}
        </code>
      );
    }
    return <span key={`t-${index}`}>{chunk.value}</span>;
  });
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`} className="text-base font-semibold text-slate-900">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`} className="text-lg font-semibold text-slate-900">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current.startsWith("* ") && !current.startsWith("- ")) break;
        items.push(current.slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!/^\d+\.\s+/.test(current)) break;
        items.push(current.replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-6 text-slate-700">
        {renderInline(trimmed)}
      </p>
    );
    index += 1;
  }

  return blocks;
}

export function MeetingSummaryPanel({ meetingId, enabled, className = "" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SummaryStatus | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [open, setOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/summary?auto=1`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Unable to load meeting summary");
        setLoading(false);
        return;
      }
      setStatus(payload?.status ?? null);
      setSummary(payload?.summary ?? null);
    } catch {
      setError("Unable to load meeting summary");
    } finally {
      setLoading(false);
    }
  }, [enabled, meetingId]);

  useEffect(() => {
    if (!enabled) return;
    fetchSummary().catch(() => null);
  }, [enabled, fetchSummary]);

  useEffect(() => {
    if (!enabled || summary || status?.stage === "failed") return;
    const interval = window.setInterval(() => {
      fetchSummary().catch(() => null);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [enabled, fetchSummary, summary, status?.stage]);

  if (!enabled) return null;

  const shouldRender = Boolean(summary) || status?.stage === "failed";

  const tone =
    status?.stage === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : status?.stage === "running"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status?.stage === "queued"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-white text-slate-700";

  if (!shouldRender) return null;

  return (
    <section className={`dr-card p-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            AI summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cached post-call summary generated from the finalized transcript.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchSummary()}
            className="dr-button-outline px-3 py-1.5 text-xs"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="dr-button-outline px-3 py-1.5 text-xs"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {open ? (
        <div className="mt-4">
          {summary ? (
            <div className="space-y-4">
              {summary.providerModel ? (
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {summary.providerModel}
                </p>
              ) : null}
              <div className="space-y-3">{renderMarkdownBlocks(summary.markdown)}</div>
            </div>
          ) : (
            <div className={`rounded-2xl border px-4 py-5 text-sm ${tone}`}>
              {status ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {status.stage.replaceAll("_", " ")}
                    </p>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {status.label}
                    </span>
                  </div>
                  <p>{status.detail}</p>
                  {status.error ? <p>{status.error}</p> : null}
                  <p className="text-xs opacity-80">This panel refreshes automatically.</p>
                </div>
              ) : (
                <p>Waiting for transcript and summary data.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          {summary
            ? "Summary ready. Expand to read it."
            : status?.error || "Summary generation failed."}
        </div>
      )}
    </section>
  );
}
