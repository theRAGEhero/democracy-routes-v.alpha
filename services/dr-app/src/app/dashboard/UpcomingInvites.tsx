"use client";

import { useEffect, useState } from "react";

type InviteRow = {
  id: string;
  meetingId: string;
  title: string;
  hostEmail: string;
  scheduledStartAt: string | null;
  timezone: string | null;
};

type Props = {
  invites: InviteRow[];
  title?: string;
  description?: string;
};

function formatValue(value: string | null, timeZone?: string | null) {
  if (!value) return "No schedule";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short"
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

export function UpcomingInvites({
  invites,
  title = "Upcoming invitations",
  description
}: Props) {
  const [items, setItems] = useState(invites);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(invites);
  }, [invites]);

  async function handleAction(id: string, action: "accept" | "decline") {
    setError(null);
    setLoadingId(id);

    const response = await fetch(`/api/invitations/${id}/${action}`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setLoadingId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update invitation");
      return;
    }

    setItems((prev) => prev.filter((invite) => invite.id !== id));
  }

  return (
    <div className="dr-card p-6">
      <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3 space-y-3 text-sm text-slate-700">
        {items.length === 0 ? (
          <p className="text-slate-500">No pending invitations.</p>
        ) : (
          items.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
            >
              <div>
                <p className="font-medium text-slate-900">{invite.title}</p>
                <p className="text-xs text-slate-500">
                  Host: {invite.hostEmail} · {formatValue(invite.scheduledStartAt, invite.timezone)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(invite.id, "accept")}
                  className="dr-button px-3 py-1 text-xs"
                  disabled={loadingId === invite.id}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(invite.id, "decline")}
                  className="dr-button-outline px-3 py-1 text-xs"
                  disabled={loadingId === invite.id}
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
