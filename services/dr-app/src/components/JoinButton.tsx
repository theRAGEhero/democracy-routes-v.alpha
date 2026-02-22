"use client";

import { useState } from "react";

type Props = {
  resourceType: "meeting" | "plan";
  resourceId: string;
  initialStatus: "JOINED" | "PENDING" | "NONE";
  canJoin: boolean;
};

export function JoinButton({ resourceType, resourceId, initialStatus, canJoin }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canJoin) {
    return status === "JOINED" ? (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
        Joined
      </span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
        Join
      </span>
    );
  }

  async function handleJoin() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/${resourceType}s/${resourceId}/join`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to join");
      return;
    }

    if (payload?.status === "PENDING") {
      setStatus("PENDING");
    } else {
      setStatus("JOINED");
    }
  }

  if (status === "JOINED") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
        Joined
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
        Pending
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleJoin}
        className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-700 hover:text-slate-900"
        disabled={loading}
      >
        {loading ? "Joining..." : "Join"}
      </button>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </div>
  );
}
