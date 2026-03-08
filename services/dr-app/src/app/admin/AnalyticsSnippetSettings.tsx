"use client";

import { useEffect, useState } from "react";

export function AnalyticsSnippetSettings() {
  const [snippet, setSnippet] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [feedbackProvider, setFeedbackProvider] = useState<"NONE" | "DEEPGRAM" | "VOSK">("NONE");
  const [deepgramLimit, setDeepgramLimit] = useState(0);
  const [voskLimit, setVoskLimit] = useState(0);
  const [whisperRemoteLimit, setWhisperRemoteLimit] = useState(0);
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
          setFeedbackProvider(
            payload?.feedbackTranscriptionProvider === "DEEPGRAM" || payload?.feedbackTranscriptionProvider === "VOSK"
              ? payload.feedbackTranscriptionProvider
              : "NONE"
          );
          setDeepgramLimit(Math.max(0, Number(payload?.transcriptionLimitDeepgram || 0) || 0));
          setVoskLimit(Math.max(0, Number(payload?.transcriptionLimitVosk || 0) || 0));
          setWhisperRemoteLimit(Math.max(0, Number(payload?.transcriptionLimitWhisperRemote || 0) || 0));
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
        body: JSON.stringify({
          analyticsSnippet: snippet,
          analyticsEnabled: enabled,
          feedbackTranscriptionProvider: feedbackProvider,
          transcriptionLimitDeepgram: deepgramLimit,
          transcriptionLimitVosk: voskLimit,
          transcriptionLimitWhisperRemote: whisperRemoteLimit
        })
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
      <div className="space-y-6">
        <div>
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Feedback voice transcription</h3>
          <p className="mt-1 text-sm text-slate-600">
            Global provider for the microphone button in the feedback form. This records from the browser and sends audio
            to the selected transcription service.
          </p>
          <label className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">Provider</span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
              value={feedbackProvider}
              onChange={(event) => setFeedbackProvider(event.target.value as "NONE" | "DEEPGRAM" | "VOSK")}
              disabled={loading}
            >
              <option value="NONE">Disabled</option>
              <option value="DEEPGRAM">Deepgram</option>
              <option value="VOSK">Vosk</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Transcription concurrency limits</h3>
          <p className="mt-1 text-sm text-slate-600">
            Global limits for non-live meeting transcription. Use <code>0</code> for no limit.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-medium">Deepgram</span>
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={deepgramLimit}
                onChange={(event) => setDeepgramLimit(Math.max(0, Number(event.target.value || 0) || 0))}
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-medium">Vosk</span>
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={voskLimit}
                onChange={(event) => setVoskLimit(Math.max(0, Number(event.target.value || 0) || 0))}
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-medium">Whisper Remote</span>
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={whisperRemoteLimit}
                onChange={(event) => setWhisperRemoteLimit(Math.max(0, Number(event.target.value || 0) || 0))}
                disabled={loading}
              />
            </label>
          </div>
        </div>
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
