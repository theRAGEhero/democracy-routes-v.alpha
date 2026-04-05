"use client";

import { useState } from "react";

type DataspaceOption = {
  id: string;
  name: string;
};

type FlowSettingsClientProps = {
  planId: string;
  dataspaces: DataspaceOption[];
  initialFlow: {
    title: string;
    description: string | null;
    startAt: string;
    timezone: string | null;
    dataspaceId: string | null;
    isPublic: boolean;
    requiresApproval: boolean;
    capacity: number | null;
  };
};

function normalizeFormError(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.fieldErrors && typeof payload.error.fieldErrors === "object") {
    const first = Object.values(payload.error.fieldErrors).find(
      (value): value is string[] => Array.isArray(value) && value.length > 0
    );
    if (first?.[0]) return first[0];
  }
  return fallback;
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function FlowSettingsClient({
  planId,
  dataspaces,
  initialFlow
}: FlowSettingsClientProps) {
  const [title, setTitle] = useState(initialFlow.title);
  const [description, setDescription] = useState(initialFlow.description ?? "");
  const [startAt, setStartAt] = useState(toDatetimeLocal(initialFlow.startAt));
  const [timezone, setTimezone] = useState(initialFlow.timezone ?? "");
  const [dataspaceId, setDataspaceId] = useState(initialFlow.dataspaceId ?? "");
  const [isPublic, setIsPublic] = useState(initialFlow.isPublic);
  const [requiresApproval, setRequiresApproval] = useState(initialFlow.requiresApproval);
  const [capacity, setCapacity] = useState(
    initialFlow.capacity !== null ? String(initialFlow.capacity) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/flows/${planId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() || null,
        startAt: new Date(startAt).toISOString(),
        timezone: timezone.trim() || null,
        dataspaceId: dataspaceId || null,
        isPublic,
        requiresApproval,
        capacity: capacity.trim() ? Number(capacity) : null
      })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(normalizeFormError(payload, "Unable to save flow settings."));
      return;
    }

    setMessage("Flow settings updated.");
  }

  return (
    <form onSubmit={handleSubmit} className="dr-card space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Runtime settings
        </p>
        <h2
          className="mt-2 text-lg font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Editable for this flow
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Scheduling, visibility, and dataspace context can change here. Process logic stays in the
          template.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Flow title
          </span>
          <input
            className="dr-input w-full rounded px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Starts at
          </span>
          <input
            type="datetime-local"
            className="dr-input w-full rounded px-3 py-2 text-sm"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            required
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Description
          </span>
          <textarea
            className="dr-input min-h-[120px] w-full rounded px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Timezone
          </span>
          <input
            className="dr-input w-full rounded px-3 py-2 text-sm"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="Europe/Berlin"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dataspace
          </span>
          <select
            className="dr-input w-full rounded px-3 py-2 text-sm"
            value={dataspaceId}
            onChange={(event) => setDataspaceId(event.target.value)}
          >
            <option value="">No dataspace</option>
            {dataspaces.map((dataspace) => (
              <option key={dataspace.id} value={dataspace.id}>
                {dataspace.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Capacity
          </span>
          <input
            type="number"
            min="1"
            className="dr-input w-full rounded px-3 py-2 text-sm"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 md:col-span-2">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            Public flow
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
            />
            Approval required
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="flex justify-end">
        <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
          {loading ? "Saving..." : "Save flow settings"}
        </button>
      </div>
    </form>
  );
}
