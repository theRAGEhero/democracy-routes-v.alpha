"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  meetingId: string;
  canInvite: boolean;
  isActive: boolean;
};

export function MeetingActions({ meetingId, canInvite, isActive }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; email: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [missingEmail, setMissingEmail] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    if (!normalizedEmail) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/meetings/${meetingId}/users?query=${encodeURIComponent(normalizedEmail)}`
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const payload = await response.json();
        setSuggestions(payload?.users ?? []);
        setShowSuggestions(true);
      } catch (fetchError) {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [meetingId, normalizedEmail]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setMissingEmail(null);
    setLoadingInvite(true);

    const response = await fetch(`/api/meetings/${meetingId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    setLoadingInvite(false);

    if (!response.ok) {
      const message =
        data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to invite user";
      if (data?.canInviteGuest) {
        setMissingEmail(email);
      } else {
        setError(message);
      }
      return;
    }

    if (data?.emailSent === false) {
      setMessage("User invited, but email was not sent.");
    } else {
      setMessage(data?.message ?? "User invited");
    }
    setEmail("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleGuestInvite() {
    if (!missingEmail) return;
    setGuestLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/meetings/${meetingId}/invite-guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: missingEmail })
    });

    const payload = await response.json().catch(() => null);
    setGuestLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to send guest invite");
      return;
    }

    if (payload?.emailSent === false) {
      setMessage("Guest invite created, but email was not sent.");
    } else {
      setMessage(payload?.message ?? "Guest invite sent");
    }
    setMissingEmail(null);
    setEmail("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  if (!canInvite) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="dr-card p-4">
        <h3 className="text-sm font-semibold text-slate-900">Invite member</h3>
        <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              className="dr-input w-full rounded px-3 py-2 text-sm"
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
            />
            {showSuggestions && suggestions.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setEmail(user.email)}
                    className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {user.email}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            className="dr-button px-4 py-2 text-sm"
            disabled={loadingInvite}
          >
            {loadingInvite ? "Inviting..." : "Invite"}
          </button>
        </form>
      </div>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {missingEmail ? (
        <div className="text-sm text-slate-600">
          User not found. Send a guest invite instead?
          <button
            type="button"
            onClick={handleGuestInvite}
            className="ml-2 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            disabled={guestLoading}
          >
            {guestLoading ? "Sending..." : "Send guest invite"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
