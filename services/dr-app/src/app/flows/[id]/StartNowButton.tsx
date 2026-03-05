"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  planId: string;
};

export function StartNowButton({ planId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartNow = async () => {
    if (!confirm("Start this plan now?")) return;
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/flows/${planId}/start-now`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to start plan.");
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleStartNow}
        className="dr-button px-3 py-1 text-xs"
        disabled={loading}
      >
        {loading ? "Starting..." : "Start now"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
