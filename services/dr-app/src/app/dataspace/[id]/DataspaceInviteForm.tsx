"use client";

import { useEffect, useMemo, useState } from "react";

type Suggestion = { id: string; email: string };

type Props = {
  dataspaceId: string;
  existingEmails: string[];
};

function normalizeFormError(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  const formError = payload?.error?.formErrors?.[0];
  if (typeof formError === "string") return formError;
  const fieldErrors = payload?.error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstValue = firstKey ? fieldErrors[firstKey]?.[0] : null;
    if (typeof firstValue === "string") return firstValue;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}

export function DataspaceInviteForm({ dataspaceId, existingEmails }: Props) {
  const [email, setEmail] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim(), [email]);
  const excludeValue = useMemo(
    () => existingEmails.map((value) => value.toLowerCase()).join(","),
    [existingEmails]
  );

  useEffect(() => {
    if (!normalizedEmail) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/users?query=${encodeURIComponent(normalizedEmail)}&exclude=${encodeURIComponent(
            excludeValue
          )}`
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
    }, 250);

    return () => clearTimeout(timer);
  }, [excludeValue, normalizedEmail]);

  function handleSelect(nextEmail: string) {
    setEmail(nextEmail);
    setShowSuggestions(false);
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!normalizedEmail) return;
    setError(null);
    setMessage(null);
    setLoading(true);

    const response = await fetch(`/api/dataspaces/${dataspaceId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail })
    });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(normalizeFormError(payload, "Unable to send invite"));
      return;
    }

    setMessage(payload?.message ?? "Invite sent.");
    setEmail("");
    setSuggestions([]);
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="relative">
        <label className="text-sm font-medium">Invite user</label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="user@example.com"
        />
        {showSuggestions && suggestions.length > 0 ? (
          <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
            {suggestions.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.email)}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                {user.email}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
        {loading ? "Inviting..." : "Send invite"}
      </button>
    </form>
  );
}
