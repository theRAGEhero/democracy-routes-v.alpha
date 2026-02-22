"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  inviteId: string;
  meetingTitle: string;
  hostEmail: string;
};

export function MeetingInviteActions({ inviteId, meetingTitle, hostEmail }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "accept" | "decline") {
    setError(null);
    setLoading(action);

    const response = await fetch(`/api/invitations/${inviteId}/${action}`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setLoading(null);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update invitation");
      return;
    }

    if (action === "accept") {
      router.refresh();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="dr-card p-6">
      <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
        Invitation to join
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        You have been invited to <span className="font-semibold text-slate-800">{meetingTitle}</span>{" "}
        by {hostEmail}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleAction("accept")}
          className="dr-button px-4 py-2 text-sm"
          disabled={loading !== null}
        >
          {loading === "accept" ? "Accepting..." : "Accept invite"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("decline")}
          className="dr-button-outline px-4 py-2 text-sm"
          disabled={loading !== null}
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
