"use client";

import { useState } from "react";

type Props = {
  initialTelegramHandle: string;
  initialCalComLink: string;
};

export function ProfileSettingsForm({ initialTelegramHandle, initialCalComLink }: Props) {
  const [telegramHandle, setTelegramHandle] = useState(initialTelegramHandle);
  const [calComLink, setCalComLink] = useState(initialCalComLink);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<"success" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramHandle, calComLink })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update profile";
      setError(message);
      return;
    }

    setTelegramCode(payload?.telegramVerificationCode ?? null);
    setMessage("success");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium">Telegram handle</label>
        <input
          value={telegramHandle}
          onChange={(event) => setTelegramHandle(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="@username"
        />
        <p className="mt-1 text-xs text-slate-500">We store it without the @ symbol.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Cal.com link</label>
        <input
          value={calComLink}
          onChange={(event) => setCalComLink(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="https://cal.com/yourname"
        />
        <p className="mt-1 text-xs text-slate-500">Optional scheduling link.</p>
      </div>
      {message ? (
        <p className="text-sm text-emerald-600">
          Settings updated.
          {telegramCode ? (
            <>
              <br />
              Send this code to{" "}
              <a
                href="https://t.me/democracyRoutes_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                @democracyRoutes_bot
              </a>{" "}
              to verify your Telegram account:
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {telegramCode}
              </span>
            </>
          ) : (
            <>
              <br />
              Please message{" "}
              <a
                href="https://t.me/democracyRoutes_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                @democracyRoutes_bot
              </a>{" "}
              to connect notifications.
            </>
          )}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
