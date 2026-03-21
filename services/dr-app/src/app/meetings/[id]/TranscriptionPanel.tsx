"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  meetingId: string;
  canManage: boolean;
  initialRoundId?: string | null;
  variant?: "standalone" | "embedded" | "sidebar";
  autoRefresh?: boolean;
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  className?: string;
  onActivityChange?: (active: boolean) => void;
};

type TranscriptStatus = {
  stage: "ready" | "waiting_for_call_end" | "queued" | "running" | "failed" | "idle";
  label: string;
  detail: string;
  error?: string | null;
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

type ParticipationStat = {
  id: string;
  participantKey: string;
  participantName: string;
  voiceActivityMs: number;
  updatedAt: string;
};

type ParticipationPayload = {
  totalVoiceActivityMs: number;
  participants: ParticipationStat[];
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

export function TranscriptionPanel({
  meetingId,
  canManage,
  initialRoundId,
  variant = "standalone",
  autoRefresh = false,
  title = "Transcription",
  subtitle,
  statusLabel,
  className = "",
  onActivityChange
}: Props) {
  const [roundId, setRoundId] = useState(initialRoundId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [status, setStatus] = useState<TranscriptStatus | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [participation, setParticipation] = useState<ParticipationPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"transcript" | "summary">("transcript");

  const handleFetch = useCallback(async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    const autoParam = roundId ? "" : "?auto=1";
    const response = await fetch(`/api/meetings/${meetingId}/transcription${autoParam}`, {
      method: "GET"
    });

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to fetch transcription");
      return;
    }

    if (payload?.roundId && !roundId) {
      setRoundId(payload.roundId);
      setMessage("Transcription linked automatically.");
    }
    setSource(payload?.source ?? null);
    setProvider(payload?.provider ?? null);
    setStatus(payload?.status ?? null);
    setData(payload?.transcription ?? null);
  }, [meetingId, roundId]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/summary?auto=1`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setSummaryError(payload?.error || "Unable to load meeting summary");
        setSummaryLoading(false);
        return;
      }
      setSummaryStatus(payload?.status ?? null);
      setSummary(payload?.summary ?? null);
    } catch {
      setSummaryError("Unable to load meeting summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [meetingId]);

  const fetchParticipation = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/participation-stats`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return;
      setParticipation({
        totalVoiceActivityMs: Number(payload?.totalVoiceActivityMs) || 0,
        participants: Array.isArray(payload?.participants) ? payload.participants : []
      });
    } catch {}
  }, [meetingId]);

  useEffect(() => {
    if (autoAttempted || loading || data) return;
    setAutoAttempted(true);
    handleFetch().catch(() => {});
  }, [autoAttempted, loading, data, handleFetch]);

  useEffect(() => {
    if (!autoRefresh || data) return;
    const interval = window.setInterval(() => {
      handleFetch().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, data, handleFetch]);

  useEffect(() => {
    if (variant !== "sidebar") return;
    fetchSummary().catch(() => {});
    fetchParticipation().catch(() => {});
  }, [fetchParticipation, fetchSummary, variant]);

  useEffect(() => {
    if (variant !== "sidebar" || !autoRefresh || summary || summaryStatus?.stage === "failed") return;
    const interval = window.setInterval(() => {
      fetchSummary().catch(() => {});
      fetchParticipation().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, fetchParticipation, fetchSummary, summary, summaryStatus?.stage, variant]);

  useEffect(() => {
    if (!data && !status) return;
    const active =
      Boolean(data) ||
      Boolean(
        status &&
          status.stage !== "idle" &&
          status.stage !== "waiting_for_call_end"
      );
    onActivityChange?.(active);
  }, [data, status, onActivityChange]);

  const wrapperClassName =
    variant === "embedded"
      ? `space-y-3 ${className}`.trim()
      : variant === "sidebar"
        ? `flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm ${className}`.trim()
        : `dr-card mt-6 p-6 ${className}`.trim();

  return (
    <div className={wrapperClassName}>
      {variant === "sidebar" ? (
        <>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeTab === "transcript"
                  ? subtitle ||
                    (source === "db"
                      ? "Database cache"
                      : source === "remote"
                        ? provider ?? "Transcription service"
                        : "Waiting for post-call transcript")
                  : "AI summary generated from the finalized transcript"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusLabel ? (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  {statusLabel}
                </span>
              ) : null}
              <button
                type="button"
                onClick={activeTab === "transcript" ? handleFetch : fetchSummary}
                className="dr-button-outline px-3 py-1.5 text-[11px]"
                disabled={activeTab === "transcript" ? loading : summaryLoading}
              >
                {activeTab === "transcript"
                  ? loading
                    ? "Loading..."
                    : data
                      ? "Refresh"
                      : "Load"
                  : summaryLoading
                    ? "Loading..."
                    : "Refresh"}
              </button>
            </div>
          </div>
          <div className="border-b border-slate-200 px-4 py-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("transcript")}
                className={`rounded-full px-3 py-1 ${
                  activeTab === "transcript" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Transcript
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`rounded-full px-3 py-1 ${
                  activeTab === "summary" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                AI summary
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs text-slate-800">
            {activeTab === "transcript" ? (
              <>
                {message ? <p className="mb-3 text-sm text-emerald-600">{message}</p> : null}
                {error ? <p className="mb-3 text-xs text-amber-700">{error}</p> : null}

                {data ? (
                  <TranscriptionView data={data} compact />
                ) : (
                  <EmptyTranscriptionState
                    autoRefresh={autoRefresh}
                    canManage={canManage}
                    roundId={roundId}
                    status={status}
                  />
                )}
              </>
            ) : (
              <SummaryView
                summary={summary}
                status={summaryStatus}
                error={summaryError}
                participation={participation}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500">
                {source === "db"
                  ? "Source: Database cache."
                  : source === "remote"
                    ? `Source: ${provider ?? "Transcription service"}.`
                    : "Loaded from the selected transcription service."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleFetch}
              className="dr-button-outline px-4 py-2 text-sm"
              disabled={loading}
            >
              {loading ? "Loading..." : data ? "Refresh transcription" : "Load transcription"}
            </button>
          </div>

          {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          {data ? (
            <TranscriptionView data={data} />
          ) : (
            <div className="mt-4">
              <EmptyTranscriptionState
                autoRefresh={autoRefresh}
                canManage={canManage}
                roundId={roundId}
                status={status}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryView({
  summary,
  status,
  error,
  participation
}: {
  summary: SummaryPayload | null;
  status: SummaryStatus | null;
  error: string | null;
  participation: ParticipationPayload | null;
}) {
  const tone =
    status?.stage === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : status?.stage === "running"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status?.stage === "queued"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-white text-slate-700";

  if (error) {
    return <p className="text-xs text-amber-700">{error}</p>;
  }

  if (summary) {
    return (
      <div className="space-y-4">
        {summary.providerModel ? (
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            {summary.providerModel}
          </p>
        ) : null}
        <div className="space-y-3">{renderMarkdownBlocks(summary.markdown)}</div>
        <ParticipationBalance participation={participation} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <p className="text-[13px] leading-5">{status.detail}</p>
            {status.error ? <p className="text-[12px] leading-5">{status.error}</p> : null}
            <p className="text-[11px] opacity-80">This panel refreshes automatically.</p>
          </div>
        ) : (
          <p>Waiting for transcript and summary data.</p>
        )}
      </div>
      <ParticipationBalance participation={participation} />
    </div>
  );
}

function formatVoiceMinutes(totalMs: number) {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function buildParticipationGradient(items: Array<{ color: string; percent: number }>) {
  if (items.length === 0) {
    return "conic-gradient(#e2e8f0 0deg 360deg)";
  }
  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + item.percent * 3.6;
    cursor = end;
    return `${item.color} ${start}deg ${end}deg`;
  });
  if (cursor < 360) {
    segments.push(`#e2e8f0 ${cursor}deg 360deg`);
  }
  return `conic-gradient(${segments.join(", ")})`;
}

function ParticipationBalance({ participation }: { participation: ParticipationPayload | null }) {
  const participants = Array.isArray(participation?.participants) ? participation?.participants : [];
  const totalVoiceActivityMs = Number(participation?.totalVoiceActivityMs) || 0;

  if (participants.length === 0 || totalVoiceActivityMs <= 0) {
    return null;
  }

  const palette = ["#0f766e", "#0284c7", "#b45309", "#7c3aed", "#dc2626", "#4f46e5"];
  const chartItems = participants.slice(0, 6).map((participant, index) => {
    const percent = totalVoiceActivityMs > 0 ? (participant.voiceActivityMs / totalVoiceActivityMs) * 100 : 0;
    return {
      ...participant,
      percent,
      color: palette[index % palette.length]
    };
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Participation balance
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Speaking time measured from live voice activity in the call.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {formatVoiceMinutes(totalVoiceActivityMs)} total
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="h-32 w-32 flex-shrink-0 rounded-full border border-white shadow-[inset_0_0_0_10px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.08)]"
          style={{ background: buildParticipationGradient(chartItems) }}
        />
        <div className="min-w-0 flex-1 space-y-2">
          {chartItems.map((participant) => (
            <div
              key={participant.id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: participant.color }}
                  />
                  <span className="truncate text-sm font-medium text-slate-800">
                    {participant.participantName}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {formatVoiceMinutes(participant.voiceActivityMs)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, participant.percent))}%`,
                    backgroundColor: participant.color
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{participant.percent.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyTranscriptionState({
  autoRefresh,
  canManage,
  roundId,
  status
}: {
  autoRefresh: boolean;
  canManage: boolean;
  roundId: string;
  status: TranscriptStatus | null;
}) {
  const stageTone =
    status?.stage === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : status?.stage === "running"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status?.stage === "queued"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-500";

  const fallbackText = autoRefresh
    ? "Waiting for the meeting transcript. This panel refreshes automatically."
    : roundId
      ? "No transcription loaded yet."
      : canManage
        ? "Click load to auto-detect the round ID."
        : "Transcription not linked yet.";

  return (
    <div className={`rounded-2xl border px-4 py-5 text-xs ${stageTone}`}>
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
          <p className="text-[13px] leading-5">{status.detail}</p>
          {status.error ? <p className="text-[12px] leading-5">{status.error}</p> : null}
          {autoRefresh ? (
            <p className="text-[11px] opacity-80">This panel refreshes automatically.</p>
          ) : null}
        </div>
      ) : (
        <p>{fallbackText}</p>
      )}
    </div>
  );
}

function TranscriptionView({ data, compact = false }: { data: any; compact?: boolean }) {
  const contributions = Array.isArray(data?.contributions) ? data.contributions : [];
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  const nameById = new Map<string, string>();

  for (const participant of participants) {
    if (participant?.identifier && participant?.name) {
      nameById.set(participant.identifier, participant.name);
    }
  }

  if (contributions.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        No transcript content available yet.
      </p>
    );
  }

  return (
    <div className={`${compact ? "space-y-2.5" : "mt-4 space-y-3"} text-sm text-slate-800`}>
      {contributions.map((contribution: any) => {
        const speakerId = contribution?.madeBy ?? "speaker";
        const speakerName = nameById.get(speakerId) ?? speakerId;
        return (
          <div
            key={contribution?.identifier ?? speakerId}
            className={`rounded-2xl border border-slate-200 bg-white ${
              compact ? "px-3 py-2" : "p-3"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {speakerName}
            </p>
            <p className={`${compact ? "mt-1 text-[13px] leading-5" : "mt-1"} text-slate-800`}>
              {contribution?.text ?? ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
