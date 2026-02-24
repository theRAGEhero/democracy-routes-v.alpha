"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Job = {
  id: string;
  kind: string;
  status: string;
  provider: string;
  roundId: string | null;
  meditationIndex: number | null;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
  meeting: { id: string; title: string } | null;
  plan: { id: string; title: string } | null;
  userEmail: string | null;
};

type Props = {
  initialJobs: Job[];
};

export function TranscriptionJobsTable({ initialJobs }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  async function refresh() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/transcriptions");
    const payload = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to load jobs");
      return;
    }
    setJobs(payload?.jobs ?? []);
  }

  async function retryFailed() {
    setRetryingAll(true);
    setError(null);
    const response = await fetch("/api/admin/transcriptions/retry-failed", { method: "POST" });
    const payload = await response.json().catch(() => null);
    setRetryingAll(false);
    if (!response.ok) {
      setError(payload?.error ?? "Retry failed");
      return;
    }
    refresh();
  }

  async function retry(id: string) {
    setRetryingId(id);
    setError(null);
    const response = await fetch(`/api/admin/transcriptions/${id}/retry`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setRetryingId(null);
    if (!response.ok) {
      setError(payload?.error ?? "Retry failed");
      return;
    }
    refresh();
  }

  const statusCounts = jobs.reduce(
    (acc, job) => {
      acc.total += 1;
      if (job.status === "DONE") acc.done += 1;
      if (job.status === "FAILED") acc.failed += 1;
      if (job.status === "RUNNING") acc.running += 1;
      return acc;
    },
    { total: 0, done: 0, failed: 0, running: 0 }
  );

  const filtered = jobs.filter((job) => {
    if (filter === "all") return true;
    return job.status === filter;
  });

  const failedCount = statusCounts.failed;

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transcription jobs</h2>
          <p className="text-xs text-slate-500">Latest 50 attempts across meetings and templates.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={retryFailed}
            className="dr-button px-3 py-2 text-xs"
            disabled={retryingAll || failedCount === 0}
          >
            {retryingAll ? "Retrying..." : `Retry failed (${failedCount})`}
          </button>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="dr-input rounded px-3 py-2 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="RUNNING">Running</option>
            <option value="DONE">Done</option>
            <option value="FAILED">Failed</option>
          </select>
          <button
            type="button"
            onClick={refresh}
            className="dr-button-outline px-3 py-2 text-xs"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="accent-slate-900"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
          <p className="text-[11px] uppercase text-slate-500">Total</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{statusCounts.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-[11px] uppercase text-emerald-700">Done</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{statusCounts.done}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-[11px] uppercase text-amber-700">Running</p>
          <p className="mt-1 text-lg font-semibold text-amber-700">{statusCounts.running}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
          <p className="text-[11px] uppercase text-rose-700">Failed</p>
          <p className="mt-1 text-lg font-semibold text-rose-700">{statusCounts.failed}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Auto-refresh polls every 15 seconds. Use Retry failed to reprocess jobs after services recover.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-10 gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            <span className="col-span-2">Target</span>
            <span>Status</span>
            <span>Provider</span>
            <span>Attempts</span>
            <span>Last attempt</span>
            <span className="col-span-2">Error</span>
            <span>User</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">No jobs found.</div>
            ) : (
              filtered.map((job) => {
                const target =
                  job.meeting?.title
                    ? `Meeting · ${job.meeting.title}`
                    : job.plan?.title
                      ? `Plan · ${job.plan.title}`
                      : job.kind;
                const href = job.meeting?.id
                  ? `/meetings/${job.meeting.id}`
                  : job.plan?.id
                    ? `/flows/${job.plan.id}`
                    : null;
                return (
                  <div key={job.id} className="grid grid-cols-10 gap-3 px-3 py-3 text-xs text-slate-700">
                    <div className="col-span-2">
                      {href ? (
                        <Link href={href} className="font-semibold text-slate-900 hover:underline">
                          {target}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-900">{target}</span>
                      )}
                      <div className="text-[10px] text-slate-500">
                        {job.kind}
                        {job.meditationIndex !== null ? ` · Pause ${job.meditationIndex}` : ""}
                        {job.roundId ? ` · ${job.roundId}` : ""}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          job.status === "DONE"
                            ? "bg-emerald-100 text-emerald-700"
                            : job.status === "FAILED"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div>{job.provider}</div>
                    <div>{job.attempts}</div>
                    <div>{job.lastAttemptAt ? new Date(job.lastAttemptAt).toLocaleString() : "-"}</div>
                    <div className="col-span-2 text-[11px] text-slate-500">
                      {job.lastError ?? "-"}
                    </div>
                    <div className="text-[11px] text-slate-500">{job.userEmail ?? "-"}</div>
                    <div>
                      {job.status === "FAILED" ? (
                        <button
                          type="button"
                          onClick={() => retry(job.id)}
                          className="dr-button-outline px-2 py-1 text-[10px]"
                          disabled={retryingId === job.id}
                        >
                          {retryingId === job.id ? "Retrying..." : "Retry"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
