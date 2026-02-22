"use client";

import { useState } from "react";

type PendingRequest = {
  id: string;
  email: string;
};

type Props = {
  meetingId: string;
  isPublic: boolean;
  requiresApproval: boolean;
  capacity: number | null;
  isDataspaceMember: boolean;
  isMember: boolean;
  pendingStatus: string | null;
  pendingRequests: PendingRequest[];
  canManageRequests: boolean;
};

export function MeetingParticipation({
  meetingId,
  isPublic,
  requiresApproval,
  capacity,
  isDataspaceMember,
  isMember,
  pendingStatus,
  pendingRequests,
  canManageRequests
}: Props) {
  const [status, setStatus] = useState(pendingStatus);
  const [requests, setRequests] = useState(pendingRequests);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isPublic) return null;

  async function handleJoin() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/meetings/${meetingId}/join`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to join meeting");
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
    const response = await fetch(`/api/meetings/${meetingId}/leave`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to leave meeting");
      return;
    }
    setStatus(null);
    setMessage("You left the meeting.");
  }

  async function handleApprove(requestId: string) {
    const response = await fetch(
      `/api/meetings/${meetingId}/requests/${requestId}/approve`,
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
      `/api/meetings/${meetingId}/requests/${requestId}/decline`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to decline");
      return;
    }
    setRequests((prev) => prev.filter((request) => request.id !== requestId));
  }

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase text-white">
          Public meeting
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
          <p className="text-sm text-slate-600">Only dataspace members can participate.</p>
        ) : isMember ? (
          <button
            type="button"
            onClick={handleLeave}
            className="dr-button-outline px-3 py-1 text-xs"
            disabled={loading}
          >
            Leave meeting
          </button>
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
