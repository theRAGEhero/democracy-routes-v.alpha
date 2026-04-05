"use client";

import { useMemo, useState } from "react";

type MatchRoom = {
  participants: string[];
  reason?: string;
};

type MatchingResult = {
  id: string;
  createdAt: string;
  mode: string;
  groupSize: number;
  summary?: string;
  rooms: MatchRoom[];
  error?: string | null;
};

type Props = {
  planId: string;
  canRun: boolean;
  mode: "polar" | "anti" | "random";
};

export function MatchingPanel({ planId, canRun, mode }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modeLabel = useMemo(
    () =>
      mode === "anti"
        ? "De-polarizing (contrast)"
        : mode === "random"
          ? "Random"
          : "Polarizing (similar)",
    [mode]
  );

  const runMatching = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flows/${planId}/matching/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error || "Matching failed");
        return;
      }
      setResult(payload as MatchingResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matching failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Matching engine</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Rematch participants
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Generate new pairings using live transcript signals.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Mode from template: <span className="font-semibold text-slate-700">{modeLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runMatching}
            className="dr-button-outline px-3 py-1 text-xs"
            disabled={loading || !canRun}
          >
            {loading ? "Running..." : "Run matching"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Summary</p>
            <p className="mt-1 text-sm text-slate-700">{result.summary || "No summary returned."}</p>
            {result.error ? (
              <p className="mt-2 text-xs text-amber-600">{result.error}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.rooms.map((room, index) => (
              <div key={`${result.id}-${index}`} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Room {index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {room.participants.join(" & ")}
                </p>
                <p className="mt-2 text-xs text-slate-600">{room.reason || ""}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
