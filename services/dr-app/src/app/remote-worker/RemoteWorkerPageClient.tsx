"use client";

import { useEffect, useState } from "react";

type SessionPayload = {
  token: string;
  expiresAt: string;
  embedUrl: string;
};

export function RemoteWorkerPageClient() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/remote-workers/session");
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to open remote worker.");
        }
        if (!cancelled) {
          setSession(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to open remote worker.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[calc(100dvh-112px)] min-h-[560px] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Remote Worker
          </h1>
          <p className="text-sm text-slate-600">
            Browser-based volunteer worker console for post-call transcription.
          </p>
        </div>
        {session?.embedUrl ? (
          <a
            href={session.embedUrl}
            target="_blank"
            rel="noreferrer"
            className="dr-button-outline px-4 py-2 text-sm"
          >
            Open standalone
          </a>
        ) : null}
      </div>

      <div className="dr-card min-h-0 flex-1 overflow-hidden p-0">
        {loading ? (
          <div className="flex h-full min-h-0 items-center justify-center text-sm text-slate-500">
            Preparing remote worker…
          </div>
        ) : error ? (
          <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : (
          <iframe
            title="Remote Worker"
            src={session?.embedUrl}
            className="h-full min-h-0 w-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        )}
      </div>
    </div>
  );
}
