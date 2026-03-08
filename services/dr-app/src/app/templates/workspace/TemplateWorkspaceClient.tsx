"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildDefaultTemplateDraft, type TemplateBlock, type TemplateDraft } from "@/lib/templateDraft";
import { ModularBuilderClient } from "@/app/modular/ModularBuilderClient";
import { StructuredTemplateEditor } from "@/app/templates/workspace/StructuredTemplateEditor";

type WorkspaceMode = "ai" | "modular" | "structured";
type AiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  isPublic: boolean;
  createdById: string;
  settings?: TemplateDraft["settings"] | null;
  blocks: TemplateBlock[];
};

type Props = {
  templates: TemplateSummary[];
  dataspaces: Array<{ id: string; name: string }>;
  initialMode: WorkspaceMode;
  initialTemplateId?: string | null;
};

function formatApiError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);

  const maybeError = error as {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
    error?: unknown;
    issues?: Array<{ path?: string; message?: string }>;
  };

  const issueErrors = Array.isArray(maybeError.issues)
    ? maybeError.issues
        .map((issue) => {
          const path = String(issue?.path || "").trim();
          const message = String(issue?.message || "").trim();
          if (!message) return null;
          return path ? `${path}: ${message}` : message;
        })
        .filter(Boolean) as string[]
    : [];

  const formErrors = Array.isArray(maybeError.formErrors) ? maybeError.formErrors.filter(Boolean) : [];
  const fieldErrors = maybeError.fieldErrors && typeof maybeError.fieldErrors === "object"
    ? Object.entries(maybeError.fieldErrors)
        .flatMap(([field, messages]) =>
          Array.isArray(messages) ? messages.filter(Boolean).map((message) => `${field}: ${message}`) : []
        )
    : [];

  const combined = [...issueErrors, ...formErrors, ...fieldErrors];
  if (combined.length > 0) {
    return combined.join(" · ");
  }

  if ("error" in maybeError) {
    return formatApiError(maybeError.error);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function mapTemplateToDraft(template: TemplateSummary): TemplateDraft {
  const base = buildDefaultTemplateDraft();
  return {
    ...base,
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    isPublic: template.isPublic,
    settings: {
      ...base.settings,
      ...(template.settings ?? {})
    },
    blocks: template.blocks
  };
}

export function TemplateWorkspaceClient({
  templates,
  dataspaces,
  initialMode,
  initialTemplateId
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templatesState, setTemplatesState] = useState<TemplateSummary[]>(templates);
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [draft, setDraft] = useState<TemplateDraft>(() => {
    const existing = initialTemplateId ? templates.find((item) => item.id === initialTemplateId) : null;
    return existing ? mapTemplateToDraft(existing) : buildDefaultTemplateDraft();
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState(
    "Design a 90-minute citizen assembly template to deliberate on a civic issue. Include context setting, small-group pairing, data capture, and a closing summary."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRaw, setAiRaw] = useState("");
  const [aiRequestId, setAiRequestId] = useState<string | null>(null);
  const [pendingAiDraft, setPendingAiDraft] = useState<TemplateDraft | null>(null);
  const [pendingAiSummary, setPendingAiSummary] = useState<string | null>(null);
  const [posters, setPosters] = useState<Array<{ id: string; title: string }>>([]);
  const [audioFiles, setAudioFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [rawOutputOpen, setRawOutputOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      id: "intro",
      role: "system",
      text: "Use AI to generate a first draft or modify the current template without leaving the workspace."
    }
  ]);

  async function persistAiHistory(templateId: string, messages: AiMessage[]) {
    try {
      await fetch("/api/templates/ai/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateId,
          messages: messages.slice(-40)
        })
      });
    } catch {}
  }

  const currentTemplateId = draft.id ?? null;
  const templateCount = templatesState.length;
  const totalDuration = useMemo(
    () => Math.round(draft.blocks.reduce((sum, block) => sum + (block.durationSeconds || 0), 0) / 60),
    [draft.blocks]
  );

  useEffect(() => {
    const nextMode = searchParams?.get("mode");
    if (nextMode === "ai" || nextMode === "modular" || nextMode === "structured") {
      setMode(nextMode);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadAssets() {
      try {
        const [posterResponse, audioResponse] = await Promise.all([
          fetch("/api/posters"),
          fetch("/api/integrations/workflow/meditation/audio")
        ]);
        const posterPayload = await posterResponse.json().catch(() => null);
        const audioPayload = await audioResponse.json().catch(() => null);
        if (posterResponse.ok) {
          setPosters(
            Array.isArray(posterPayload?.posters)
              ? posterPayload.posters.map((poster: any) => ({ id: poster.id, title: poster.title }))
              : []
          );
        }
        if (audioResponse.ok) {
          setAudioFiles(Array.isArray(audioPayload?.files) ? audioPayload.files : []);
        }
      } catch {}
    }
    loadAssets();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAiHistory() {
      if (!currentTemplateId) {
        setAiMessages([
          {
            id: "intro",
            role: "system",
            text: "Use AI to generate a first draft or modify the current template without leaving the workspace."
          }
        ]);
        return;
      }
      try {
        const response = await fetch(
          `/api/templates/ai/history?templateId=${encodeURIComponent(currentTemplateId)}`,
          { credentials: "include" }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        const persisted = Array.isArray(payload?.messages) ? payload.messages : [];
        setAiMessages([
          {
            id: "intro",
            role: "system",
            text: "Use AI to generate a first draft or modify the current template without leaving the workspace."
          },
          ...persisted
        ]);
      } catch {}
    }
    loadAiHistory();
    return () => {
      cancelled = true;
    };
  }, [currentTemplateId]);

  function updateMode(nextMode: WorkspaceMode) {
    setMode(nextMode);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("mode", nextMode);
    if (draft.id) params.set("templateId", draft.id);
    router.replace(`/templates/workspace?${params.toString()}`);
  }

  function loadTemplateById(templateId: string) {
    const target = templatesState.find((item) => item.id === templateId);
    if (!target) return;
    setDraft(mapTemplateToDraft(target));
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("templateId", target.id);
    params.set("mode", mode);
    router.replace(`/templates/workspace?${params.toString()}`);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        name: draft.name?.trim() || "Untitled template",
        description: draft.description || null,
        isPublic: Boolean(draft.isPublic),
        settings: draft.settings,
        blocks: draft.blocks
      };
      const response = currentTemplateId
        ? await fetch(`/api/plan-templates/${currentTemplateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await fetch("/api/plan-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error?.formErrors?.[0] ?? result?.error ?? "Unable to save template.");
      }
      const nextId = currentTemplateId || result?.id || null;
      if (nextId && nextId !== currentTemplateId) {
        setDraft((prev) => ({ ...prev, id: nextId }));
        setTemplatesState((prev) => [
          {
            id: nextId,
            name: draft.name?.trim() || "Untitled template",
            description: draft.description || null,
            isPublic: Boolean(draft.isPublic),
            createdById: "self",
            updatedAt: new Date().toISOString(),
            settings: draft.settings,
            blocks: draft.blocks
          },
          ...prev
        ]);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("templateId", nextId);
        params.set("mode", mode);
        router.replace(`/templates/workspace?${params.toString()}`);
        void persistAiHistory(nextId, aiMessages);
      } else if (nextId) {
        setTemplatesState((prev) =>
          prev.map((template) =>
            template.id === nextId
              ? {
                  ...template,
                  name: draft.name?.trim() || "Untitled template",
                  description: draft.description || null,
                  isPublic: Boolean(draft.isPublic),
                  updatedAt: new Date().toISOString(),
                  settings: draft.settings,
                  blocks: draft.blocks
                }
              : template
          )
        );
      }
      setSaveMessage("Template saved.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Unable to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function runAi(nextMode: "generate" | "modify") {
    setAiLoading(true);
    setAiError(null);
    setAiRaw("");
    setAiRequestId(null);
    setPendingAiDraft(null);
    setPendingAiSummary(null);
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("Write a prompt before sending it to AI.");
      setAiLoading(false);
      return;
    }
    setAiMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: `${nextMode === "modify" ? "Modify" : "Generate"}: ${prompt}`
      }
    ]);
    try {
      const outgoingMessages = aiMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .slice(-20)
        .map((message) => ({ role: message.role, text: message.text }));
      const response = await fetch("/api/templates/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          mode: nextMode,
          templateId: currentTemplateId ?? undefined,
          messages: outgoingMessages,
          draft: nextMode === "modify" ? draft : undefined
        })
      });
      const payloadText = await response.text();
      setAiRaw(payloadText || "");
      let payload: any = null;
      try {
        payload = payloadText ? JSON.parse(payloadText) : null;
      } catch {
        payload = null;
      }
      if (payload?.requestId) {
        setAiRequestId(payload.requestId);
      }
      if (!response.ok) {
        throw new Error(formatApiError(payload?.error) || `AI request failed (${response.status}).`);
      }
      if (!payload?.template) {
        throw new Error("AI did not return a template draft.");
      }
      setPendingAiDraft({
        ...buildDefaultTemplateDraft(),
        ...payload.template,
        id: nextMode === "modify" ? draft.id ?? null : null,
        settings: {
          ...buildDefaultTemplateDraft().settings,
          ...(payload.template.settings ?? {})
        }
      });
      setPendingAiSummary(
        payload?.assistantMessage ||
          (nextMode === "modify"
            ? "AI prepared an updated version of the current template. Review and apply if correct."
            : "AI prepared a new template draft. Review and apply it to the workspace.")
      );
      setAiMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text:
            payload?.assistantMessage ||
            (nextMode === "modify"
              ? `Prepared an updated draft for "${payload.template.name ?? draft.name}". Review and apply it if it looks correct.`
              : `Prepared a new draft called "${payload.template.name ?? "Untitled template"}". Review and apply it if it looks correct.`)
        }
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process AI request.";
      setAiError(message);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: message
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function applyPendingAiDraft() {
    if (!pendingAiDraft) return;
    setDraft(pendingAiDraft);
    setPendingAiDraft(null);
    setPendingAiSummary(null);
  }

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col gap-3 overflow-y-auto lg:h-[calc(100dvh-96px)] lg:min-h-[620px] lg:overflow-hidden">
      <div className="dr-card flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Template workspace
          </p>
          {editingTitle ? (
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setEditingTitle(false);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="dr-input h-9 min-w-0 flex-[1.2] text-base font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-serif)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="min-w-0 flex-[1.2] truncate text-left text-base font-semibold text-slate-900 hover:text-slate-700"
              style={{ fontFamily: "var(--font-serif)" }}
              title="Click to rename template"
            >
              {draft.name || "New template"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setInfoModalOpen(true)}
            className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 lg:inline-flex"
          >
            Edit info
          </button>
          <p className="hidden shrink-0 truncate text-xs text-slate-600 md:block">
            {draft.blocks.length} blocks · {totalDuration} min · {templateCount} templates available
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["ai", "modular", "structured"] as WorkspaceMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => updateMode(item)}
              className={
                mode === item ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"
              }
            >
              {item === "ai" ? "AI Builder" : item === "modular" ? "Modular Builder" : "Structured Builder"}
            </button>
          ))}
          <button type="button" className="dr-button px-3 py-1 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </button>
        </div>
        <p className="w-full truncate text-xs text-slate-600 md:hidden">
          {draft.blocks.length} blocks · {totalDuration} min · {templateCount} templates available
        </p>
        <button
          type="button"
          onClick={() => setInfoModalOpen(true)}
          className="w-full text-left text-xs font-semibold text-slate-500 lg:hidden"
        >
          Edit info
        </button>
      </div>

      {infoModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-6">
          <div className="dr-card w-full max-w-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Template info</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Edit template details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                Name
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="dr-input mt-1 w-full"
                />
              </label>
              <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                Description
                <textarea
                  value={draft.description ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  className="dr-input mt-1 min-h-[96px] w-full rounded-2xl px-3 py-2"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Dataspace
                <select
                  value={draft.settings.dataspaceId ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, dataspaceId: event.target.value || null }
                    }))
                  }
                  className="dr-input mt-1 w-full"
                >
                  <option value="">No dataspace</option>
                  {dataspaces.map((dataspace) => (
                    <option key={dataspace.id} value={dataspace.id}>
                      {dataspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Template source
                <select
                  value={draft.id ?? ""}
                  onChange={(event) => {
                    if (!event.target.value) {
                      setDraft(buildDefaultTemplateDraft());
                      const params = new URLSearchParams(searchParams?.toString() || "");
                      params.delete("templateId");
                      params.set("mode", mode);
                      router.replace(`/templates/workspace?${params.toString()}`);
                      return;
                    }
                    loadTemplateById(event.target.value);
                  }}
                  className="dr-input mt-1 w-full"
                >
                  <option value="">Unsaved draft</option>
                  {templatesState.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Language
                <select
                  value={draft.settings.language}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, language: event.target.value }
                    }))
                  }
                  className="dr-input mt-1 w-full"
                >
                  <option value="EN">EN</option>
                  <option value="IT">IT</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Transcription
                <select
                  value={draft.settings.transcriptionProvider}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, transcriptionProvider: event.target.value }
                    }))
                  }
                  className="dr-input mt-1 w-full"
                >
                  <option value="DEEPGRAM">Deepgram</option>
                  <option value="DEEPGRAMLIVE">Deepgram Live</option>
                  <option value="VOSK">Vosk</option>
                  <option value="WHISPERREMOTE">Whisper Remote</option>
                  <option value="AUTOREMOTE">Auto Remote</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Room size
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={draft.settings.maxParticipantsPerRoom}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        maxParticipantsPerRoom: Number(event.target.value || 2)
                      }
                    }))
                  }
                  className="dr-input mt-1 w-full"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Capacity
                <input
                  type="number"
                  min={1}
                  value={draft.settings.capacity ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        capacity: event.target.value ? Number(event.target.value) : null
                      }
                    }))
                  }
                  className="dr-input mt-1 w-full"
                  placeholder="Open"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.isPublic}
                  onChange={(event) => setDraft((prev) => ({ ...prev, isPublic: event.target.checked }))}
                />
                Public
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.settings.allowOddGroup}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, allowOddGroup: event.target.checked }
                    }))
                  }
                />
                Allow odd group
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.settings.requiresApproval}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, requiresApproval: event.target.checked }
                    }))
                  }
                />
                Requires approval
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid flex-1 gap-3 min-h-0 xl:grid-cols-[1.55fr,minmax(56px,320px)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            {mode === "modular" ? (
              <ModularBuilderClient
                workspaceMode
                draft={draft}
                onDraftChange={setDraft}
                templates={templatesState}
                dataspaces={dataspaces}
              />
            ) : mode === "structured" ? (
              <StructuredTemplateEditor
                draft={draft}
                posters={posters}
                audioFiles={audioFiles}
                onChange={setDraft}
              />
            ) : (
              <div className="dr-card flex h-full min-h-0 flex-col p-5">
                <h2 className="text-lg font-semibold text-slate-900">AI-first view</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use the AI panel to generate or modify the current template, then switch to Modular or Structured for direct editing.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current draft</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{draft.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{draft.description || "No description"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <div>Language: {draft.settings.language}</div>
                      <div>Transcription: {draft.settings.transcriptionProvider}</div>
                      <div>Room size: {draft.settings.maxParticipantsPerRoom}</div>
                      <div>Capacity: {draft.settings.capacity ?? "Open"}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <div className="space-y-2">
                    {draft.blocks.length === 0 ? (
                      <p className="text-sm text-slate-500">No blocks yet. Ask AI to generate a first draft.</p>
                    ) : (
                      draft.blocks.map((block, index) => (
                        <div key={`${block.type}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="font-semibold text-slate-800">{index + 1}. {block.type}</span>
                          <span className="text-slate-500">{Math.round(block.durationSeconds / 60)} min</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`dr-card flex min-h-0 flex-col p-3 ${aiCollapsed ? "xl:w-[56px]" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`${aiCollapsed ? "sr-only" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI assistant</p>
              <h2 className="text-base font-semibold text-slate-900">Template AI chat</h2>
            </div>
            <button
              type="button"
              onClick={() => setAiCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {aiCollapsed ? "<" : ">"}
            </button>
          </div>

          {!aiCollapsed ? (
            <>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
                <button
                  type="button"
                  onClick={() => setInfoOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Template info
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {infoOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {infoOpen ? (
                  <div className="mt-3 grid gap-3">
                    <label className="text-xs font-medium text-slate-700">
                      Name
                      <input
                        value={draft.name}
                        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                        className="dr-input mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Description
                      <input
                        value={draft.description ?? ""}
                        onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                        className="dr-input mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Dataspace
                      <select
                        value={draft.settings.dataspaceId ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, dataspaceId: event.target.value || null }
                          }))
                        }
                        className="dr-input mt-1 w-full"
                      >
                        <option value="">No dataspace</option>
                        {dataspaces.map((dataspace) => (
                          <option key={dataspace.id} value={dataspace.id}>
                            {dataspace.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Template source
                      <select
                        value={draft.id ?? ""}
                        onChange={(event) => {
                          if (!event.target.value) {
                            setDraft(buildDefaultTemplateDraft());
                            const params = new URLSearchParams(searchParams?.toString() || "");
                            params.delete("templateId");
                            params.set("mode", mode);
                            router.replace(`/templates/workspace?${params.toString()}`);
                            return;
                          }
                          loadTemplateById(event.target.value);
                        }}
                        className="dr-input mt-1 w-full"
                      >
                        <option value="">Unsaved draft</option>
                        {templatesState.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Language
                      <select
                        value={draft.settings.language}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, language: event.target.value }
                          }))
                        }
                        className="dr-input mt-1 w-full"
                      >
                        <option value="EN">English</option>
                        <option value="IT">Italian</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Transcription
                      <select
                        value={draft.settings.transcriptionProvider}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, transcriptionProvider: event.target.value }
                          }))
                        }
                        className="dr-input mt-1 w-full"
                      >
                        <option value="DEEPGRAM">Deepgram</option>
                        <option value="DEEPGRAMLIVE">Deepgram Live</option>
                        <option value="VOSK">Vosk</option>
                        <option value="WHISPERREMOTE">Whisper Remote</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Room size
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={draft.settings.maxParticipantsPerRoom}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              maxParticipantsPerRoom: Math.max(2, Math.min(12, Number(event.target.value) || 2))
                            }
                          }))
                        }
                        className="dr-input mt-1 w-full"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Capacity
                      <input
                        type="number"
                        min={1}
                        value={draft.settings.capacity ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, capacity: event.target.value ? Number(event.target.value) : null }
                          }))
                        }
                        className="dr-input mt-1 w-full"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.isPublic)}
                        onChange={(event) => setDraft((prev) => ({ ...prev, isPublic: event.target.checked }))}
                      />
                      Public
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.settings.allowOddGroup}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, allowOddGroup: event.target.checked }
                          }))
                        }
                      />
                      Allow odd group
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.settings.requiresApproval}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, requiresApproval: event.target.checked }
                          }))
                        }
                      />
                      Requires approval
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/70">
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {aiMessages.map((message) => (
                    <div
                      key={message.id}
                      className={
                        message.role === "user"
                          ? "ml-6 rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 text-sm text-white"
                          : message.role === "assistant"
                            ? "mr-6 rounded-2xl rounded-bl-md bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                            : "rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      }
                    >
                      {message.text}
                    </div>
                  ))}

                  {pendingAiDraft ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-sm font-semibold text-emerald-900">AI draft ready</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    {pendingAiSummary}
                  </p>
                  <div className="mt-3 text-sm text-emerald-900">
                    <div className="font-semibold">{pendingAiDraft.name}</div>
                    <div>{pendingAiDraft.blocks.length} blocks</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="dr-button px-3 py-1 text-xs" onClick={applyPendingAiDraft}>
                      Apply changes
                    </button>
                    <button
                      type="button"
                      className="dr-button-outline px-3 py-1 text-xs"
                      onClick={() => {
                        setPendingAiDraft(null);
                        setPendingAiSummary(null);
                      }}
                    >
                      Discard
                    </button>
                  </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <button
                      type="button"
                      onClick={() => setRawOutputOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Raw output
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {rawOutputOpen ? "Hide" : "Show"}
                      </span>
                    </button>
                    {rawOutputOpen ? (
                      <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                        {aiRaw || "No AI output yet."}
                      </pre>
                    ) : null}
                  </div>
                </div>

                <div className="sticky bottom-0 right-0 border-t border-slate-200 bg-white/95 p-3">
                  <textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    className="dr-input min-h-[104px] w-full text-sm"
                    placeholder="Ask AI to create or modify this template..."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="dr-button px-3 py-1 text-xs" onClick={() => runAi("generate")} disabled={aiLoading}>
                      {aiLoading ? "Working..." : "Generate"}
                    </button>
                    <button
                      type="button"
                      className="dr-button-outline px-3 py-1 text-xs"
                      onClick={() => runAi("modify")}
                      disabled={aiLoading || draft.blocks.length === 0}
                    >
                      Modify
                    </button>
                  </div>
                  {aiError ? <p className="mt-3 text-sm text-rose-600">{aiError}</p> : null}
                  {aiRequestId ? <p className="mt-2 text-[11px] text-slate-400">Request ID: {aiRequestId}</p> : null}
                  {saveMessage ? <p className="mt-2 text-xs text-slate-500">{saveMessage}</p> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-2 text-center text-[10px] text-slate-500">
              <div className="font-semibold uppercase tracking-[0.2em]">AI</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
