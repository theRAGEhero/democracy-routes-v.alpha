"use client";

import { useEffect, useMemo, useState } from "react";

type PendingRequest = {
  id: string;
  email: string;
};

type Props = {
  planId: string;
  isPublic: boolean;
  requiresApproval: boolean;
  capacity: number | null;
  isDataspaceMember: boolean;
  isFixedParticipant: boolean;
  participantStatus: string | null;
  pendingRequests: PendingRequest[];
  canManageRequests: boolean;
};

export function PlanParticipation({
  planId,
  isPublic,
  requiresApproval,
  capacity,
  isDataspaceMember,
  isFixedParticipant,
  participantStatus,
  pendingRequests,
  canManageRequests
}: Props) {
  const [status, setStatus] = useState(participantStatus);
  const [requests, setRequests] = useState(pendingRequests);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; email: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizedEmail = useMemo(() => inviteEmail.trim(), [inviteEmail]);

  useEffect(() => {
    if (!normalizedEmail) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/users?query=${encodeURIComponent(normalizedEmail)}`
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
    const payload = await response.json().catch(() => null);
        setSuggestions(payload?.users ?? []);
        setShowSuggestions(true);
      } catch (fetchError) {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [normalizedEmail]);

  if (!isPublic) return null;

  async function handleJoin() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/flows/${planId}/join`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to join flow");
      return;
    }
    setStatus(payload?.status ?? "APPROVED");
    setMessage(
      payload?.status === "PENDING"
        ? "Request sent. Waiting for approval."
        : "You are now participating."
    );
  }

  async function handleLeave() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/flows/${planId}/leave`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to leave flow");
      return;
    }
    setStatus(null);
    setMessage("You left the flow.");
  }

  async function handleApprove(requestId: string) {
    const response = await fetch(
      `/api/flows/${planId}/participants/${requestId}/approve`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to approve");
      return;
    }
    setRequests((prev) => prev.filter((request) => request.id !== requestId));
  }

  async function handleDecline(requestId: string) {
    const response = await fetch(
      `/api/flows/${planId}/participants/${requestId}/decline`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to decline");
      return;
    }
    setRequests((prev) => prev.filter((request) => request.id !== requestId));
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setInviteLoading(true);

    const response = await fetch(`/api/flows/${planId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail })
    });

    const payload = await response.json().catch(() => null);
    setInviteLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to invite");
      return;
    }

    if (payload?.emailSent === false) {
      setMessage("Invite created, but email was not sent.");
    } else {
      setMessage("Invite sent.");
    }
    setInviteEmail("");
  }

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase text-white">
          Public flow
        </span>
        {requiresApproval ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            Approval required
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Auto-accept
          </span>
        )}
        {capacity ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Capacity: {capacity}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {!isDataspaceMember ? (
          <p className="text-sm text-slate-600">Only dataspace members can participate in this flow.</p>
        ) : isFixedParticipant ? (
          <p className="text-sm text-slate-600">You are already part of this flow.</p>
        ) : status === "PENDING" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600">Request pending approval.</p>
            <button
              type="button"
              onClick={handleLeave}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={loading}
            >
              Cancel request
            </button>
          </div>
        ) : status === "APPROVED" ? (
          <button
            type="button"
            onClick={handleLeave}
            className="dr-button-outline px-3 py-1 text-xs"
            disabled={loading}
          >
            Leave plan
          </button>
        ) : (
          <button
            type="button"
            onClick={handleJoin}
            className="dr-button px-4 py-2 text-sm"
            disabled={loading}
          >
            {loading ? "Joining..." : "Participate"}
          </button>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {isDataspaceMember ? (
        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="friend@example.com"
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
                    onClick={() => setInviteEmail(user.email)}
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
            disabled={inviteLoading}
          >
            {inviteLoading ? "Inviting..." : "Invite"}
          </button>
        </form>
      ) : null}

      {canManageRequests && requests.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Pending requests</h3>
          <div className="mt-3 space-y-2 text-sm">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between rounded border border-slate-200 bg-white/70 px-3 py-2">
                <span>{request.email}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    className="dr-button px-3 py-1 text-xs"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(request.id)}
                    className="dr-button-outline px-3 py-1 text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
