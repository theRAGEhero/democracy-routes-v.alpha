"use client";

import { useEffect, useState } from "react";

type FeedbackEntry = {
  id: string;
  userEmail: string;
  pagePath: string;
  message: string;
  createdAt: string;
};

export function AdminFeedbackList() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/feedback");
    const payload = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to load feedback");
      return;
    }
    setItems(payload?.feedbacks ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Feedback</h2>
          <p className="text-xs text-slate-500">Latest feedback submitted by users.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="dr-button-outline px-3 py-2 text-xs"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No feedback yet.</p>
        ) : (
          items.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{entry.userEmail}</span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Page: {entry.pagePath}</p>
              <p className="mt-2 text-sm text-slate-700">{entry.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
