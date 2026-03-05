"use client";

import { useEffect, useState } from "react";

export function AnalyticsSnippetSettings() {
  const [snippet, setSnippet] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/site-settings");
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          setSnippet(payload?.analyticsSnippet ?? "");
          setEnabled(Boolean(payload?.analyticsEnabled));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyticsSnippet: snippet, analyticsEnabled: enabled })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to save.");
      }
      setMessage("Saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to save.";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dr-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Analytics snippet</h2>
          <p className="text-sm text-slate-600">
            Insert Matomo or Google Analytics snippet. It will be injected site-wide when enabled.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      <div className="mt-4">
        <textarea
          className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={snippet}
          onChange={(event) => setSnippet(event.target.value)}
          placeholder="Paste your Matomo or GA snippet here..."
          disabled={loading}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="dr-button px-4 py-2 text-sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        {message ? <span className="text-xs text-slate-500">{message}</span> : null}
      </div>
    </div>
  );
}
