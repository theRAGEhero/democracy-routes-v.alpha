"use client";

import { useState } from "react";

type Props = {
  currentEmail: string;
};

export function ChangeEmailForm({ currentEmail }: Props) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update email";
      setError(message);
      return;
    }

    setPassword("");
    setMessage("Email updated. Please sign out and sign in again to refresh your session.");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium">Email address</label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Current password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="Enter your password"
        />
      </div>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
        {loading ? "Saving..." : "Update email"}
      </button>
    </form>
  );
}
