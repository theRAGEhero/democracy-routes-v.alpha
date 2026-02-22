"use client";

import { useEffect, useMemo, useState } from "react";

type CodeRow = {
  id: string;
  code: string;
  enabled: boolean;
  createdAt: string;
};

export function RegistrationSettings() {
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [requireCode, setRequireCode] = useState(false);
  const [requireEmailConfirmation, setRequireEmailConfirmation] = useState(false);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [settingsRes, codesRes] = await Promise.all([
        fetch("/api/admin/registration/settings"),
        fetch("/api/admin/registration/codes")
      ]);
      const settings = await settingsRes.json().catch(() => null);
      const codesPayload = await codesRes.json().catch(() => null);
      if (!active) return;
      if (settingsRes.ok) {
        setRegistrationOpen(Boolean(settings?.registrationOpen));
        setRequireCode(Boolean(settings?.requireCode));
        setRequireEmailConfirmation(Boolean(settings?.requireEmailConfirmation));
      }
      if (codesRes.ok) {
        setCodes(codesPayload?.codes ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/register?code=`;
  }, []);

  async function handleSaveSettings() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/admin/registration/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationOpen, requireCode, requireEmailConfirmation })
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update settings");
      return;
    }
  }

  async function handleAddCode(event: React.FormEvent) {
    event.preventDefault();
    if (!newCode.trim()) return;
    setError(null);
    setSaving(true);
    const response = await fetch("/api/admin/registration/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode })
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to create code");
      return;
    }
    setCodes((prev) => [payload.code, ...prev]);
    setNewCode("");
  }

  async function handleToggleCode(id: string, enabled: boolean) {
    setError(null);
    const response = await fetch(`/api/admin/registration/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update code");
      return;
    }
    setCodes((prev) =>
      prev.map((code) => (code.id === id ? { ...code, enabled: payload.enabled } : code))
    );
  }

  async function handleDeleteCode(id: string) {
    const confirmed = window.confirm("Delete this code?");
    if (!confirmed) return;
    setError(null);
    const response = await fetch(`/api/admin/registration/codes/${id}`, {
      method: "DELETE"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete code");
      return;
    }
    setCodes((prev) => prev.filter((code) => code.id !== id));
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Copied link");
      setTimeout(() => setCopyMessage(null), 1500);
    } catch (error) {
      setCopyMessage("Unable to copy");
      setTimeout(() => setCopyMessage(null), 1500);
    }
  }

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Registration</h2>
          <p className="text-sm text-slate-500">Control who can create accounts.</p>
        </div>
        {copyMessage ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {copyMessage}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={registrationOpen}
            onChange={(event) => setRegistrationOpen(event.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />
          Registration open
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requireCode}
            onChange={(event) => setRequireCode(event.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />
          Registration requires code
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requireEmailConfirmation}
            onChange={(event) => setRequireEmailConfirmation(event.target.checked)}
            className="h-4 w-4"
            disabled={loading}
          />
          Require email confirmation
        </label>
        <p className="text-xs text-slate-500">
          When enabled, new users must activate their account via email before signing in.
        </p>
        <button
          type="button"
          onClick={handleSaveSettings}
          className="dr-button w-fit px-4 py-2 text-sm"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Registration codes</h3>
        <form onSubmit={handleAddCode} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={newCode}
            onChange={(event) => setNewCode(event.target.value)}
            className="dr-input w-full rounded px-3 py-2 text-sm"
            placeholder="NEW-CODE-2025"
          />
          <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={saving}>
            Add code
          </button>
        </form>
        <div className="mt-4 space-y-2 text-sm">
          {codes.length === 0 ? (
            <p className="text-slate-500">No codes yet.</p>
          ) : (
            codes.map((code) => {
              const url = baseUrl ? `${baseUrl}${encodeURIComponent(code.code)}` : "";
              return (
                <div
                  key={code.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-900">{code.code}</p>
                    {url ? (
                      <p className="text-xs text-slate-500">{url}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCode(code.id, !code.enabled)}
                      className="dr-button-outline px-3 py-1 text-xs"
                    >
                      {code.enabled ? "Disable" : "Enable"}
                    </button>
                    {url ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(url)}
                        className="dr-button-outline px-3 py-1 text-xs"
                      >
                        Copy link
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteCode(code.id)}
                      className="dr-button-outline px-3 py-1 text-xs text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
