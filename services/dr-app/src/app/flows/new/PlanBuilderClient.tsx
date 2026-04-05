"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { MEDITATION_ANIMATIONS } from "@/lib/meditation";
import { renderPosterHtml } from "@/lib/poster";
import { logClientError } from "@/lib/clientLog";

type UserOption = {
  id: string;
  email: string;
};

type DataspaceOption = {
  id: string;
  name: string;
};

type Props = {
  users: UserOption[];
  dataspaces: DataspaceOption[];
  mode?: "create" | "edit";
  builderModeOverride?: "template" | "plan";
  initialPlan?: {
    id: string;
    title: string;
    description: string | null;
    startAt: string;
    roundDurationMinutes: number;
    roundsCount: number;
    syncMode: "SERVER" | "CLIENT";
    maxParticipantsPerRoom: number;
    allowOddGroup?: boolean;
    language: string;
    transcriptionProvider: string;
    timezone: string | null;
    meditationEnabled: boolean;
    meditationAtStart: boolean;
    meditationBetweenRounds: boolean;
    meditationAtEnd: boolean;
    meditationDurationMinutes: number;
    meditationAnimationId: string | null;
    meditationAudioUrl: string | null;
    dataspaceId: string | null;
    isPublic: boolean;
    requiresApproval: boolean;
    capacity: number | null;
    participantIds: string[];
    blocks?: Array<{
      id: string;
      type: "START" | "PARTICIPANTS" | "DISCUSSION" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "GROUPING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
      durationSeconds: number;
      roundNumber: number | null;
      roundMaxParticipants?: number | null;
      formQuestion?: string | null;
      formChoices?: Array<{ key: string; label: string }> | null;
      posterId: string | null;
      embedUrl?: string | null;
      harmonicaUrl?: string | null;
      matchingMode?: "polar" | "anti" | "random" | null;
      meditationAnimationId?: string | null;
      meditationAudioUrl?: string | null;
    }>;
  } | null;
};

function toLocalDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toLocalTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(11, 16);
}

type PlanBlockDraft = {
  id: string;
  type: "START" | "PARTICIPANTS" | "DISCUSSION" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "GROUPING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
  durationSeconds: number;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | "random" | null;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

type PosterItem = {
  id: string;
  title: string;
  content: string;
  updatedAt?: string;
};

type PlanTemplate = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  isPublic: boolean;
  createdById: string;
  settings?: {
    syncMode?: "SERVER" | "CLIENT";
    maxParticipantsPerRoom?: number;
    allowOddGroup?: boolean;
    language?: string;
    transcriptionProvider?: string;
    timezone?: string | null;
    dataspaceId?: string | null;
    requiresApproval?: boolean;
    capacity?: number | null;
  } | null;
  blocks: Array<{
    type: "START" | "PARTICIPANTS" | "DISCUSSION" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "GROUPING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
    durationSeconds: number;
    roundMaxParticipants?: number | null;
    formQuestion?: string | null;
    formChoices?: Array<{ key: string; label: string }> | null;
    posterId?: string | null;
    embedUrl?: string | null;
    harmonicaUrl?: string | null;
    matchingMode?: "polar" | "anti" | "random" | null;
    meditationAnimationId?: string | null;
    meditationAudioUrl?: string | null;
  }>;
};

function normalizeFormError(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  const formError = payload?.error?.formErrors?.[0];
  if (typeof formError === "string") return formError;
  const fieldErrors = payload?.error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstValue = firstKey ? fieldErrors[firstKey]?.[0] : null;
    if (typeof firstValue === "string") return firstValue;
  }
  return fallback;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

function makeChoiceKey(label: string) {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `choice-${suffix}`;
}

function defaultFormChoices() {
  return [
    { key: makeChoiceKey("Option A"), label: "Option A" },
    { key: makeChoiceKey("Option B"), label: "Option B" },
    { key: makeChoiceKey("Option C"), label: "Option C" }
  ];
}

function normalizeEmailList(raw: string) {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function normalizeEmbedUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return url.toString();
      }
      const id = url.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

function buildTemplateSettingsPayload(input: {
  syncMode: "SERVER" | "CLIENT";
  maxParticipantsPerRoom: number;
  allowOddGroup: boolean;
  language: string;
  transcriptionProvider: string;
  timezone: string;
  resolvedTimezone: string;
  dataspaceId: string;
  requiresApproval: boolean;
  capacity: number | "";
}) {
  return {
    syncMode: input.syncMode,
    maxParticipantsPerRoom: input.maxParticipantsPerRoom,
    allowOddGroup: input.allowOddGroup,
    language: input.language,
    transcriptionProvider: input.transcriptionProvider,
    timezone: input.timezone || input.resolvedTimezone,
    dataspaceId: input.dataspaceId || null,
    requiresApproval: input.requiresApproval,
    capacity: input.capacity === "" ? null : Number(input.capacity)
  };
}

function defaultRoundBlocks(config: {
  roundsCount: number;
  roundDurationMinutes: number;
}): PlanBlockDraft[] {
  const blocks: PlanBlockDraft[] = [];
  const roundSeconds = config.roundDurationMinutes * 60;

  for (let round = 0; round < config.roundsCount; round += 1) {
    blocks.push({
      id: makeId(),
      type: "DISCUSSION",
      durationSeconds: roundSeconds,
      roundMaxParticipants: null
    });
  }

  return blocks;
}

function legacyBlocksFromPlan(config: {
  roundsCount: number;
  roundDurationMinutes: number;
  meditationEnabled: boolean;
  meditationAtStart: boolean;
  meditationBetweenRounds: boolean;
  meditationAtEnd: boolean;
  meditationDurationMinutes: number;
  meditationAnimationId: string | null;
  meditationAudioUrl: string | null;
}): PlanBlockDraft[] {
  if (!config.meditationEnabled) {
    return defaultRoundBlocks({
      roundsCount: config.roundsCount,
      roundDurationMinutes: config.roundDurationMinutes
    });
  }

  const blocks: PlanBlockDraft[] = [];
  const roundSeconds = config.roundDurationMinutes * 60;
  const meditationSeconds = config.meditationDurationMinutes * 60;

  if (config.meditationAtStart) {
    blocks.push({
      id: makeId(),
      type: "PAUSE",
      durationSeconds: meditationSeconds,
      meditationAnimationId: config.meditationAnimationId ?? null,
      meditationAudioUrl: config.meditationAudioUrl ?? null
    });
  }

  for (let round = 0; round < config.roundsCount; round += 1) {
    blocks.push({
      id: makeId(),
      type: "DISCUSSION",
      durationSeconds: roundSeconds,
      roundMaxParticipants: null
    });
    if (config.meditationBetweenRounds && round < config.roundsCount - 1) {
      blocks.push({
        id: makeId(),
        type: "PAUSE",
        durationSeconds: meditationSeconds,
        meditationAnimationId: config.meditationAnimationId ?? null,
        meditationAudioUrl: config.meditationAudioUrl ?? null
      });
    }
  }

  if (config.meditationAtEnd) {
    blocks.push({
      id: makeId(),
      type: "PAUSE",
      durationSeconds: meditationSeconds,
      meditationAnimationId: config.meditationAnimationId ?? null,
      meditationAudioUrl: config.meditationAudioUrl ?? null
    });
  }

  return blocks;
}

export function PlanBuilderClient({
  users,
  dataspaces,
  mode = "create",
  builderModeOverride,
  initialPlan
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("1v1 Rotation");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(10);
  const [roundsCount, setRoundsCount] = useState(6);
  const [syncMode, setSyncMode] = useState<"SERVER" | "CLIENT">("SERVER");
  const [maxParticipantsPerRoom, setMaxParticipantsPerRoom] = useState(2);
  const [allowOddGroup, setAllowOddGroup] = useState(false);
  const [language, setLanguage] = useState("EN");
  const [provider, setProvider] = useState("DEEPGRAM");
  const [timezone, setTimezone] = useState("");
  const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [defaultMeditationAnimationId, setDefaultMeditationAnimationId] = useState(
    MEDITATION_ANIMATIONS[0]?.id ?? ""
  );
  const [defaultMeditationAudioUrl, setDefaultMeditationAudioUrl] = useState("");
  const [showMeditationPreview, setShowMeditationPreview] = useState(false);
  const [previewAnimationId, setPreviewAnimationId] = useState(
    MEDITATION_ANIMATIONS[0]?.id ?? ""
  );
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  const [showMeditationLibrary, setShowMeditationLibrary] = useState(false);
  const [libraryTargetBlockId, setLibraryTargetBlockId] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState(0);
  const [audioFiles, setAudioFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlockDraft[]>([]);
  const [posters, setPosters] = useState<PosterItem[]>([]);
  const [flows, setTemplates] = useState<PlanTemplate[]>([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIsPublic, setTemplateIsPublic] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");
  const [editingTemplateDescription, setEditingTemplateDescription] = useState("");
  const [editingTemplateIsPublic, setEditingTemplateIsPublic] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [posterTitle, setPosterTitle] = useState("");
  const [posterContent, setPosterContent] = useState("");
  const [posterError, setPosterError] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dataspaceId, setDataspaceId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [capacity, setCapacity] = useState<number | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [includeMyself, setIncludeMyself] = useState(true);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSuggestions, setInviteSuggestions] = useState<UserOption[]>([]);
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const planTimelineRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams?.get("templateId") ?? null;
  const customizeFromQuery = searchParams?.get("customize") === "1";
  const builderMode =
    mode === "edit"
      ? "plan"
      : builderModeOverride ?? (searchParams?.get("mode") === "template" ? "template" : "plan");
  const isTemplateMode = builderMode === "template";
  const aiWorkspaceHref = useMemo(() => {
    const params = new URLSearchParams({ mode: "ai" });
    const currentTemplateId = templateIdFromQuery || (mode === "edit" ? initialPlan?.id ?? null : null);
    if (currentTemplateId) {
      params.set("templateId", currentTemplateId);
    }
    return `/templates/workspace?${params.toString()}`;
  }, [initialPlan?.id, mode, templateIdFromQuery]);

  useEffect(() => {
    setOrigin(window.location.origin);
    setPortalReady(true);
  }, []);

  const inviteQuery = useMemo(() => {
    const tokens = inviteEmails.split(/[\n,]/);
    return tokens[tokens.length - 1]?.trim() ?? "";
  }, [inviteEmails]);

  const inviteExclude = useMemo(() => {
    return normalizeEmailList(inviteEmails).join(",");
  }, [inviteEmails]);

  useEffect(() => {
    if (isTemplateMode) return;
    if (!inviteQuery) {
      setInviteSuggestions([]);
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/users?query=${encodeURIComponent(inviteQuery)}&exclude=${encodeURIComponent(inviteExclude)}`
        );
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (active) {
          setInviteSuggestions(payload?.users ?? []);
        }
      } catch (fetchError) {
        if (active) {
          setInviteSuggestions([]);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [inviteQuery, inviteExclude, isTemplateMode]);

  useEffect(() => {
    if (!portalReady) return;
    let active = true;
    async function loadMe() {
      try {
        const response = await fetch("/api/auth/session");
        const payload = await response.json().catch(() => null);
        if (!active) return;
        const userId = payload?.user?.id ?? null;
        setCurrentUserId(userId);
      } catch (error) {
        setCurrentUserId(null);
      }
    }
    loadMe();
    return () => {
      active = false;
    };
  }, [portalReady]);

  useEffect(() => {
    if (isTemplateMode) return;
    if (!currentUserId) return;
    setSelected((prev) => {
      const hasSelf = prev.includes(currentUserId);
      if (includeMyself && !hasSelf) return [...prev, currentUserId];
      if (!includeMyself && hasSelf) return prev.filter((id) => id !== currentUserId);
      return prev;
    });
  }, [currentUserId, includeMyself, isTemplateMode]);

  useEffect(() => {
    if (!initialPlan) return;
    setTitle(initialPlan.title);
    setDescription(initialPlan.description ?? "");
    const startDate = new Date(initialPlan.startAt);
    setStartDate(toLocalDateInput(startDate));
    setStartTime(toLocalTimeInput(startDate));
    setRoundDurationMinutes(initialPlan.roundDurationMinutes);
    setRoundsCount(initialPlan.roundsCount);
    setSyncMode(initialPlan.syncMode);
    setMaxParticipantsPerRoom(initialPlan.maxParticipantsPerRoom);
    setAllowOddGroup(Boolean(initialPlan.allowOddGroup));
    setLanguage(initialPlan.language);
    setProvider(initialPlan.transcriptionProvider);
    setTimezone(initialPlan.timezone ?? "");
    const fallbackAnimation = MEDITATION_ANIMATIONS[0]?.id ?? "";
    const initialAnimation = initialPlan.meditationAnimationId ?? fallbackAnimation;
    setDefaultMeditationAnimationId(initialAnimation);
    setPreviewAnimationId(initialAnimation);
    const initialAudio = initialPlan.meditationAudioUrl ?? "";
    setDefaultMeditationAudioUrl(initialAudio);
    setPreviewAudioUrl(initialAudio);
    setDataspaceId(initialPlan.dataspaceId ?? "");
    setIsPublic(Boolean(initialPlan.isPublic));
    setRequiresApproval(Boolean(initialPlan.requiresApproval));
    setCapacity(initialPlan.capacity ?? "");
    setSelected(initialPlan.participantIds);
    if (currentUserId) {
      setIncludeMyself(initialPlan.participantIds.includes(currentUserId));
    }
    if (initialPlan.blocks && initialPlan.blocks.length > 0) {
      setPlanBlocks(
        initialPlan.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          durationSeconds: block.durationSeconds,
          roundMaxParticipants: block.roundMaxParticipants ?? null,
          formQuestion: block.formQuestion ?? null,
          formChoices: block.formChoices ?? null,
          posterId: block.posterId ?? null,
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: block.matchingMode ?? null,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null
        }))
      );
    } else {
      setPlanBlocks(
        legacyBlocksFromPlan({
          roundsCount: initialPlan.roundsCount,
          roundDurationMinutes: initialPlan.roundDurationMinutes,
          meditationEnabled: initialPlan.meditationEnabled,
          meditationAtStart: initialPlan.meditationAtStart,
          meditationBetweenRounds: initialPlan.meditationBetweenRounds,
          meditationAtEnd: initialPlan.meditationAtEnd,
          meditationDurationMinutes: initialPlan.meditationDurationMinutes,
          meditationAnimationId: initialPlan.meditationAnimationId ?? null,
          meditationAudioUrl: initialPlan.meditationAudioUrl ?? null
        })
      );
    }
  }, [initialPlan]);

  useEffect(() => {
    if (!timezone) {
      setTimezone(resolvedTimezone);
    }
  }, [resolvedTimezone, timezone]);

  useEffect(() => {
    if (mode !== "create") return;
    if (planBlocks.length > 0) return;
    setPlanBlocks(
      defaultRoundBlocks({
        roundsCount,
        roundDurationMinutes
      })
    );
  }, [
    mode,
    planBlocks.length,
    roundsCount,
    roundDurationMinutes
  ]);

  useEffect(() => {
    if (planBlocks.length === 0) return;
    const roundCount = planBlocks.filter((block) => block.type === "DISCUSSION").length;
    if (roundCount > 0 && roundCount !== roundsCount) {
      setRoundsCount(roundCount);
    }
    const firstRound = planBlocks.find((block) => block.type === "DISCUSSION");
    if (firstRound) {
      const minutes = Math.max(1, Math.round(firstRound.durationSeconds / 60));
      if (minutes !== roundDurationMinutes) {
        setRoundDurationMinutes(minutes);
      }
    }
  }, [planBlocks, roundsCount, roundDurationMinutes]);

  useEffect(() => {
    if (!showMeditationPreview) {
      setPreviewLevel(0);
      document.body.style.overflow = "";
      return;
    }

    let active = true;
    let rafId: number | null = null;
    let stream: MediaStream | null = null;
    document.body.style.overflow = "hidden";

    async function startMic() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) return;
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const average = data.reduce((sum, value) => sum + value, 0) / data.length;
          setPreviewLevel(Math.min(1, average / 140));
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } catch (error) {
        setPreviewLevel(0);
      }
    }

    startMic();

    return () => {
      active = false;
      document.body.style.overflow = "";
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showMeditationPreview]);

  useEffect(() => {
    const needsAudio =
      showMeditationLibrary || planBlocks.some((block) => block.type === "PAUSE");
    if (!needsAudio) return;
    let active = true;
    async function loadAudio() {
      const response = await fetch("/api/meditation/audio");
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.ok) {
        setAudioFiles(payload?.files ?? []);
      }
    }
    loadAudio();
    return () => {
      active = false;
    };
  }, [showMeditationLibrary, planBlocks]);

  useEffect(() => {
    const needsPosters =
      showMeditationLibrary ||
      showTemplatesModal ||
      planBlocks.some((block) => block.type === "PROMPT");
    if (!needsPosters || posters.length > 0) return;
    let active = true;
    setPosterError(null);
    async function loadPosters() {
      const response = await fetch("/api/posters");
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.ok) {
        setPosters(payload?.posters ?? []);
      }
    }
    loadPosters();
    return () => {
      active = false;
    };
  }, [showMeditationLibrary, showTemplatesModal, planBlocks, posters.length]);

  useEffect(() => {
    if (!showTemplatesModal) return;
    let active = true;
    async function loadTemplates() {
      setTemplateError(null);
      const response = await fetch("/api/plan-templates");
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setTemplateError(normalizeFormError(payload, "Unable to load templates"));
        return;
      }
      setTemplates(payload?.templates ?? []);
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, [showTemplatesModal]);

  useEffect(() => {
    if (!templateIdFromQuery || flows.length > 0) return;
    let active = true;
    async function loadTemplates() {
      setTemplateError(null);
      const response = await fetch("/api/plan-templates");
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setTemplateError(normalizeFormError(payload, "Unable to load templates"));
        return;
      }
      setTemplates(payload?.templates ?? []);
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, [templateIdFromQuery, flows.length]);

  useEffect(() => {
    if (!templateIdFromQuery) return;
    if (!flows.length) return;
    if (loadedTemplateId === templateIdFromQuery) return;
    const flow = flows.find((item) => item.id === templateIdFromQuery);
    if (!flow) {
      setTemplateError("Template not found.");
      return;
    }
    handleLoadTemplate(flow);
    setTitle(flow.name);
    setDescription(flow.description ?? "");
    setLoadedTemplateId(templateIdFromQuery);
    if (customizeFromQuery && planTimelineRef.current) {
      planTimelineRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [templateIdFromQuery, flows, loadedTemplateId, customizeFromQuery]);

  async function handleAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAudioUploading(true);
    setAudioError(null);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/meditation/audio", {
      method: "POST",
      body: formData
    });
    const payload = await response.json().catch(() => null);
    setAudioUploading(false);
    if (!response.ok) {
    setAudioError(normalizeFormError(payload, "Unable to upload audio"));
      return;
    }
    const newFile = { name: payload.name, url: payload.url };
    setAudioFiles((prev) => [newFile, ...prev]);
    applyMeditationAudio(payload.url, libraryTargetBlockId);
    event.target.value = "";
  }

  function applyMeditationAudio(url: string, targetBlockId?: string | null) {
    if (targetBlockId) {
      updateBlock(targetBlockId, { meditationAudioUrl: url });
      return;
    }
    setDefaultMeditationAudioUrl(url);
  }

  function applyMeditationAnimation(animationId: string, targetBlockId?: string | null) {
    if (targetBlockId) {
      updateBlock(targetBlockId, { meditationAnimationId: animationId });
      return;
    }
    setDefaultMeditationAnimationId(animationId);
  }

  async function handleCreatePoster(event: React.FormEvent) {
    event.preventDefault();
    setPosterError(null);
    setPosterLoading(true);

    const response = await fetch("/api/posters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: posterTitle,
        content: posterContent
      })
    });
    const payload = await response.json().catch(() => null);
    setPosterLoading(false);

    if (!response.ok) {
    setPosterError(normalizeFormError(payload, "Unable to create prompt"));
      return;
    }

    setPosters((prev) => [payload.poster, ...prev]);
    setPosterTitle("");
    setPosterContent("");
  }

  async function handleCreateTemplate(event: React.FormEvent) {
    event.preventDefault();
    setTemplateError(null);
    setTemplateLoading(true);

    const response = await fetch("/api/plan-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        settings: buildTemplateSettingsPayload({
          syncMode,
          maxParticipantsPerRoom,
          allowOddGroup,
          language,
          transcriptionProvider: provider,
          timezone,
          resolvedTimezone,
          dataspaceId,
          requiresApproval,
          capacity
        }),
        blocks: planBlocks.map((block) => ({
          type: block.type,
          durationSeconds: block.durationSeconds,
          roundMaxParticipants: block.roundMaxParticipants ?? null,
          formQuestion: block.formQuestion ?? null,
          formChoices: block.formChoices ?? null,
          posterId: block.posterId ?? null,
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: block.matchingMode ?? null,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null
        })),
        isPublic: templateIsPublic
      })
    });
    const payload = await response.json().catch(() => null);
    setTemplateLoading(false);

    if (!response.ok) {
      setTemplateError(normalizeFormError(payload, "Unable to save template"));
      return;
    }

    setTemplates((prev) => [
      {
        id: payload.id,
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        updatedAt: new Date().toISOString(),
        isPublic: templateIsPublic,
        createdById: currentUserId ?? "self",
        settings: buildTemplateSettingsPayload({
          syncMode,
          maxParticipantsPerRoom,
          allowOddGroup,
          language,
          transcriptionProvider: provider,
          timezone,
          resolvedTimezone,
          dataspaceId,
          requiresApproval,
          capacity
        }),
        blocks: planBlocks.map((block) => ({
          type: block.type,
          durationSeconds: block.durationSeconds,
          roundMaxParticipants: block.roundMaxParticipants ?? null,
          formQuestion: block.formQuestion ?? null,
          formChoices: block.formChoices ?? null,
          posterId: block.posterId ?? null,
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: block.matchingMode ?? null,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null
        }))
      },
      ...prev
    ]);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIsPublic(false);
  }

  async function handleUpdateTemplate(templateId: string) {
    setTemplateError(null);
    setTemplateLoading(true);

    const flow = flows.find((item) => item.id === templateId);
    if (flow && flow.createdById !== currentUserId) {
      setTemplateLoading(false);
      setTemplateError("You can only update templates you created.");
      return;
    }

    const response = await fetch(`/api/plan-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: buildTemplateSettingsPayload({
          syncMode,
          maxParticipantsPerRoom,
          allowOddGroup,
          language,
          transcriptionProvider: provider,
          timezone,
          resolvedTimezone,
          dataspaceId,
          requiresApproval,
          capacity
        }),
        blocks: planBlocks.map((block) => ({
          type: block.type,
          durationSeconds: block.durationSeconds,
          roundMaxParticipants: block.roundMaxParticipants ?? null,
          formQuestion: block.formQuestion ?? null,
          formChoices: block.formChoices ?? null,
          posterId: block.posterId ?? null,
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: block.matchingMode ?? null,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null
        }))
      })
    });
    const payload = await response.json().catch(() => null);
    setTemplateLoading(false);

    if (!response.ok) {
      setTemplateError(normalizeFormError(payload, "Unable to update template"));
      return;
    }

    setTemplates((prev) =>
      prev.map((flow) =>
        flow.id === templateId
          ? {
              ...flow,
              updatedAt: new Date().toISOString(),
              settings: buildTemplateSettingsPayload({
                syncMode,
                maxParticipantsPerRoom,
                allowOddGroup,
                language,
                transcriptionProvider: provider,
                timezone,
                resolvedTimezone,
                dataspaceId,
                requiresApproval,
                capacity
              }),
              blocks: planBlocks.map((block) => ({
                type: block.type,
                durationSeconds: block.durationSeconds,
                roundMaxParticipants: block.roundMaxParticipants ?? null,
                formQuestion: block.formQuestion ?? null,
                formChoices: block.formChoices ?? null,
                posterId: block.posterId ?? null,
                embedUrl: block.embedUrl ?? null,
                harmonicaUrl: block.harmonicaUrl ?? null,
                matchingMode: block.matchingMode ?? null,
                meditationAnimationId: block.meditationAnimationId ?? null,
                meditationAudioUrl: block.meditationAudioUrl ?? null
              }))
            }
          : flow
      )
    );
  }

  async function handleEditTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!editingTemplateId) return;
    const flow = flows.find((item) => item.id === editingTemplateId);
    if (flow && flow.createdById !== currentUserId) {
      setTemplateError("You can only edit templates you created.");
      return;
    }
    setTemplateError(null);
    setTemplateLoading(true);

    const response = await fetch(`/api/plan-templates/${editingTemplateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingTemplateName.trim(),
        description: editingTemplateDescription.trim() || null,
        isPublic: editingTemplateIsPublic
      })
    });
    const payload = await response.json().catch(() => null);
    setTemplateLoading(false);

    if (!response.ok) {
      setTemplateError(normalizeFormError(payload, "Unable to update template"));
      return;
    }

    setTemplates((prev) =>
      prev.map((flow) =>
        flow.id === editingTemplateId
          ? {
              ...flow,
              name: editingTemplateName.trim(),
              description: editingTemplateDescription.trim() || null,
              isPublic: editingTemplateIsPublic,
              updatedAt: new Date().toISOString()
            }
          : flow
      )
    );
    setEditingTemplateId(null);
  }

  function handleLoadTemplate(template: PlanTemplate) {
    const posterSet = new Set(posters.map((poster) => poster.id));
    const hasPosterCatalog = posterSet.size > 0;
    const nextBlocks = template.blocks.map((block) => ({
      id: makeId(),
      type: block.type,
      durationSeconds: block.durationSeconds,
      roundMaxParticipants: block.roundMaxParticipants ?? null,
      formQuestion: block.formQuestion ?? null,
      formChoices: block.formChoices ?? null,
      posterId:
        block.posterId && (hasPosterCatalog ? posterSet.has(block.posterId) : true)
          ? block.posterId
          : null,
      embedUrl: block.embedUrl ?? null,
      harmonicaUrl: block.harmonicaUrl ?? null,
      matchingMode: block.matchingMode ?? null,
      meditationAnimationId: block.meditationAnimationId ?? defaultMeditationAnimationId,
      meditationAudioUrl: block.meditationAudioUrl ?? defaultMeditationAudioUrl
    }));
    setPlanBlocks(nextBlocks);
    setSyncMode(template.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER");
    setMaxParticipantsPerRoom(
      Math.max(2, Math.min(12, Number(template.settings?.maxParticipantsPerRoom ?? 2) || 2))
    );
    setAllowOddGroup(Boolean(template.settings?.allowOddGroup));
    setLanguage(template.settings?.language === "IT" ? "IT" : "EN");
    setProvider(template.settings?.transcriptionProvider ?? "DEEPGRAM");
    setTimezone(template.settings?.timezone ?? "");
    setDataspaceId(template.settings?.dataspaceId ?? "");
    setRequiresApproval(Boolean(template.settings?.requiresApproval));
    setCapacity(
      typeof template.settings?.capacity === "number" && Number.isFinite(template.settings.capacity)
        ? template.settings.capacity
        : ""
    );
    setShowTemplatesModal(false);
  }

  function toggleUser(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function addBlock(type: PlanBlockDraft["type"]) {
    const defaults: Record<PlanBlockDraft["type"], number> = {
      START: 60,
      PARTICIPANTS: 90,
      DISCUSSION: roundDurationMinutes * 60,
      PAUSE: 5 * 60,
      PROMPT: 30,
      NOTES: 300,
      RECORD: 180,
      FORM: 120,
      EMBED: 180,
      GROUPING: 60,
      BREAK: 300,
      HARMONICA: 90,
      DEMBRANE: 90,
      DELIBERAIDE: 90,
      POLIS: 90,
      AGORACITIZENS: 90,
      NEXUSPOLITICS: 90,
      SUFFRAGO: 90
    };
    setPlanBlocks((prev) => [
      ...prev,
      {
        id: makeId(),
        type,
        durationSeconds: defaults[type],
        roundMaxParticipants: type === "DISCUSSION" ? null : null,
        formQuestion: type === "FORM" ? "" : null,
        formChoices: type === "FORM" ? defaultFormChoices() : null,
        posterId: null,
        embedUrl: type === "EMBED" ? "" : null,
        harmonicaUrl: type === "HARMONICA" ? "" : null,
        matchingMode: type === "GROUPING" ? "polar" : null,
        meditationAnimationId:
          type === "PAUSE" ? defaultMeditationAnimationId || null : null,
        meditationAudioUrl: type === "PAUSE" ? defaultMeditationAudioUrl || null : null
      }
    ]);
  }

  function updateRoundDurationMinutes(nextMinutes: number) {
    setRoundDurationMinutes(nextMinutes);
    setPlanBlocks((prev) =>
      prev.map((block) =>
        block.type === "DISCUSSION"
          ? { ...block, durationSeconds: Math.max(10, nextMinutes * 60) }
          : block
      )
    );
  }

  function updateRoundsCount(nextCount: number) {
    const clamped = Math.max(1, nextCount);
    setRoundsCount(clamped);
    setPlanBlocks((prev) => {
      const currentRounds = prev.filter((block) => block.type === "DISCUSSION");
      const delta = clamped - currentRounds.length;
      if (delta === 0) return prev;
      if (delta < 0) {
        let toRemove = Math.abs(delta);
        const next: PlanBlockDraft[] = [];
        for (const block of prev) {
          if (block.type === "DISCUSSION" && toRemove > 0) {
            toRemove -= 1;
            continue;
          }
          next.push(block);
        }
        return next;
      }
      const additions = Array.from({ length: delta }, () => ({
        id: makeId(),
        type: "DISCUSSION" as const,
        durationSeconds: Math.max(10, roundDurationMinutes * 60),
        roundMaxParticipants: null,
        posterId: null
      }));
      return [...prev, ...additions];
    });
  }

  function updateBlock(id: string, updates: Partial<PlanBlockDraft>) {
    setPlanBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...updates } : block))
    );
  }

  function removeBlock(id: string) {
    setPlanBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function reorderBlocks(sourceId: string, targetId: string) {
    setPlanBlocks((prev) => {
      const sourceIndex = prev.findIndex((block) => block.id === sourceId);
      const targetIndex = prev.findIndex((block) => block.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handleInviteSelect(email: string) {
    setInviteEmails((prev) => prev.replace(/[^,\n]*$/, `${email}, `));
    setInviteSuggestions([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLogId(null);
    setInviteStatus(null);
    setLoading(true);

    if (!isTemplateMode) {
      if (isPublic && !dataspaceId) {
        setLoading(false);
        setError("Select a dataspace for public templates.");
        return;
      }
      if (!startDate || !startTime) {
        setLoading(false);
        setError("Select both date and time.");
        return;
      }
    }

    const startAt = isTemplateMode
      ? ""
      : new Date(`${startDate}T${startTime}`).toISOString();
    const effectiveBlocks =
      planBlocks.length > 0
        ? planBlocks
        : defaultRoundBlocks({
            roundsCount,
            roundDurationMinutes
          });
    const normalizedBlocks = effectiveBlocks.map((block) =>
      block.type === "EMBED"
        ? {
            ...block,
            embedUrl: normalizeEmbedUrl(block.embedUrl ?? "") || null
          }
        : block.type === "HARMONICA"
          ? {
              ...block,
              harmonicaUrl: normalizeEmbedUrl(block.harmonicaUrl ?? "") || null
            }
        : block
    );
    const roundBlocks = normalizedBlocks.filter((block) => block.type === "DISCUSSION");
    const meditationBlocks = normalizedBlocks.filter((block) => block.type === "PAUSE");
    const firstMeditationBlock = meditationBlocks[0] ?? null;
    const missingEmbed = normalizedBlocks.some(
      (block) => block.type === "EMBED" && !block.embedUrl
    );
    const missingHarmonica = normalizedBlocks.some(
      (block) => block.type === "HARMONICA" && !block.harmonicaUrl
    );
    if (missingEmbed) {
      setLoading(false);
      setError("Enter a URL for every embed block.");
      return;
    }
    if (missingHarmonica) {
      setLoading(false);
      setError("Enter a URL for every Harmonica block.");
      return;
    }
    const roundDuration = roundBlocks.length
      ? Math.max(
          1,
          Math.round((roundBlocks[0]?.durationSeconds ?? roundDurationMinutes * 60) / 60)
        )
      : roundDurationMinutes;

    const isEdit = mode === "edit" && initialPlan?.id;
    const response = await fetch(
      isTemplateMode
        ? "/api/plan-templates"
        : isEdit
          ? `/api/flows/${initialPlan?.id}`
          : "/api/flows",
      {
        method: isTemplateMode ? "POST" : isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isTemplateMode
            ? {
                name: title.trim(),
                description: description.trim() || null,
                isPublic: templateIsPublic,
                blocks: normalizedBlocks.map((block) => ({
                  type: block.type,
                  durationSeconds: block.durationSeconds,
                  roundMaxParticipants: block.roundMaxParticipants ?? null,
                  formQuestion: block.formQuestion ?? null,
                  formChoices: block.formChoices ?? null,
                  posterId: block.posterId ?? null,
                  embedUrl: block.embedUrl ?? null,
                  harmonicaUrl: block.harmonicaUrl ?? null,
                  matchingMode: block.matchingMode ?? null,
                  meditationAnimationId: block.meditationAnimationId ?? null,
                  meditationAudioUrl: block.meditationAudioUrl ?? null
                }))
              }
            : {
                title,
                description,
                startAt,
                roundDurationMinutes: roundDuration,
                roundsCount: roundBlocks.length,
                participantIds: (() => {
                  const base = selected.filter((id) => id !== currentUserId);
                  if (includeMyself && currentUserId) {
                    return [currentUserId, ...base];
                  }
                  return base;
                })(),
                inviteEmails: normalizeEmailList(inviteEmails),
                syncMode,
                maxParticipantsPerRoom,
                allowOddGroup,
                language,
                transcriptionProvider: provider,
                timezone: timezone || resolvedTimezone,
                meditationEnabled: meditationBlocks.length > 0,
                meditationAtStart: false,
                meditationBetweenRounds: false,
                meditationAtEnd: false,
                meditationDurationMinutes:
                  firstMeditationBlock
                    ? Math.max(1, Math.round(firstMeditationBlock.durationSeconds / 60))
                    : 5,
                meditationAnimationId: firstMeditationBlock?.meditationAnimationId ?? null,
                meditationAudioUrl: firstMeditationBlock?.meditationAudioUrl ?? null,
                dataspaceId: dataspaceId || null,
                isPublic,
                requiresApproval,
                capacity: capacity === "" ? null : Number(capacity),
                blocks: normalizedBlocks.map((block) => ({
                  type: block.type,
                  durationSeconds: block.durationSeconds,
                  roundMaxParticipants: block.roundMaxParticipants ?? null,
                  formQuestion: block.formQuestion ?? null,
                  formChoices: block.formChoices ?? null,
                  posterId: block.posterId ?? null,
                  embedUrl: block.embedUrl ?? null,
                  harmonicaUrl: block.harmonicaUrl ?? null,
                  meditationAnimationId: block.meditationAnimationId ?? null,
                  meditationAudioUrl: block.meditationAudioUrl ?? null
                }))
              }
        )
      }
    );

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      const message = normalizeFormError(
        payload,
        isTemplateMode ? "Unable to save template" : "Unable to save plan"
      );
      setError(message);
      const loggedId = await logClientError("plan.save", message, {
        status: response.status,
        payload,
        data: { title, startAt, rounds: roundBlocks.length }
      });
      if (loggedId) setLogId(loggedId);
      return;
    }

    if (!isTemplateMode) {
      const targetPlanId = isEdit ? initialPlan?.id : payload.id;
      if (targetPlanId) {
        const inviteList = normalizeEmailList(inviteEmails);
        if (inviteList.length > 0) {
          setInviteLoading(true);
          const results = await Promise.all(
            inviteList.map(async (email) => {
              try {
                const inviteResponse = await fetch(`/api/flows/${targetPlanId}/invite`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email })
                });
                if (!inviteResponse.ok) {
                  const invitePayload = await inviteResponse.json().catch(() => null);
                  return { email, error: invitePayload?.error ?? "Invite failed" };
                }
                return null;
              } catch (inviteError) {
                return { email, error: "Invite failed" };
              }
            })
          );
          setInviteLoading(false);
          const failures = results.filter(Boolean) as Array<{ email: string; error: string }>;
          if (failures.length > 0) {
            setInviteStatus(
              `Some invites failed: ${failures.map((item) => item.email).join(", ")}`
            );
          } else {
            setInviteStatus("Invites sent.");
          }
        }
      }

      if (isEdit) {
        router.push(`/flows/${initialPlan?.id}`);
        return;
      }

      setPlanId(payload.id);
      return;
    }

    router.push("/flows");
  }

  const libraryActiveBlock = libraryTargetBlockId
    ? planBlocks.find((block) => block.id === libraryTargetBlockId)
    : null;
  const libraryActiveAudioUrl = libraryActiveBlock?.meditationAudioUrl ?? defaultMeditationAudioUrl;
  const libraryActiveAnimationId =
    libraryActiveBlock?.meditationAnimationId ?? defaultMeditationAnimationId;

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            {mode === "edit" ? "Edit template" : "Template Builder"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "edit"
              ? "Update the template definition."
              : isTemplateMode
                ? "Design the template structure and save it."
                : "Create a rotation plan and share the participant link."}
          </p>
        </div>
        {isTemplateMode ? (
          <a href={aiWorkspaceHref} className="dr-button-outline px-3 py-2 text-xs">
            AI Builder
          </a>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">
            {isTemplateMode ? "Template title" : "Template title"}
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Short description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            rows={3}
            maxLength={240}
            placeholder="Optional context for participants."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Minutes per discussion</label>
            <input
              type="number"
              min={1}
              max={240}
              value={roundDurationMinutes}
              onChange={(event) => updateRoundDurationMinutes(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Pairings</label>
            <input
              type="number"
              min={1}
              max={100}
              value={roundsCount}
              onChange={(event) => updateRoundsCount(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
          {!isTemplateMode ? (
            <>
              <div>
                <label className="text-sm font-medium">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
                  required
                />
              </div>
            </>
          ) : null}
        </div>

        {!isTemplateMode ? (
          <div>
            <label className="text-sm font-medium">Max participants per room</label>
            <select
              value={maxParticipantsPerRoom}
              onChange={(event) => setMaxParticipantsPerRoom(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            >
              {Array.from({ length: 11 }, (_, index) => {
                const value = index + 2;
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={allowOddGroup}
                onChange={(event) => setAllowOddGroup(event.target.checked)}
                className="h-4 w-4"
              />
              Allow a 3-person call when participants are odd.
            </label>
          </div>
        ) : null}

        {!isTemplateMode ? (
          <div>
            <label className="text-sm font-medium">Language</label>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            >
              <option value="EN">English</option>
              <option value="IT">Italian</option>
            </select>
          </div>
        ) : null}

        {!isTemplateMode ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Transcription engine</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="provider"
                value="DEEPGRAM"
                checked={provider === "DEEPGRAM"}
                onChange={(event) => setProvider(event.target.value)}
                className="h-4 w-4"
              />
              Deepgram (fast)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="provider"
                value="VOSK"
                checked={provider === "VOSK"}
                onChange={(event) => setProvider(event.target.value)}
                className="h-4 w-4"
              />
              Vosk (slow, privacy friendly)
            </label>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600">
          Pause settings are configured per block in the plan timeline. Add a Pause block
          to choose its own audio and visual effect.
        </div>

        <div
          ref={planTimelineRef}
          className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Template timeline</p>
              <p className="text-xs text-slate-500">
                Arrange the sequence of pairings, pauses, prompts, notes, matching, and embed blocks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPlanBlocks(
                    defaultRoundBlocks({
                      roundsCount,
                      roundDurationMinutes
                    })
                  )
                }
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Regenerate defaults
              </button>
              <button
                type="button"
                onClick={() => {
                  setLibraryTargetBlockId(null);
                  setShowMeditationLibrary(true);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Open library
              </button>
              {!isTemplateMode ? (
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(true)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Templates
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            {planBlocks.length === 0 ? (
              <p className="text-sm text-slate-500">No blocks yet.</p>
            ) : (
              planBlocks.map((block, index) => {
                const minutes = Math.floor(block.durationSeconds / 60);
                const seconds = block.durationSeconds % 60;
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => setDraggingBlockId(block.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingBlockId) {
                        reorderBlocks(draggingBlockId, block.id);
                      }
                      setDraggingBlockId(null);
                    }}
                    onDragEnd={() => setDraggingBlockId(null)}
                    className={`rounded-lg border px-3 py-3 ${
                      draggingBlockId === block.id
                        ? "border-slate-900 bg-slate-50 shadow-sm"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="cursor-grab text-xs font-semibold uppercase text-slate-400">
                          Drag
                        </span>
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {block.type === "DISCUSSION"
                            ? `Discussion ${planBlocks.slice(0, index + 1).filter((item) => item.type === "DISCUSSION").length}`
                            : block.type === "START"
                              ? "Start"
                            : block.type === "PARTICIPANTS"
                              ? "Participants"
                            : block.type === "PAUSE"
                              ? "Pause"
                              : block.type === "PROMPT"
                                ? "Prompt"
                                : block.type === "NOTES"
                                  ? "Notes"
                                  : block.type === "FORM"
                                    ? "Form"
                                    : block.type === "EMBED"
                                      ? "Embed"
                                      : block.type === "GROUPING"
                                        ? "Grouping"
                                        : block.type === "HARMONICA"
                                          ? "Harmonica"
                                          : ["DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(block.type)
                                            ? block.type
                                          : "Record"}
                        </span>
                        <select
                          value={block.type}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              type: event.target.value as PlanBlockDraft["type"],
                              roundMaxParticipants:
                                event.target.value === "DISCUSSION"
                                  ? block.roundMaxParticipants ?? null
                                  : null,
                              formQuestion:
                                event.target.value === "FORM" ? block.formQuestion ?? "" : null,
                              formChoices:
                                event.target.value === "FORM"
                                  ? block.formChoices ?? defaultFormChoices()
                                  : null,
                              posterId:
                                event.target.value === "PROMPT" ? block.posterId ?? null : null,
                              embedUrl:
                                event.target.value === "EMBED" ? block.embedUrl ?? "" : null,
                              harmonicaUrl:
                                event.target.value === "HARMONICA" ? block.harmonicaUrl ?? "" : null,
                              matchingMode:
                                event.target.value === "GROUPING"
                                  ? block.matchingMode ?? "polar"
                                  : null,
                              meditationAnimationId:
                                event.target.value === "PAUSE"
                                  ? block.meditationAnimationId ?? defaultMeditationAnimationId
                                  : null,
                              meditationAudioUrl:
                                event.target.value === "PAUSE"
                                  ? block.meditationAudioUrl ?? defaultMeditationAudioUrl
                                  : null
                            })
                          }
                          className="dr-input h-8 rounded px-2 text-xs"
                        >
                          <option value="DISCUSSION">Discussion</option>
                          <option value="START">Start</option>
                          <option value="PARTICIPANTS">Participants</option>
                          <option value="PAUSE">Pause</option>
                          <option value="PROMPT">Prompt</option>
                          <option value="NOTES">Notes</option>
                          <option value="EMBED">Embed</option>
                          <option value="GROUPING">Grouping</option>
                          <option value="BREAK">Break</option>
                          <option value="HARMONICA">Harmonica</option>
                          <option value="DEMBRANE">Dembrane</option>
                          <option value="DELIBERAIDE">DeliberAIde</option>
                          <option value="POLIS">Pol.is</option>
                          <option value="AGORACITIZENS">Agora Citizens</option>
                          <option value="NEXUSPOLITICS">Nexus Politics</option>
                          <option value="SUFFRAGO">Suffrago</option>
                          <option value="RECORD">Record</option>
                          <option value="FORM">Form</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 text-slate-600">
                          min
                          <input
                            type="number"
                            min={0}
                            value={minutes}
                            onChange={(event) => {
                              const nextMinutes = Number(event.target.value);
                              const minSeconds = block.type === "DISCUSSION" ? 10 : 1;
                              updateBlock(block.id, {
                                durationSeconds: Math.max(
                                  minSeconds,
                                  Math.max(0, nextMinutes) * 60 + seconds
                                )
                              });
                            }}
                            className="dr-input h-8 w-16 rounded px-2 text-xs"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-slate-600">
                          sec
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={seconds}
                            onChange={(event) => {
                              const nextSeconds = Math.min(59, Math.max(0, Number(event.target.value)));
                              const minSeconds = block.type === "DISCUSSION" ? 10 : 1;
                              updateBlock(block.id, {
                                durationSeconds: Math.max(minSeconds, minutes * 60 + nextSeconds)
                              });
                            }}
                            className="dr-input h-8 w-16 rounded px-2 text-xs"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {block.type === "DISCUSSION" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <label className="flex items-center gap-1">
                          Max participants
                          <input
                            type="number"
                            min={2}
                            max={12}
                            value={block.roundMaxParticipants ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              updateBlock(block.id, {
                                roundMaxParticipants:
                                  value === "" ? null : Math.min(12, Math.max(2, Number(value)))
                              });
                            }}
                            placeholder={`Default (${maxParticipantsPerRoom})`}
                            className="dr-input h-8 w-20 rounded px-2 text-xs"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, { roundMaxParticipants: null })}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Use plan default
                        </button>
                      </div>
                    ) : null}
                    {block.type === "FORM" ? (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">
                            Question
                          </label>
                          <input
                            value={block.formQuestion ?? ""}
                            onChange={(event) =>
                              updateBlock(block.id, { formQuestion: event.target.value })
                            }
                            className="dr-input mt-2 w-full rounded px-2 py-2 text-xs"
                            placeholder="Enter the question"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase text-slate-500">Choices</p>
                          {(block.formChoices ?? []).map((choice, choiceIndex) => (
                            <div key={choice.key} className="flex items-center gap-2">
                              <input
                                value={choice.label}
                                onChange={(event) => {
                                  const nextChoices = (block.formChoices ?? []).map(
                                    (item, index) =>
                                      index === choiceIndex
                                        ? { ...item, label: event.target.value }
                                        : item
                                  );
                                  updateBlock(block.id, { formChoices: nextChoices });
                                }}
                                className="dr-input h-8 flex-1 rounded px-2 text-xs"
                                placeholder={`Option ${choiceIndex + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const nextChoices = (block.formChoices ?? []).filter(
                                    (_, index) => index !== choiceIndex
                                  );
                                  updateBlock(block.id, { formChoices: nextChoices });
                                }}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = (block.formChoices ?? []).length + 1;
                              const label = `Option ${nextIndex}`;
                              const nextChoices = [
                                ...(block.formChoices ?? []),
                                { key: makeChoiceKey(label), label }
                              ];
                              updateBlock(block.id, { formChoices: nextChoices });
                            }}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          >
                            + Add option
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {block.type === "PROMPT" ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <select
                          value={block.posterId ?? ""}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              posterId: event.target.value || null
                            })
                          }
                          className="dr-input rounded px-2 py-2 text-xs"
                        >
                          <option value="">Select a prompt</option>
                          {posters.map((poster) => (
                            <option key={poster.id} value={poster.id}>
                              {poster.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setLibraryTargetBlockId(null);
                            setShowMeditationLibrary(true);
                          }}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Open library
                        </button>
                      </div>
                    ) : null}
                    {block.type === "EMBED" ? (
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Embed URL
                        </label>
                        <input
                          value={block.embedUrl ?? ""}
                          onChange={(event) =>
                            updateBlock(block.id, { embedUrl: event.target.value })
                          }
                          onBlur={(event) => {
                            const normalized = normalizeEmbedUrl(event.target.value);
                            updateBlock(block.id, { embedUrl: normalized });
                          }}
                          className="dr-input w-full rounded px-2 py-2 text-xs"
                          placeholder="Paste a YouTube or embeddable URL"
                        />
                        <p className="text-[11px] text-slate-500">
                          YouTube links are converted to embed URLs automatically.
                        </p>
                        {block.embedUrl ? (
                          <a
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                            href={block.embedUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview link
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {block.type === "HARMONICA" ? (
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Harmonica URL
                        </label>
                        <input
                          value={block.harmonicaUrl ?? ""}
                          onChange={(event) =>
                            updateBlock(block.id, { harmonicaUrl: event.target.value })
                          }
                          onBlur={(event) => {
                            const normalized = normalizeEmbedUrl(event.target.value);
                            updateBlock(block.id, { harmonicaUrl: normalized });
                          }}
                          className="dr-input w-full rounded px-2 py-2 text-xs"
                          placeholder="Paste a Harmonica URL"
                        />
                        {block.harmonicaUrl ? (
                          <a
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                            href={block.harmonicaUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview link
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {block.type === "GROUPING" ? (
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Grouping mode
                        </label>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <select
                            value={block.matchingMode ?? "polar"}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                matchingMode: event.target.value as "polar" | "anti" | "random"
                              })
                            }
                            className="dr-input h-8 rounded px-2 text-xs"
                          >
                            <option value="polar">Polarize (similar)</option>
                            <option value="anti">Anti-polarize (contrast)</option>
                            <option value="random">Random</option>
                          </select>
                          <span className="text-[11px] text-slate-500">
                            Uses transcripts to reshape groups when this block starts.
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {block.type === "PAUSE" ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <select
                          value={block.meditationAnimationId ?? ""}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              meditationAnimationId: event.target.value
                            })
                          }
                          className="dr-input rounded px-2 py-2 text-xs"
                        >
                          {MEDITATION_ANIMATIONS.map((animation) => (
                            <option key={animation.id} value={animation.id}>
                              {animation.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={block.meditationAudioUrl ?? ""}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              meditationAudioUrl: event.target.value
                            })
                          }
                          className="dr-input rounded px-2 py-2 text-xs"
                        >
                          <option value="">No audio</option>
                          {audioFiles.map((file) => (
                            <option key={file.name} value={file.url}>
                              {file.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <button
                            type="button"
                            onClick={() => {
                              setLibraryTargetBlockId(block.id);
                              setShowMeditationLibrary(true);
                            }}
                            className="font-semibold text-slate-600 hover:text-slate-900"
                          >
                            Open library
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewAnimationId(
                                block.meditationAnimationId || defaultMeditationAnimationId
                              );
                              setPreviewAudioUrl(
                                block.meditationAudioUrl || defaultMeditationAudioUrl
                              );
                              setShowMeditationPreview(true);
                            }}
                            className="font-semibold text-slate-600 hover:text-slate-900"
                          >
                            Preview effect
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <button type="button" onClick={() => addBlock("DISCUSSION")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Discussion
            </button>
            <button type="button" onClick={() => addBlock("PAUSE")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Pause
            </button>
            <button type="button" onClick={() => addBlock("PROMPT")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Prompt
            </button>
            <button type="button" onClick={() => addBlock("NOTES")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Notes
            </button>
            <button type="button" onClick={() => addBlock("EMBED")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Embed
            </button>
            <button type="button" onClick={() => addBlock("GROUPING")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Grouping
            </button>
            <button type="button" onClick={() => addBlock("START")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Start
            </button>
            <button type="button" onClick={() => addBlock("PARTICIPANTS")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Participants
            </button>
            <button type="button" onClick={() => addBlock("HARMONICA")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Harmonica
            </button>
            <button type="button" onClick={() => addBlock("FORM")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Form
            </button>
            <button type="button" onClick={() => addBlock("RECORD")} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:text-slate-900">
              + Record
            </button>
          </div>
        </div>

        {!isTemplateMode ? (
          <div>
            <label className="text-sm font-medium">Dataspace (optional)</label>
            <select
              value={dataspaceId}
              onChange={(event) => setDataspaceId(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            >
              <option value="">No dataspace</option>
              {dataspaces.map((dataspace) => (
                <option key={dataspace.id} value={dataspace.id}>
                  {dataspace.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={templateIsPublic}
                onChange={(event) => setTemplateIsPublic(event.target.checked)}
                className="h-4 w-4"
              />
              Public template (visible to all users)
            </label>
          </div>
        )}

        {!isTemplateMode ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-4 w-4"
              />
              Public listed (visible to dataspace members)
            </label>
            {isPublic ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(event) => setRequiresApproval(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Requires approval
                </label>
                <div>
                  <label className="text-sm font-medium">Capacity (optional)</label>
                  <input
                    type="number"
                    min={2}
                    value={capacity}
                    onChange={(event) =>
                      setCapacity(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
                    placeholder="No limit"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isTemplateMode ? (
          <div>
            <p className="text-sm font-medium">Switching mode</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="syncMode"
                  value="SERVER"
                  checked={syncMode === "SERVER"}
                  onChange={() => setSyncMode("SERVER")}
                />
                Server-driven (recommended)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="syncMode"
                  value="CLIENT"
                  checked={syncMode === "CLIENT"}
                  onChange={() => setSyncMode("CLIENT")}
                />
                Client-driven
              </label>
            </div>
          </div>
        ) : null}

        {!isTemplateMode ? (
          <>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Participants</p>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={includeMyself}
                    onChange={(event) => setIncludeMyself(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Include myself
                </label>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={user.id === currentUserId ? includeMyself : selected.includes(user.id)}
                      onChange={() =>
                        user.id === currentUserId
                          ? setIncludeMyself((prev) => !prev)
                          : toggleUser(user.id)
                      }
                      disabled={user.id === currentUserId}
                      className="h-4 w-4"
                    />
                    {user.email}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Invite users (optional)</label>
              <div className="relative mt-1">
                <textarea
                  value={inviteEmails}
                  onChange={(event) => setInviteEmails(event.target.value)}
                  className="dr-input w-full rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="email1@example.com, email2@example.com"
                  onFocus={() => setShowInviteSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowInviteSuggestions(false), 150)}
                />
                {showInviteSuggestions && inviteSuggestions.length > 0 ? (
                  <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
                    {inviteSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleInviteSelect(user.email)}
                        className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-100"
                      >
                        {user.email}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">Separate emails with commas or new lines.</p>
              {inviteLoading ? (
                <p className="mt-2 text-xs text-slate-500">Sending invites...</p>
              ) : inviteStatus ? (
                <p className="mt-2 text-xs text-slate-600">{inviteStatus}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {error ? (
          <div className="space-y-1 text-sm">
            <p className="text-red-700">
              {typeof error === "string" ? error : "Something went wrong"}
            </p>
            {logId ? (
              <p className="text-xs text-slate-500">Logged as {logId}</p>
            ) : null}
          </div>
        ) : null}

        <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
          {loading
            ? "Saving..."
            : isTemplateMode
              ? "Create template"
              : mode === "edit"
                ? "Save changes"
                : "Create plan"}
        </button>

        {!isTemplateMode && mode !== "edit" && planId ? (
          <div className="mt-4 rounded border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
            Template created. Share this link with participants:
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={origin ? `${origin}/flows/${planId}` : `/flows/${planId}`}
                className="rounded bg-white px-2 py-1 font-semibold text-slate-900 underline"
                target="_blank"
                rel="noreferrer"
              >
                {origin ? `${origin}/flows/${planId}` : `/flows/${planId}`}
              </a>
              <button
                type="button"
                className="dr-button-outline px-3 py-1 text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${origin || ""}/flows/${planId}`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </form>
      {showMeditationPreview && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70">
              <div className="relative h-full w-full overflow-hidden bg-black/90">
                  <iframe
                    title="Pause preview"
                    src={
                    MEDITATION_ANIMATIONS.find((item) => item.id === previewAnimationId)
                      ?.file
                  }
                  className="h-full w-full"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="h-40 w-40 rounded-full border border-white/40 bg-white/10"
                    style={{
                      transform: `scale(${1 + previewLevel * 0.5})`,
                      transition: "transform 120ms ease-out"
                    }}
                  />
                </div>
                <div className="absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold uppercase text-white/80">
                  Pause Preview
                </div>
                <button
                  type="button"
                  onClick={() => setShowMeditationPreview(false)}
                  className="absolute right-6 top-6 rounded-full border border-white/30 bg-black/60 px-4 py-2 text-xs font-semibold text-white/80"
                >
                  Close preview
                </button>
                {previewAudioUrl ? (
                  <audio src={previewAudioUrl} autoPlay loop className="hidden" />
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
      {showMeditationLibrary && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4">
              <div className="relative h-[90dvh] w-[90vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase text-slate-500">Template library</p>
                    <p className="text-lg font-semibold text-slate-900">
                      Audio, effects, and prompts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeditationLibrary(false);
                      setLibraryTargetBlockId(null);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>
                <div className="grid h-[calc(90dvh-84px)] gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Audio tracks</p>
                    <div className="mt-3 space-y-3">
                      {audioFiles.length === 0 ? (
                        <p className="text-xs text-slate-500">No uploaded tracks yet.</p>
                      ) : (
                        audioFiles.map((file) => (
                          <div
                            key={file.name}
                            className="rounded border border-slate-200 bg-white px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">{file.name}</p>
                              <button
                                type="button"
                                onClick={() => applyMeditationAudio(file.url, libraryTargetBlockId)}
                                className={`text-xs font-semibold ${
                                  libraryActiveAudioUrl === file.url
                                    ? "text-emerald-600"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                {libraryActiveAudioUrl === file.url ? "Selected" : "Use"}
                              </button>
                            </div>
                            <audio controls className="mt-2 w-full">
                              <source src={file.url} />
                            </audio>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-4 rounded border border-slate-200 bg-white/80 px-3 py-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Upload audio</p>
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="text-xs"
                        />
                        <span className="text-xs text-slate-500">
                          {audioUploading ? "Uploading..." : "MP3, WAV, M4A"}
                        </span>
                        {audioError ? (
                          <p className="text-xs text-red-600">
                            {typeof audioError === "string" ? audioError : "Unable to upload audio"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Visual effects</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {MEDITATION_ANIMATIONS.map((animation) => (
                        <button
                          type="button"
                          key={animation.id}
                          onClick={() => applyMeditationAnimation(animation.id, libraryTargetBlockId)}
                          className={`rounded border px-3 py-2 text-left text-sm ${
                            libraryActiveAnimationId === animation.id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {animation.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewAnimationId(
                          libraryTargetBlockId
                            ? planBlocks.find((block) => block.id === libraryTargetBlockId)
                                ?.meditationAnimationId || defaultMeditationAnimationId
                            : defaultMeditationAnimationId
                        );
                        setPreviewAudioUrl(libraryActiveAudioUrl);
                        setShowMeditationPreview(true);
                      }}
                      className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Preview selected effect
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Prompts</p>
                    <form onSubmit={handleCreatePoster} className="mt-3 space-y-2 rounded border border-slate-200 bg-white/80 p-3">
                      <input
                        value={posterTitle}
                        onChange={(event) => setPosterTitle(event.target.value)}
                        placeholder="Prompt title"
                        className="dr-input w-full rounded px-2 py-2 text-xs"
                        required
                      />
                      <textarea
                        value={posterContent}
                        onChange={(event) => setPosterContent(event.target.value)}
                        placeholder="Prompt content. Use **bold** for emphasis."
                        className="dr-input w-full rounded px-2 py-2 text-xs"
                        rows={4}
                        required
                      />
                      {posterError ? (
                        <p className="text-xs text-red-600">
                          {typeof posterError === "string" ? posterError : "Unable to create prompt"}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        className="dr-button-outline px-3 py-1 text-xs"
                        disabled={posterLoading}
                      >
                        {posterLoading ? "Creating..." : "Create prompt"}
                      </button>
                    </form>
                    <div className="mt-3 space-y-3">
                      {posters.length === 0 ? (
                        <p className="text-xs text-slate-500">No prompts yet.</p>
                      ) : (
                        posters.map((poster) => (
                          <div key={poster.id} className="rounded border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">{poster.title}</p>
                            </div>
                            <div
                              className="prose prose-sm mt-2 max-w-none text-slate-700"
                              dangerouslySetInnerHTML={{ __html: renderPosterHtml(poster.content) }}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {!isTemplateMode && showTemplatesModal && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4">
              <div className="relative h-[90dvh] w-[90vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase text-slate-500">Timeline templates</p>
                    <p className="text-lg font-semibold text-slate-900">Save or load plan timelines</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTemplatesModal(false)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>
                <div className="grid h-[calc(90dvh-84px)] gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1fr,1.2fr]">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Save timeline</p>
                    <form onSubmit={handleCreateTemplate} className="mt-3 space-y-3 rounded border border-slate-200 bg-white/80 p-3">
                      <input
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        placeholder="Template name"
                        className="dr-input w-full rounded px-3 py-2 text-sm"
                        required
                      />
                      <textarea
                        value={templateDescription}
                        onChange={(event) => setTemplateDescription(event.target.value)}
                        placeholder="Optional description"
                        className="dr-input w-full rounded px-3 py-2 text-sm"
                        rows={3}
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={templateIsPublic}
                          onChange={(event) => setTemplateIsPublic(event.target.checked)}
                          className="h-4 w-4"
                        />
                        Public template (visible to all users)
                      </label>
                      {templateError ? (
                        <p className="text-xs text-red-600">
                          {typeof templateError === "string" ? templateError : "Unable to save template"}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        className="dr-button-outline px-4 py-2 text-sm"
                        disabled={templateLoading}
                      >
                        {templateLoading ? "Saving..." : "Save template"}
                      </button>
                    </form>

                    {editingTemplateId ? (
                      <form onSubmit={handleEditTemplate} className="mt-6 space-y-3 rounded border border-slate-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Edit details</p>
                        <input
                          value={editingTemplateName}
                          onChange={(event) => setEditingTemplateName(event.target.value)}
                          placeholder="Template name"
                          className="dr-input w-full rounded px-3 py-2 text-sm"
                          required
                        />
                        <textarea
                          value={editingTemplateDescription}
                          onChange={(event) => setEditingTemplateDescription(event.target.value)}
                          placeholder="Optional description"
                          className="dr-input w-full rounded px-3 py-2 text-sm"
                          rows={3}
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={editingTemplateIsPublic}
                            onChange={(event) => setEditingTemplateIsPublic(event.target.checked)}
                            className="h-4 w-4"
                          />
                          Public template (visible to all users)
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="dr-button-outline px-4 py-2 text-sm"
                            disabled={templateLoading}
                          >
                            {templateLoading ? "Saving..." : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTemplateId(null)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Personal templates</p>
                    <div className="mt-3 space-y-3">
                      {flows.filter((flow) => currentUserId && flow.createdById === currentUserId).length === 0 ? (
                        <p className="text-xs text-slate-500">No personal templates yet.</p>
                      ) : (
                        flows
                          .filter((flow) => currentUserId && flow.createdById === currentUserId)
                          .map((flow) => {
                            const isOwner = currentUserId && flow.createdById === currentUserId;
                            const canEdit = Boolean(isOwner);
                            return (
                              <div key={flow.id} className="rounded border border-slate-200 bg-white px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{flow.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {flow.description || "No description"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {flow.isPublic ? (
                                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                          Public
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                          Private
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => handleLoadTemplate(flow)}
                                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:text-slate-900"
                                    >
                                      Load
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTemplate(flow.id)}
                                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:text-slate-900"
                                      disabled={templateLoading || !canEdit}
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTemplateId(flow.id);
                                        setEditingTemplateName(flow.name);
                                        setEditingTemplateDescription(flow.description || "");
                                        setEditingTemplateIsPublic(flow.isPublic);
                                      }}
                                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:text-slate-900"
                                      disabled={!canEdit}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-2 text-[11px] text-slate-400">
                                  Updated {new Date(flow.updatedAt).toLocaleString()}
                                </p>
                              </div>
                            );
                          })
                      )}
                    </div>

                    <p className="mt-6 text-xs font-semibold uppercase text-slate-500">Shared templates</p>
                    <div className="mt-3 space-y-3">
                      {flows.filter((flow) => !currentUserId || flow.createdById !== currentUserId).length === 0 ? (
                        <p className="text-xs text-slate-500">No shared templates yet.</p>
                      ) : (
                        flows
                          .filter((flow) => !currentUserId || flow.createdById !== currentUserId)
                          .map((flow) => {
                            const isOwner = currentUserId && flow.createdById === currentUserId;
                            const canEdit = Boolean(isOwner);
                            return (
                              <div key={flow.id} className="rounded border border-slate-200 bg-white px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{flow.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {flow.description || "No description"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {flow.isPublic ? (
                                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                          Public
                                        </span>
                                      ) : null}
                                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                        Shared
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    {!canEdit ? (
                                      <span className="text-[11px] text-slate-400">Read only</span>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleLoadTemplate(flow)}
                                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:text-slate-900"
                                    >
                                      Load
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-2 text-[11px] text-slate-400">
                                  Updated {new Date(flow.updatedAt).toLocaleString()}
                                </p>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
