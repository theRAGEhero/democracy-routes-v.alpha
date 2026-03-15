"use client";

import { useMemo, useState } from "react";

type AiAgent = {
  id: string;
  name: string;
  slug: string;
  username: string;
  description: string | null;
  color: string;
  systemPrompt: string;
  instructionPrompt: string | null;
  model: string;
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Props = {
  initialAgents: AiAgent[];
};

type AgentDraft = {
  name: string;
  slug: string;
  username: string;
  description: string;
  color: string;
  systemPrompt: string;
  instructionPrompt: string;
  model: string;
  enabled: boolean;
};

const EMPTY_DRAFT: AgentDraft = {
  name: "",
  slug: "",
  username: "",
  description: "",
  color: "#0ea5e9",
  systemPrompt: "",
  instructionPrompt: "",
  model: "gemini-2.5-flash",
  enabled: true
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function AiAgentsAdminClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt))),
    [agents]
  );

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function startEdit(agent: AiAgent) {
    setEditingId(agent.id);
    setDraft({
      name: agent.name,
      slug: agent.slug,
      username: agent.username,
      description: agent.description ?? "",
      color: agent.color,
      systemPrompt: agent.systemPrompt,
      instructionPrompt: agent.instructionPrompt ?? "",
      model: agent.model,
      enabled: agent.enabled
    });
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        description: draft.description.trim() || null,
        instructionPrompt: draft.instructionPrompt.trim() || null
      };
      const response = await fetch(
        editingId ? `/api/admin/ai-agents/${editingId}` : "/api/admin/ai-agents",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const nextError =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.formErrors?.[0] ?? "Unable to save AI agent.";
        throw new Error(nextError);
      }
      const nextAgent = data?.agent as AiAgent;
      setAgents((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? nextAgent : item))
          : [nextAgent, ...current]
      );
      startCreate();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save AI agent.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this AI agent?")) return;
    const response = await fetch(`/api/admin/ai-agents/${id}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (!response.ok) {
      setError("Unable to delete AI agent.");
      return;
    }
    setAgents((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      startCreate();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          AI agents
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Define reusable AI participants, including username, color, prompts, and model.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {sortedAgents.length === 0 ? (
            <div className="dr-card p-6 text-sm text-slate-500">No AI agents created yet.</div>
          ) : (
            sortedAgents.map((agent) => (
              <div key={agent.id} className="dr-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-4 w-4 shrink-0 rounded-full border border-white/80 shadow-sm"
                        style={{ backgroundColor: agent.color }}
                      />
                      <h2 className="truncate text-lg font-semibold text-slate-900">{agent.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${agent.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {agent.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">@{agent.username}</p>
                    {agent.description ? <p className="mt-2 text-sm text-slate-600">{agent.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">{agent.slug}</span>
                      <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">{agent.model}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => startEdit(agent)} className="dr-button-outline px-3 py-1 text-xs">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(agent.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dr-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit AI agent" : "New AI agent"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure the identity and instructions the agent will use in meetings.
              </p>
            </div>
            {editingId ? (
              <button type="button" onClick={startCreate} className="dr-button-outline px-3 py-1 text-xs">
                New
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-slate-700">
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: editingId ? current.slug : slugify(event.target.value)
                  }))
                }
                className="dr-input mt-1 w-full"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Slug
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))}
                  className="dr-input mt-1 w-full"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Username
                <input
                  value={draft.username}
                  onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                  className="dr-input mt-1 w-full"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
              <label className="text-sm font-medium text-slate-700">
                Color
                <input
                  type="color"
                  value={draft.color}
                  onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Model
                <input
                  value={draft.model}
                  onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
                  className="dr-input mt-1 w-full"
                />
              </label>
            </div>

            <label className="text-sm font-medium text-slate-700">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="dr-input mt-1 min-h-[72px] w-full"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              System prompt
              <textarea
                value={draft.systemPrompt}
                onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
                className="dr-input mt-1 min-h-[140px] w-full"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Instruction prompt
              <textarea
                value={draft.instructionPrompt}
                onChange={(event) => setDraft((current) => ({ ...current, instructionPrompt: event.target.value }))}
                className="dr-input mt-1 min-h-[120px] w-full"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enabled
            </label>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <button type="button" onClick={handleSave} disabled={saving} className="dr-button px-4 py-2 text-sm">
              {saving ? "Saving..." : editingId ? "Save agent" : "Create agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
