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
};

type TranscriptStatus = {
  stage: "ready" | "waiting_for_call_end" | "queued" | "running" | "failed" | "idle";
  label: string;
  detail: string;
  error?: string | null;
};

export function TranscriptionPanel({
  meetingId,
  canManage,
  initialRoundId,
  variant = "standalone",
  autoRefresh = false,
  title = "Transcription",
  subtitle,
  statusLabel,
  className = ""
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
    } catch (parseError) {
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

  useEffect(() => {
    if (autoAttempted || loading || data) return;
    setAutoAttempted(true);
    handleFetch();
  }, [autoAttempted, loading, data, handleFetch]);

  useEffect(() => {
    if (!autoRefresh || data) return;
    const interval = window.setInterval(() => {
      handleFetch().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, data, handleFetch]);

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
                {subtitle ||
                  (source === "db"
                    ? "Database cache"
                    : source === "remote"
                      ? provider ?? "Transcription service"
                      : "Waiting for post-call transcript")}
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
                onClick={handleFetch}
                className="dr-button-outline px-3 py-1.5 text-[11px]"
                disabled={loading}
              >
                {loading ? "Loading..." : data ? "Refresh" : "Load"}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs text-slate-800">
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
