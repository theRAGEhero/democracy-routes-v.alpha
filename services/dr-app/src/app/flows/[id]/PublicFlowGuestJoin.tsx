"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublicFlowGuestJoin({
  planId,
  title,
  description
}: {
  planId: string;
  title: string;
  description?: string | null;
}) {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/flows/${planId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName, guestEmail })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Unable to join flow");
        setLoading(false);
        return;
      }
      if (payload?.status === "PENDING") {
        setError("Request sent. Approval is required before you can enter.");
        setLoading(false);
        return;
      }
      if (!payload?.guestToken) {
        setError("Guest access token was not returned.");
        setLoading(false);
        return;
      }
      router.push(`/guest/flows/${payload.guestToken}`);
    } catch {
      setError("Unable to join flow");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-xl space-y-6">
      <div className="dr-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Public assembly
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h1>
        {description ? <p className="mt-3 text-sm text-slate-600">{description}</p> : null}

        <form onSubmit={handleJoin} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Your name</span>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="dr-input w-full rounded px-3 py-2 text-sm"
              placeholder="How should other participants see you?"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</span>
            <input
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              className="dr-input w-full rounded px-3 py-2 text-sm"
              placeholder="name@example.com"
              type="email"
            />
          </label>
          <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
            {loading ? "Joining..." : "Join assembly"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
