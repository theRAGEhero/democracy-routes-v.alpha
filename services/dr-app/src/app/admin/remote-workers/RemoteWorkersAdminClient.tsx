"use client";

import { useState } from "react";

export function RemoteWorkersAdminClient() {
  const [creating, setCreating] = useState(false);
  const [queueingMeetings, setQueueingMeetings] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
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
  );
}
