"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ChangePasswordForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmPassword })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message =
        data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to update password";
      setError(message);
      return;
    }

    if (session?.user?.email) {
      await signIn("credentials", {
        redirect: false,
        email: session.user.email,
        password: newPassword
      });
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
        <p className="mt-1 text-xs text-slate-500">Minimum 12 characters, 1 letter, 1 number.</p>
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
      <button
        type="submit"
        className="dr-button w-full px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
