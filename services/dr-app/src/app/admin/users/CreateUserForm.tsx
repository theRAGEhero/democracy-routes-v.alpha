"use client";

import { useState } from "react";

export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("USER");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message =
        data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to create user";
      setError(message);
      return;
    }

    if (data.emailSent === false) {
      setMessage("User created, but email was not sent.");
    } else {
      setMessage("User created and email sent.");
    }

    setEmail("");
    setRole("USER");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Role</label>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        className="dr-button px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
