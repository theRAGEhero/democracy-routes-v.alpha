"use client";

import { useState } from "react";

type ResetPasswordFormProps = {
  token: string | null;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword })
    });
    const payload = await response.json().catch(() => ({}));

    setLoading(false);

    if (!response.ok) {
      const errorMessage =
        payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to reset password";
      setError(errorMessage);
      return;
    }

    setMessage("Password updated. You can sign in now.");
  }

  if (!token) {
    return <p className="text-sm text-red-600">Missing reset token.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">New password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Confirm password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      <button type="submit" className="dr-button w-full px-4 py-2 text-sm" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
