"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildDefaultTemplateDraft, type TemplateBlock, type TemplateDraft } from "@/lib/templateDraft";
import { compileTemplateDraft, type TemplateCompileResult } from "@/lib/templateCompile";
import { ModularBuilderClient } from "@/app/modular/ModularBuilderClient";
import { postClientLog } from "@/lib/clientLogs";

type WorkspaceMode = "modular";
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

const AI_INTRO_MESSAGE: AiMessage = {
  id: "intro",
  role: "system",
  text: "Use AI to generate a first draft or modify the current template without leaving the workspace."
};

function serializeDraft(draft: TemplateDraft) {
  return JSON.stringify(draft);
}

const LOCAL_DRAFTS_STORAGE_KEY = "dr_template_workspace_local_drafts_v1";

function getLocalDraftKey(templateId?: string | null) {
  return templateId || "__new__";
}

function readStoredDraftMap() {
  if (typeof window === "undefined") return {} as Record<string, TemplateDraft>;
  try {
    const raw = window.sessionStorage.getItem(LOCAL_DRAFTS_STORAGE_KEY);
    if (!raw) return {} as Record<string, TemplateDraft>;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, TemplateDraft>) : {};
  } catch {
    return {} as Record<string, TemplateDraft>;
  }
}

function writeStoredDraftMap(next: Record<string, TemplateDraft>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LOCAL_DRAFTS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function TemplateWorkspaceClient({
  templates,
  dataspaces,
  initialMode,
  initialTemplateId
}: Props) {
  const initialTemplate = initialTemplateId ? templates.find((item) => item.id === initialTemplateId) ?? null : null;
  const initialDraft = initialTemplate ? mapTemplateToDraft(initialTemplate) : buildDefaultTemplateDraft();
  const initialSavedSignature = serializeDraft(initialDraft);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templatesState, setTemplatesState] = useState<TemplateSummary[]>(templates);
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [draft, setDraft] = useState<TemplateDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialTemplate?.updatedAt ?? null);
  const [lastSavedSignature, setLastSavedSignature] = useState(initialSavedSignature);
  const [aiPrompt, setAiPrompt] = useState(
    "Design a 90-minute citizen assembly template to deliberate on a civic issue. Include context setting, small-group discussion, data capture, and a closing summary."
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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([AI_INTRO_MESSAGE]);
  const [pendingExitHref, setPendingExitHref] = useState<string | null>(null);
  const [pendingExitExternal, setPendingExitExternal] = useState(false);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [compileReport, setCompileReport] = useState<TemplateCompileResult | null>(null);
  const [compileModalOpen, setCompileModalOpen] = useState(false);
  const lastLoadedRouteTemplateIdRef = useRef<string | null>(initialTemplateId ?? null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedAutosaveRef = useRef(false);
  const latestDraftRef = useRef(draft);
  const latestAiMessagesRef = useRef(aiMessages);
  const lastModeRef = useRef<WorkspaceMode>(initialMode);
  const lastDirtyRef = useRef<boolean>(false);
  const localDraftsHydratedRef = useRef(false);

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
  const draftSignature = useMemo(() => serializeDraft(draft), [draft]);
  const isDirty = draftSignature !== lastSavedSignature;
  const templateCount = templatesState.length;
  const totalDuration = useMemo(
    () => Math.round(draft.blocks.reduce((sum, block) => sum + (block.durationSeconds || 0), 0) / 60),
    [draft.blocks]
  );

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    latestAiMessagesRef.current = aiMessages;
  }, [aiMessages]);

  useEffect(() => {
    if (localDraftsHydratedRef.current) return;
    localDraftsHydratedRef.current = true;
    const routeTemplateId = searchParams?.get("templateId") || initialTemplateId || null;
    if (!routeTemplateId) return;
    const stored = readStoredDraftMap();
    const cached = stored[getLocalDraftKey(routeTemplateId)];
    if (!cached) return;
    const cachedSignature = serializeDraft(cached);
    setDraft(cached);
    setLastSavedSignature(routeTemplateId ? initialSavedSignature : cachedSignature);
    if (routeTemplateId !== cached.id) {
      setLastSavedAt(null);
    }
  }, [initialSavedSignature, initialTemplateId, searchParams]);

  useEffect(() => {
    if (!localDraftsHydratedRef.current) return;
    const stored = readStoredDraftMap();
    stored[getLocalDraftKey(draft.id)] = draft;
    writeStoredDraftMap(stored);
  }, [draft]);

  useEffect(() => {
    void postClientLog({
      scope: "template_workspace",
      message: "template_workspace_loaded",
      meta: {
        templateId: currentTemplateId,
        mode,
        blockCount: draft.blocks.length,
        savedTemplateCount: templatesState.length
      }
    });
  // intentionally initial load only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastModeRef.current === mode) return;
    void postClientLog({
      scope: "template_workspace",
      message: "template_workspace_mode_changed",
      meta: {
        fromMode: lastModeRef.current,
        toMode: mode,
        templateId: currentTemplateId,
        isDirty
      }
    });
    lastModeRef.current = mode;
  }, [mode, currentTemplateId, isDirty]);

  useEffect(() => {
    if (lastDirtyRef.current === isDirty) return;
    void postClientLog({
      scope: "template_workspace",
      message: "template_workspace_dirty_state_changed",
      meta: {
        templateId: currentTemplateId,
        mode,
        isDirty,
        blockCount: draft.blocks.length
      }
    });
    lastDirtyRef.current = isDirty;
  }, [isDirty, currentTemplateId, mode, draft.blocks.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty && !saving) return;
      void postClientLog({
        level: "warn",
        scope: "template_workspace",
        message: "template_workspace_beforeunload_blocked",
        meta: {
          templateId: currentTemplateId,
          mode,
          isDirty,
          saving
        }
      });
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, saving]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty || saving) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      const currentUrl = new URL(window.location.href);
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === currentUrl.href) return;
      if (destination.pathname === currentUrl.pathname && destination.search === currentUrl.search) return;
      event.preventDefault();
      setPendingExitHref(destination.href);
      setPendingExitExternal(destination.origin !== currentUrl.origin);
      setExitPromptOpen(true);
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [isDirty, saving]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const nextMode = searchParams?.get("mode");
    if (nextMode === "ai" || nextMode === "modular" || nextMode === "structured") {
      const normalizedMode: WorkspaceMode = "modular";
      setMode(normalizedMode);
      if (nextMode === "ai") {
        setAiCollapsed(false);
      }
      if (isMobile && nextMode === "ai") {
        setMobileAiOpen(true);
      }
    }
  }, [searchParams, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setMobileAiOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const routeTemplateId = searchParams?.get("templateId") || initialTemplateId || null;
    if (!routeTemplateId) {
      if (draft.id) {
        const nextDraft = buildDefaultTemplateDraft();
        setDraft(nextDraft);
        setLastSavedSignature(serializeDraft(nextDraft));
        setLastSavedAt(null);
        setSaveError(null);
        setSaveMessage(null);
      }
      lastLoadedRouteTemplateIdRef.current = null;
      return;
    }
    if (lastLoadedRouteTemplateIdRef.current === routeTemplateId) return;
    const target = templatesState.find((item) => item.id === routeTemplateId);
    if (!target) return;
    lastLoadedRouteTemplateIdRef.current = routeTemplateId;
    const stored = readStoredDraftMap();
    const nextDraft = stored[getLocalDraftKey(routeTemplateId)] ?? mapTemplateToDraft(target);
    setDraft(nextDraft);
    setLastSavedSignature(serializeDraft(mapTemplateToDraft(target)));
    setLastSavedAt(target.updatedAt);
    setSaveError(null);
    setSaveMessage(null);
  }, [searchParams, initialTemplateId, templatesState]);

  useEffect(() => {
    async function loadAssets() {
      try {
        const [posterResponse, audioResponse] = await Promise.all([
          fetch("/api/posters"),
          fetch("/api/meditation/audio")
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
        setAiMessages([AI_INTRO_MESSAGE]);
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
        setAiMessages([AI_INTRO_MESSAGE, ...persisted]);
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

  function confirmDiscardChanges() {
    if (!isDirty && !saving) return true;
    const confirmed = window.confirm("You have unsaved template changes. Discard them and continue?");
    void postClientLog({
      scope: "template_workspace",
      message: confirmed ? "template_workspace_discard_confirmed" : "template_workspace_discard_cancelled",
      meta: {
        templateId: currentTemplateId,
        mode,
        saving
      }
    });
    return confirmed;
  }

  function loadTemplateById(templateId: string) {
    if (!confirmDiscardChanges()) return;
    const target = templatesState.find((item) => item.id === templateId);
    if (!target) return;
    lastLoadedRouteTemplateIdRef.current = templateId;
    const stored = readStoredDraftMap();
    const nextDraft = stored[getLocalDraftKey(templateId)] ?? mapTemplateToDraft(target);
    setDraft(nextDraft);
    setLastSavedSignature(serializeDraft(mapTemplateToDraft(target)));
    setLastSavedAt(target.updatedAt);
    setSaveError(null);
    setSaveMessage(null);
    void postClientLog({
      scope: "template_workspace",
      message: "template_workspace_template_loaded",
      meta: {
        templateId,
        fromTemplateId: currentTemplateId,
        mode
      }
    });
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("templateId", target.id);
    params.set("mode", mode);
    router.replace(`/templates/workspace?${params.toString()}`);
  }

  const performSave = useCallback(async (trigger: "manual" | "auto") => {
    const snapshot = latestDraftRef.current;
    const snapshotSignature = serializeDraft(snapshot);
    let savedSignature = snapshotSignature;
    if (trigger === "auto" && !snapshot.id) {
      return false;
    }
    if (saving) {
      queuedAutosaveRef.current = true;
      return false;
    }
    setSaving(true);
    setSaveError(null);
    if (trigger === "manual") {
      setSaveMessage(null);
    }
    void postClientLog({
      scope: "template_workspace",
      message: trigger === "manual" ? "template_workspace_save_started" : "template_workspace_autosave_started",
      meta: {
        templateId: snapshot.id,
        mode,
        blockCount: snapshot.blocks.length
      }
    });
    try {
      const payload = {
        name: snapshot.name?.trim() || "Untitled template",
        description: snapshot.description || null,
        isPublic: Boolean(snapshot.isPublic),
        settings: snapshot.settings,
        blocks: snapshot.blocks
      };
      const response = snapshot.id
        ? await fetch(`/api/plan-templates/${snapshot.id}`, {
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
      const nextId = snapshot.id || result?.id || null;
      const savedAt = new Date().toISOString();
      if (nextId && nextId !== snapshot.id) {
        lastLoadedRouteTemplateIdRef.current = nextId;
        setDraft((prev) => ({ ...prev, id: nextId }));
        const stored = readStoredDraftMap();
        delete stored[getLocalDraftKey(snapshot.id)];
        stored[getLocalDraftKey(nextId)] = { ...snapshot, id: nextId };
        writeStoredDraftMap(stored);
        setTemplatesState((prev) => [
          {
            id: nextId,
            name: snapshot.name?.trim() || "Untitled template",
            description: snapshot.description || null,
            isPublic: Boolean(snapshot.isPublic),
            createdById: "self",
            updatedAt: savedAt,
            settings: snapshot.settings,
            blocks: snapshot.blocks
          },
          ...prev
        ]);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("templateId", nextId);
        params.set("mode", mode);
        router.replace(`/templates/workspace?${params.toString()}`);
        void persistAiHistory(nextId, latestAiMessagesRef.current);
      } else if (nextId) {
        const stored = readStoredDraftMap();
        stored[getLocalDraftKey(nextId)] = { ...snapshot, id: nextId };
        writeStoredDraftMap(stored);
        setTemplatesState((prev) =>
          prev.map((template) =>
            template.id === nextId
              ? {
                  ...template,
                  name: snapshot.name?.trim() || "Untitled template",
                  description: snapshot.description || null,
                  isPublic: Boolean(snapshot.isPublic),
                  updatedAt: savedAt,
                  settings: snapshot.settings,
                  blocks: snapshot.blocks
                }
              : template
          )
        );
      }
      setLastSavedSignature(
        nextId && nextId !== snapshot.id
          ? serializeDraft({ ...snapshot, id: nextId })
          : snapshotSignature
      );
      savedSignature = nextId && nextId !== snapshot.id ? serializeDraft({ ...snapshot, id: nextId }) : snapshotSignature;
      setLastSavedAt(savedAt);
      if (trigger === "manual") {
        setSaveMessage("Template saved.");
      } else {
        setSaveMessage(null);
      }
      void postClientLog({
        scope: "template_workspace",
        message: trigger === "manual" ? "template_workspace_save_succeeded" : "template_workspace_autosave_succeeded",
        meta: {
          templateId: nextId,
          mode,
          blockCount: snapshot.blocks.length
        }
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save template.";
      setSaveError(message);
      setSaveMessage(trigger === "manual" ? message : null);
      void postClientLog({
        level: "error",
        scope: "template_workspace",
        message: trigger === "manual" ? "template_workspace_save_failed" : "template_workspace_autosave_failed",
        meta: {
          templateId: snapshot.id,
          mode,
          blockCount: snapshot.blocks.length,
          error: message
        }
      });
      return false;
    } finally {
      setSaving(false);
      if (queuedAutosaveRef.current) {
        queuedAutosaveRef.current = false;
        const latestSignature = serializeDraft(latestDraftRef.current);
        if (latestSignature !== savedSignature) {
          void performSave("auto");
        }
      }
    }
  }, [mode, persistAiHistory, router, saving, searchParams]);

  useEffect(() => {
    if (!isDirty) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }
    if (!currentTemplateId) {
      return;
    }
    if (saving) {
      queuedAutosaveRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    void postClientLog({
      scope: "template_workspace",
      message: "template_workspace_autosave_scheduled",
      meta: {
        templateId: currentTemplateId,
        mode,
        blockCount: draft.blocks.length
      }
    });
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void performSave("auto");
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [currentTemplateId, draftSignature, isDirty, mode, performSave, saving, draft.blocks.length]);

  async function handleSave() {
    await performSave("manual");
  }

  function closeExitPrompt() {
    setExitPromptOpen(false);
    setPendingExitHref(null);
    setPendingExitExternal(false);
    setExitSaving(false);
  }

  function continuePendingExit() {
    if (!pendingExitHref) {
      closeExitPrompt();
      return;
    }
    const href = pendingExitHref;
    const isExternal = pendingExitExternal;
    closeExitPrompt();
    if (isExternal) {
      window.location.assign(href);
      return;
    }
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const destination = new URL(href, currentOrigin || "http://localhost");
    router.push(`${destination.pathname}${destination.search}${destination.hash}`);
  }

  async function saveAndExit() {
    if (exitSaving) return;
    setExitSaving(true);
    const saved = await performSave("manual");
    if (!saved) {
      setExitSaving(false);
      return;
    }
    continuePendingExit();
  }

  const handleDraftChange = useCallback((nextDraft: TemplateDraft) => {
    setDraft((prev) => {
      const prevSignature = serializeDraft(prev);
      const nextSignature = serializeDraft(nextDraft);
      if (prevSignature === nextSignature) {
        return prev;
      }
      return nextDraft;
    });
  }, []);

  const saveStatus = saving
    ? { label: "Saving...", className: "border-amber-200 bg-amber-50 text-amber-700" }
    : saveError
      ? { label: "Autosave failed", className: "border-rose-200 bg-rose-50 text-rose-700" }
      : isDirty
        ? { label: "Unsaved changes", className: "border-slate-200 bg-slate-100 text-slate-600" }
        : !currentTemplateId
          ? { label: "Not saved yet", className: "border-slate-200 bg-slate-50 text-slate-500" }
        : {
            label: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Saved",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700"
          };

  function handleCompileTemplate() {
    const result = compileTemplateDraft(draft);
    setCompileReport(result);
    setCompileModalOpen(true);
    void postClientLog({
      level: result.ok ? "info" : "warn",
      scope: "template_workspace",
      message: "template_workspace_compile_run",
      meta: {
        templateId: currentTemplateId,
        ok: result.ok,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        discussionRounds: result.discussionRounds,
        segmentCount: result.segmentCount
      }
    });
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

  function renderAiPanel(options?: { mobile?: boolean }) {
    const mobile = options?.mobile ?? false;
    return (
      <div
        className={
          mobile
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-white"
            : `dr-card flex min-h-0 flex-col p-3 ${aiCollapsed ? "xl:w-[56px]" : ""}`
        }
      >
        <div className={`flex items-center justify-between gap-2 ${mobile ? "border-b border-slate-200 px-4 py-3" : ""}`}>
          <div className={`${!mobile && aiCollapsed ? "sr-only" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI assistant</p>
            <h2 className="text-base font-semibold text-slate-900">Template AI chat</h2>
          </div>
          {mobile ? (
            <button
              type="button"
              onClick={() => setMobileAiOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAiCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {aiCollapsed ? "<" : ">"}
            </button>
          )}
        </div>

        {(!mobile && aiCollapsed) ? (
          <div className="mt-2 text-center text-[10px] text-slate-500">
            <div className="font-semibold uppercase tracking-[0.2em]">AI</div>
          </div>
        ) : (
          <>
            {!mobile ? (
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
                            if (!confirmDiscardChanges()) return;
                            const nextDraft = buildDefaultTemplateDraft();
                            setDraft(nextDraft);
                            setLastSavedSignature(serializeDraft(nextDraft));
                            setLastSavedAt(null);
                            setSaveError(null);
                            setSaveMessage(null);
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
                        <option value="GLADIALIVE">Gladia Live</option>
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
            ) : null}

            <div className={`${mobile ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/70"}`}>
              <div className={`flex-1 space-y-3 overflow-y-auto ${mobile ? "px-4 py-3" : "p-3"}`}>
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
                    <p className="mt-1 text-sm text-emerald-800">{pendingAiSummary}</p>
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

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => setRawOutputOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Raw output
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {rawOutputOpen ? "−" : "+"}
                    </span>
                  </button>
                  {rawOutputOpen ? (
                    <pre className="mt-1.5 max-h-[96px] overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 px-2 py-1.5 text-[10px] leading-4 text-slate-500">
                      {aiRaw || "No AI output yet."}
                    </pre>
                  ) : null}
                </div>
              </div>

              <div className={`border-t border-slate-200 bg-white/95 ${mobile ? "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3" : "sticky bottom-0 right-0 p-3"}`}>
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
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${isMobile ? "pb-24" : "overflow-hidden"}`}>
      <div className={`sticky top-0 z-20 ${isMobile ? "border-b border-slate-200/80 bg-[#f7f7f3]/95 px-0 py-0 backdrop-blur" : ""}`}>
        <div className={`dr-card flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 border-t-0 ${isMobile ? "px-3 py-2 shadow-none" : "px-4 py-2"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
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
            {!isMobile ? (
              <>
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
              </>
            ) : (
              <p className="truncate text-[11px] text-slate-500">
                {draft.blocks.length} blocks · {totalDuration} min
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${saveStatus.className}`}>
              {saveStatus.label}
            </span>
            {isMobile ? (
              <>
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(true)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                >
                  Info
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAiOpen(true)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                >
                  AI
                </button>
                <button type="button" className="dr-button-outline px-3 py-1 text-xs" onClick={handleCompileTemplate}>
                  Compile
                </button>
                <button type="button" className="dr-button px-3 py-1 text-xs" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <span className="dr-button px-3 py-1 text-xs">Modular Builder</span>
                <button type="button" className="dr-button-outline px-3 py-1 text-xs" onClick={handleCompileTemplate}>
                  Compile template
                </button>
                <button type="button" className="dr-button px-3 py-1 text-xs" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save template"}
                </button>
              </>
            )}
          </div>
          {!isMobile ? (
            <>
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
            </>
          ) : null}
        </div>
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
                      if (!confirmDiscardChanges()) return;
                      const nextDraft = buildDefaultTemplateDraft();
                      setDraft(nextDraft);
                      setLastSavedSignature(serializeDraft(nextDraft));
                      setLastSavedAt(null);
                      setSaveError(null);
                      setSaveMessage(null);
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
                  <option value="GLADIALIVE">Gladia Live</option>
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

      {exitPromptOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="dr-card w-full max-w-md p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Unsaved changes
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Save template before leaving?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              If you leave this page now, the current unsaved template draft will be lost.
            </p>
            {saveError ? <p className="mt-3 text-sm text-rose-600">{saveError}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveAndExit}
                className="dr-button px-3 py-1 text-xs"
                disabled={exitSaving || saving}
              >
                {exitSaving || saving ? "Saving..." : "Save and leave"}
              </button>
              <button
                type="button"
                onClick={continuePendingExit}
                className="dr-button-outline px-3 py-1 text-xs"
              >
                Leave without saving
              </button>
              <button
                type="button"
                onClick={closeExitPrompt}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Stay here
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {compileModalOpen && compileReport ? (
        <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="dr-card w-full max-w-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Template compile
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  {compileReport.ok ? "Template can run" : "Template has blocking issues"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {compileReport.discussionRounds} discussion rounds · {compileReport.segmentCount} runtime segments · {compileReport.totalDurationMinutes} min total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompileModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Errors</p>
                {compileReport.errors.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-700">No blocking errors.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-rose-800">
                    {compileReport.errors.map((issue, index) => (
                      <li key={`workspace-compile-error-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Warnings</p>
                {compileReport.warnings.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No warnings.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-amber-900">
                    {compileReport.warnings.map((issue, index) => (
                      <li key={`workspace-compile-warning-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`grid flex-1 min-h-0 gap-0 ${isMobile ? "grid-cols-1 px-0" : aiCollapsed ? "xl:grid-cols-[minmax(0,1fr),56px]" : "xl:grid-cols-[minmax(0,1fr),minmax(280px,320px)]"}`}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <ModularBuilderClient
              workspaceMode
              draft={draft}
              onDraftChange={handleDraftChange}
              templates={templatesState}
              dataspaces={dataspaces}
            />
          </div>
        </div>

        {!isMobile ? renderAiPanel() : null}
      </div>

      {isMobile ? (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
            <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-2 rounded-full border border-slate-200/90 bg-white/96 p-2 shadow-[0_22px_50px_rgba(15,23,42,0.18)] backdrop-blur">
              <span className="flex-1 rounded-full bg-slate-900 px-3 py-2 text-center text-[11px] font-semibold text-white">
                Modular
              </span>
            </div>
          </div>

          {mobileAiOpen ? (
            <div className="fixed inset-0 z-40 flex items-end bg-slate-950/35">
              <button type="button" className="absolute inset-0" onClick={() => setMobileAiOpen(false)} aria-label="Close AI assistant" />
              <div className="relative flex h-[78dvh] w-full flex-col rounded-t-[30px] border-t border-slate-200 shadow-[0_-20px_60px_rgba(15,23,42,0.25)]">
                {renderAiPanel({ mobile: true })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
