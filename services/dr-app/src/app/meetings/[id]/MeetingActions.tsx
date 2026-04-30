"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  meetingId: string;
  canInvite: boolean;
  isActive: boolean;
  variant?: "card" | "inline";
};

export function MeetingActions({ meetingId, canInvite, isActive, variant = "card" }: Props) {
  const [email, setEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; email: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [missingEmail, setMissingEmail] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareDialogRef = useRef<HTMLDialogElement | null>(null);

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

  useEffect(() => {
    const dialog = shareDialogRef.current;
    if (!dialog) return;
    if (shareOpen && !dialog.open) {
      dialog.showModal();
      return;
    }
    if (!shareOpen && dialog.open) {
      dialog.close();
    }
  }, [shareOpen]);

  useEffect(() => {
    const dialog = shareDialogRef.current;
    if (!dialog) return;
    function handleClose() {
      setShareOpen(false);
    }
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleClose);
    };
  }, []);

  async function handleCopyShareLink() {
    if (!isActive || shareLoading) return;

    setShareLoading(true);
    setShareMessage(null);
    setShareError(null);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/share-link`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setShareError(payload?.error ?? "Unable to create share link");
        return;
      }

      const shareUrl = String(payload?.shareUrl || "").trim();
      if (!shareUrl) {
        setShareError("Share link was empty");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Public link copied");
      } else {
        setShareMessage(shareUrl);
      }
    } catch {
      setShareError("Unable to create share link");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setMissingEmail(null);
    setLoadingInvite(true);

    const response = await fetch(`/api/meetings/${meetingId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: inviteName.trim() || null })
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
    setInviteName("");
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
      body: JSON.stringify({ email: missingEmail, name: inviteName.trim() || null })
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
    setInviteName("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  if (!canInvite) {
    return null;
  }

  if (variant === "inline") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="dr-button-outline inline-flex items-center gap-1.5 px-3 py-1 text-xs"
          disabled={!isActive}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="5" cy="10" r="2.1" />
            <circle cx="15" cy="5" r="2.1" />
            <circle cx="15" cy="15" r="2.1" />
            <path d="M6.9 9.2l6.1-3.1" />
            <path d="M6.9 10.8l6.1 3.1" />
          </svg>
          <span>Share</span>
        </button>
        <dialog
          ref={shareDialogRef}
          className="backdrop:bg-slate-950/55 m-auto w-[min(92vw,520px)] rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
        >
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Share meeting</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Copy a public join link, or send the meeting directly to a specific email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="dr-button-outline px-3 py-2 text-xs"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Public link
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Works for guests and registered users. Logged-in users keep their account identity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="dr-button-outline shrink-0 px-3 py-1.5 text-[11px]"
                    disabled={!isActive || shareLoading}
                  >
                    {shareLoading ? "Preparing..." : "Copy link"}
                  </button>
                </div>
                {shareMessage ? <p className="mt-2 text-[11px] text-emerald-600">{shareMessage}</p> : null}
                {shareError ? <p className="mt-2 text-[11px] text-red-600">{shareError}</p> : null}
              </div>

              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Send to email
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  If the person already has an account, they are invited as a member. Otherwise, a guest invitation can be sent.
                </p>
                <form onSubmit={handleInvite} className="mt-3 space-y-2 overflow-visible">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Optional guest name"
                    className="dr-input w-full rounded px-3 py-2 text-xs"
                  />
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="person@example.com"
                      className="dr-input w-full rounded px-3 py-2 text-xs"
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      required
                    />
                    {showSuggestions && suggestions.length > 0 ? (
                      <div className="absolute bottom-full left-0 z-[90] mb-1 max-h-56 w-full overflow-auto rounded border border-slate-200 bg-white shadow-xl">
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
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      className="dr-button px-3 py-1.5 text-[11px]"
                      disabled={loadingInvite || !isActive}
                    >
                      {loadingInvite ? "Sending..." : "Send invite"}
                    </button>
                  </div>
                </form>
                {message ? <p className="mt-2 text-[11px] text-emerald-600">{message}</p> : null}
                {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}
                {missingEmail ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-[11px] text-slate-600">No registered user found for this email.</span>
                    <button
                      type="button"
                      onClick={handleGuestInvite}
                      className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
                      disabled={guestLoading}
                    >
                      {guestLoading ? "Sending..." : "Send guest invite"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </dialog>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="dr-card p-4">
        <h3 className="text-sm font-semibold text-slate-900">Invite member</h3>
        <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-3">
          <input
            type="text"
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="Optional guest name"
            className="dr-input w-full rounded px-3 py-2 text-sm"
          />
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
          <div className="flex justify-end">
            <button
              type="submit"
              className="dr-button px-4 py-2 text-sm"
              disabled={loadingInvite}
            >
              {loadingInvite ? "Inviting..." : "Invite"}
            </button>
          </div>
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
