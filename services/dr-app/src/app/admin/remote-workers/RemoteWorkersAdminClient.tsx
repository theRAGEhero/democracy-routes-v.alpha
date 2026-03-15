"use client";

import { useState } from "react";

type WorkerRow = {
  id: string;
  status: string;
  label: string | null;
  lastSeenAt: string | null;
  user: { email: string };
};

type JobRow = {
  id: string;
  status: string;
  sourceType: string;
  provider: string | null;
  language: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  claimedByWorker: { user: { email: string } } | null;
};

export function RemoteWorkersAdminClient({
  workers,
  jobs
}: {
  workers: WorkerRow[];
  jobs: JobRow[];
}) {
  const [creating, setCreating] = useState(false);
  const [queueingMeetings, setQueueingMeetings] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  async function handleCreateDemoJob() {
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/remote-workers/jobs/demo", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create demo job.");
      }
      setMessage(`Demo job queued: ${payload?.job?.id ?? "ok"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create demo job.");
    } finally {
      setCreating(false);
    }
  }

  async function handleQueueMeetingJobs() {
    setQueueingMeetings(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/remote-workers/jobs/meeting-recordings", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to queue English meeting recordings.");
      }
      setMessage(`English meeting jobs queued: ${payload?.createdCount ?? 0}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue English meeting recordings.");
    } finally {
      setQueueingMeetings(false);
    }
  }

  async function openJobDetail(jobId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const response = await fetch(`/api/admin/remote-workers/jobs/${jobId}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load job details.");
      }
      setDetail(payload);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load job details.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <div className="dr-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Queue controls</h2>
            <p className="text-sm text-slate-600">
              Use a demo job to verify that the browser worker registers, heartbeats, and claims work correctly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleQueueMeetingJobs}
              className="dr-button-outline px-4 py-2 text-sm"
              disabled={queueingMeetings}
            >
              {queueingMeetings ? "Queueing EN..." : "Queue English meeting jobs"}
            </button>
            <button type="button" onClick={handleCreateDemoJob} className="dr-button px-4 py-2 text-sm" disabled={creating}>
              {creating ? "Queueing..." : "Queue demo job"}
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-xs text-slate-500">{message}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dr-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Workers</h2>
            <span className="text-xs text-slate-500">{workers.length} visible</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Last seen</th>
                  <th className="py-2 pr-0 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{worker.user.email}</td>
                    <td className="py-2 pr-4">{worker.status}</td>
                    <td className="py-2 pr-4">{worker.lastSeenAt ? new Date(worker.lastSeenAt).toLocaleString() : "-"}</td>
                    <td className="py-2 pr-0">{worker.label ?? "-"}</td>
                  </tr>
                ))}
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500">
                      No workers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dr-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Queue</h2>
            <span className="text-xs text-slate-500">{jobs.length} jobs</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Claimed by</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-0 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{job.status}</td>
                    <td className="py-2 pr-4">
                      <div>{job.sourceType}</div>
                      <div className="text-[11px] text-slate-500">{job.provider ?? "-"}</div>
                    </td>
                    <td className="py-2 pr-4">{job.claimedByWorker?.user.email ?? "-"}</td>
                    <td className="py-2 pr-4">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-0">
                      <button
                        type="button"
                        onClick={() => openJobDetail(job.id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-slate-500">
                      No jobs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="dr-card w-full max-w-4xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Remote worker job</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Job details</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            {detailLoading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
            {detailError ? <p className="mt-4 text-sm text-rose-600">{detailError}</p> : null}
            {detail?.job ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div><span className="font-semibold">Job:</span> {detail.job.id}</div>
                      <div><span className="font-semibold">Status:</span> {detail.job.status}</div>
                      <div><span className="font-semibold">Provider:</span> {detail.job.provider ?? "-"}</div>
                      <div><span className="font-semibold">Source:</span> {detail.job.sourceType}</div>
                      <div><span className="font-semibold">Language:</span> {detail.job.language ?? "-"}</div>
                      <div><span className="font-semibold">Claimed by:</span> {detail.job.claimedByWorker?.user?.email ?? "-"}</div>
                      <div><span className="font-semibold">Attempts:</span> {detail.job.attempts}</div>
                      <div><span className="font-semibold">Error:</span> {detail.job.error ?? "-"}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payload</p>
                    <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-700">
                      {JSON.stringify(detail.job.payloadJson ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest result</p>
                    {detail.job.results?.[0] ? (
                      <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-700">
                        {detail.job.results[0].transcriptPreview || "No transcript text."}
                      </pre>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No result yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent worker events</p>
                    <div className="mt-2 max-h-[220px] space-y-2 overflow-auto text-sm text-slate-700">
                      {Array.isArray(detail.recentEvents) && detail.recentEvents.length > 0 ? (
                        detail.recentEvents.map((event: any) => (
                          <div key={event.id ?? `${event.type}-${event.created_at}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold">{event.type}</span>
                              <span className="text-[11px] text-slate-500">{event.created_at ? new Date(event.created_at).toLocaleString() : "-"}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{event.message || "-"}</div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No worker events recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
