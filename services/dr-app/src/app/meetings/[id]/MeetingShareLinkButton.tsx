"use client";

import { useState } from "react";

type Props = {
  meetingId: string;
  disabled?: boolean;
};

export function MeetingShareLinkButton({ meetingId, disabled = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    if (disabled || loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/share-link`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Unable to create share link");
        return;
      }

      const shareUrl = String(payload?.shareUrl || "").trim();
      if (!shareUrl) {
        setError("Share link was empty");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("Share link copied");
      } else {
        setMessage(shareUrl);
      }
    } catch {
      setError("Unable to create share link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="dr-button-outline px-2 py-1 text-[11px]"
        disabled={disabled || loading}
      >
        {loading ? "Preparing..." : "Share link"}
      </button>
      {message ? <span className="text-[11px] text-emerald-600">{message}</span> : null}
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
