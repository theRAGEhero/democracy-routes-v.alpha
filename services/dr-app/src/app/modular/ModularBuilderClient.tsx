"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { MEDITATION_ANIMATIONS } from "@/lib/meditation";
import { buildDefaultTemplateDraft, type TemplateBlock, type TemplateBlockType, type TemplateDraft } from "@/lib/templateDraft";
import { compileTemplateDraft, type TemplateCompileResult } from "@/lib/templateCompile";
import { postClientLog } from "@/lib/clientLogs";
import { isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";

type TemplateSummary = {
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
  blocks: TemplateBlock[];
};

type Poster = {
  id: string;
  title: string;
  content: string;
};

type AudioFileItem = {
  name: string;
  url: string;
};

type AiAgentOption = {
  id: string;
  name: string;
  username: string;
  color: string;
};

type Props = {
  templates?: TemplateSummary[];
  dataspaces: Array<{ id: string; name: string }>;
  initialTemplateId?: string | null;
  draft?: TemplateDraft | null;
  onDraftChange?: (draft: TemplateDraft) => void;
  workspaceMode?: boolean;
};

type BlockType = TemplateBlockType;
type ModuleIconKey =
  | "schedule"
  | "groups"
  | "forum"
  | "pause"
  | "prompt"
  | "notes"
  | "form"
  | "embed"
  | "grouping"
  | "break"
  | "record"
  | "harmonica"
  | "dembrane"
  | "deliberaide"
  | "polis"
  | "agora"
  | "nexus"
  | "suffrago";

type NodeData = {
  durationSeconds?: number;
  startMode?:
    | "specific_datetime"
    | "when_x_join"
    | "organizer_manual"
    | "when_x_join_and_datetime";
  startDate?: string | null;
  startTime?: string | null;
  timezone?: string | null;
  requiredParticipants?: number | null;
  note?: string | null;
  participantMode?:
    | "manual_selected"
    | "dataspace_invite_all"
    | "dataspace_random"
    | "ai_search_users";
  participantUserIds?: string[] | null;
  participantDataspaceIds?: string[] | null;
  participantCount?: number | null;
  participantQuery?: string | null;
  participantNote?: string | null;
  roundMaxParticipants?: number | null;
  aiAgentsEnabled?: boolean | null;
  aiAgentIds?: string[] | null;
  aiAgentIntervalSeconds?: number | null;
  aiAgentCooldownSeconds?: number | null;
  aiAgentMaxReplies?: number | null;
  aiAgentPromptOverride?: string | null;
  posterId?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | "random";
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }>;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
  posterTitle?: string | null;
  posterContent?: string | null;
};

const MODULES: Array<{ type: BlockType; label: string; description: string; color: string; icon: ModuleIconKey }> = [
  {
    type: "START",
    label: "Start",
    description: "Define how and when a template session is allowed to begin.",
    color: "bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-200",
    icon: "schedule"
  },
  {
    type: "PARTICIPANTS",
    label: "Participants",
    description: "Describe who should be invited, selected, or searched for this template.",
    color: "bg-stone-50 text-stone-700 ring-1 ring-inset ring-stone-200",
    icon: "groups"
  },
  {
    type: "DISCUSSION",
    label: "Discussion",
    description: "Split people into small-group calls or rounds for timed discussion.",
    color: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    icon: "forum"
  },
  {
    type: "PAUSE",
    label: "Pause",
    description: "Insert a breathing space, meditation, or silent interval between activities.",
    color: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
    icon: "pause"
  },
  {
    type: "PROMPT",
    label: "Prompt",
    description: "Show a guiding question, instruction, or framing message to participants.",
    color: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    icon: "prompt"
  },
  {
    type: "NOTES",
    label: "Notes",
    description: "Provide written context, notes, or facilitator guidance inside the template.",
    color: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200",
    icon: "notes"
  },
  {
    type: "FORM",
    label: "Form",
    description: "Collect structured participant answers, votes, or short submissions.",
    color: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
    icon: "form"
  },
  {
    type: "EMBED",
    label: "Embed",
    description: "Display external content such as a board, document, or video inside the flow.",
    color: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
    icon: "embed"
  },
  {
    type: "GROUPING",
    label: "Grouping",
    description: "Form rooms for the next discussion block, using random or signal-based grouping logic.",
    color: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    icon: "grouping"
  },
  {
    type: "BREAK",
    label: "Break",
    description: "Insert a simple break block with no extra logic beyond time and pacing.",
    color: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",
    icon: "break"
  },
  {
    type: "RECORD",
    label: "Record",
    description: "Capture spoken contributions or recording-focused moments in the template.",
    color: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
    icon: "record"
  },
  {
    type: "HARMONICA",
    label: "Harmonica",
    description: "Placeholder for future Harmonica integration and deliberation workflows.",
    color: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
    icon: "harmonica"
  },
  {
    type: "DEMBRANE",
    label: "Dembrane",
    description: "Placeholder partner module for Dembrane-linked participation flows.",
    color: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",
    icon: "dembrane"
  },
  {
    type: "DELIBERAIDE",
    label: "DeliberAIde",
    description: "Placeholder partner module for future DeliberAIde assistance.",
    color: "bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-200",
    icon: "deliberaide"
  },
  {
    type: "POLIS",
    label: "Pol.is",
    description: "Placeholder partner module for Pol.is style opinion clustering.",
    color: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200",
    icon: "polis"
  },
  {
    type: "AGORACITIZENS",
    label: "Agora Citizens",
    description: "Placeholder partner module for civic assembly and Agora Citizens flows.",
    color: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    icon: "agora"
  },
  {
    type: "NEXUSPOLITICS",
    label: "Nexus Politics",
    description: "Placeholder partner module for graph-based political collaboration tools.",
    color: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    icon: "nexus"
  },
  {
    type: "SUFFRAGO",
    label: "Suffrago",
    description: "Placeholder partner module for voting, ballots, and suffrage-related tools.",
    color: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    icon: "suffrago"
  }
];

function renderModuleIcon(icon: ModuleIconKey) {
  const base = "h-5 w-5";
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    className: base,
    "aria-hidden": true
  };

  switch (icon) {
    case "schedule":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 9h16" />
          <path d="M8.5 13h3v3h-3z" />
        </svg>
      );
    case "groups":
      return (
        <svg {...common}>
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M4 19a5 5 0 0 1 10 0M14.5 18.5a4 4 0 0 1 5.5 0" />
        </svg>
      );
    case "forum":
      return (
        <svg {...common}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v5A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
          <path d="M9 9h6M9 12h4" />
        </svg>
      );
    case "pause":
    case "break":
      return (
        <svg {...common}>
          <rect x="6.5" y="5" width="3.5" height="14" rx="1.5" />
          <rect x="14" y="5" width="3.5" height="14" rx="1.5" />
        </svg>
      );
    case "prompt":
      return (
        <svg {...common}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
          <path d="M9 8.5h6M9 11.5h4" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
          <path d="M14 4.5V9h4.5M9 12h6M9 15.5h6" />
        </svg>
      );
    case "form":
      return (
        <svg {...common}>
          <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
          <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
        </svg>
      );
    case "embed":
      return (
        <svg {...common}>
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
        </svg>
      );
    case "grouping":
      return (
        <svg {...common}>
          <circle cx="6.5" cy="8" r="2" />
          <circle cx="17.5" cy="8" r="2" />
          <circle cx="12" cy="16" r="2" />
          <path d="M8 9.5 10.5 14M16 9.5 13.5 14" />
        </svg>
      );
    case "record":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "harmonica":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="8" rx="2.5" />
          <path d="M7 8v8M10 8v8M13 8v8M16 8v8" />
        </svg>
      );
    case "dembrane":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" />
        </svg>
      );
    case "deliberaide":
      return (
        <svg {...common}>
          <path d="M12 4.5 18.5 8v8L12 19.5 5.5 16V8z" />
          <path d="M12 9v4M12 16h.01" />
        </svg>
      );
    case "polis":
      return (
        <svg {...common}>
          <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v5A2.5 2.5 0 0 1 15.5 15H11l-3 3v-3H8.5A2.5 2.5 0 0 1 6 12.5z" />
          <path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" />
        </svg>
      );
    case "agora":
      return (
        <svg {...common}>
          <path d="M4.5 19.5h15M6.5 17V9.5L12 6l5.5 3.5V17M9.5 19.5v-4h5v4" />
        </svg>
      );
    case "nexus":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="4.5" height="4.5" rx="1.2" />
          <rect x="14.5" y="5" width="4.5" height="4.5" rx="1.2" />
          <rect x="5" y="14.5" width="4.5" height="4.5" rx="1.2" />
          <rect x="14.5" y="14.5" width="4.5" height="4.5" rx="1.2" />
          <path d="M9.5 7.25h5M7.25 9.5v5M16.75 9.5v5M9.5 16.75h5" />
        </svg>
      );
    case "suffrago":
      return (
        <svg {...common}>
          <path d="M6 5.5h12v4H6zM8 9.5v9M16 9.5v9M5 20.5h14" />
          <path d="m9.5 13 1.5 1.5 3.5-3.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
        </svg>
      );
  }
}

const DEFAULT_DURATIONS: Record<BlockType, number> = {
  START: 0,
  PARTICIPANTS: 90,
  DISCUSSION: 600,
  PAUSE: 300,
  PROMPT: 120,
  NOTES: 120,
  FORM: 120,
  EMBED: 180,
  GROUPING: 60,
  BREAK: 300,
  RECORD: 120,
  HARMONICA: 90,
  DEMBRANE: 90,
  DELIBERAIDE: 90,
  POLIS: 90,
  AGORACITIZENS: 90,
  NEXUSPOLITICS: 90,
  SUFFRAGO: 90
};

const PARTNER_MODULE_TYPES: BlockType[] = [
  "HARMONICA",
  "DEMBRANE",
  "DELIBERAIDE",
  "POLIS",
  "AGORACITIZENS",
  "NEXUSPOLITICS",
  "SUFFRAGO"
];

const BASIC_MODULES = MODULES.filter((module) => !PARTNER_MODULE_TYPES.includes(module.type));
const PARTNER_MODULES = MODULES.filter((module) => PARTNER_MODULE_TYPES.includes(module.type));

declare global {
  interface Window {
    Drawflow?: any;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmbedUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      const id = parsed.searchParams.get("v");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function buildNodeHtml(
  type: BlockType,
  data: NodeData,
  options: {
    posters: Poster[];
    audioFiles: Array<{ name: string; url: string }>;
    aiAgents: AiAgentOption[];
    liveAiSupported: boolean;
  }
) {
  const module = MODULES.find((item) => item.type === type);
  const label = module?.label ?? type;
  const icon = module?.icon ?? "M5 5h14v14H5z";
  const durationValue = data.durationSeconds ?? DEFAULT_DURATIONS[type];
  const duration =
    type === "START"
      ? 0
      : Number.isFinite(durationValue)
        ? Math.max(1, Math.round(durationValue))
        : DEFAULT_DURATIONS[type];

  const posterOptions = options.posters
    .map((poster) => {
      const selected = data.posterId === poster.id ? "selected" : "";
      return `<option value="${escapeHtml(poster.id)}" ${selected}>${escapeHtml(poster.title)}</option>`;
    })
    .join("");

  const audioOptions = options.audioFiles
    .map((file) => {
      const selected = data.meditationAudioUrl === file.url ? "selected" : "";
      return `<option value="${escapeHtml(file.url)}" ${selected}>${escapeHtml(file.name)}</option>`;
    })
    .join("");

  const matchingMode =
    data.matchingMode === "anti" ? "anti" : data.matchingMode === "random" ? "random" : "polar";
  const choicesText = (data.formChoices ?? []).map((choice) => choice.label).join("\n");
  const participantMode = data.participantMode ?? "manual_selected";
  const participantUsersText = (data.participantUserIds ?? []).join("\n");
  const participantDataspacesText = (data.participantDataspaceIds ?? []).join("\n");
  const startMode = data.startMode ?? "specific_datetime";
  const aiAgentsEnabled = Boolean(data.aiAgentsEnabled);
  const selectedAiAgentIds = data.aiAgentIds ?? [];
  const aiAgentsMarkup = !options.liveAiSupported
    ? `<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">AI participants are available only with live transcription.</div>`
    : options.aiAgents.length === 0
      ? `<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">No AI agents available yet.</div>`
      : options.aiAgents
          .map((agent) => {
            const checked = selectedAiAgentIds.includes(agent.id) ? "checked" : "";
            return `<label class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-2 text-[11px] text-slate-700">
              <span class="min-w-0">
                <span class="inline-flex items-center gap-1.5 font-semibold">
                  <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${escapeHtml(agent.color || "#0f172a")}"></span>
                  <span>${escapeHtml(agent.name)}</span>
                </span>
                <span class="block truncate text-[10px] text-slate-500">@${escapeHtml(agent.username)}</span>
              </span>
              <input type="checkbox" data-field="aiAgentIds" value="${escapeHtml(agent.id)}" ${checked} />
            </label>`;
          })
          .join("");

  return `
    <div class="dr-node-card" data-type="${escapeHtml(type)}">
      <div class="dr-node-accent"></div>
      <div class="dr-node-header">
        <div class="dr-node-heading">
          <span class="dr-node-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="${icon}"/></svg>
          </span>
          <div class="dr-node-heading-copy">
            <span class="dr-node-title">${escapeHtml(label)}</span>
            <span class="dr-node-tag">${escapeHtml(type.toLowerCase())}</span>
          </div>
        </div>
        ${
          type === "START"
            ? ""
            : `<button
                type="button"
                class="dr-node-delete"
                data-action="delete-node"
                aria-label="Remove ${escapeHtml(label)} module"
                title="Remove module"
              >
                ×
              </button>`
        }
      </div>
      <div class="dr-node-body">
        ${
          type !== "START"
            ? `<div class="dr-node-label">
                Duration
                <div class="dr-node-duration">
                  <input class="dr-input dr-node-input" type="number" min="0" data-field="durationMinutes" value="${Math.floor(duration / 60)}" />
                  <span class="dr-node-duration-unit">min</span>
                  <input class="dr-input dr-node-input" type="number" min="0" max="59" data-field="durationSecondsPart" value="${duration % 60}" />
                  <span class="dr-node-duration-unit">sec</span>
                </div>
              </div>`
            : ""
        }
        ${
          type === "PARTICIPANTS"
            ? `<label class="dr-node-label">
                Selection mode
                <select class="dr-input dr-node-input" data-field="participantMode">
                  <option value="manual_selected" ${participantMode === "manual_selected" ? "selected" : ""}>Selected or invited manually</option>
                  <option value="dataspace_invite_all" ${participantMode === "dataspace_invite_all" ? "selected" : ""}>Invite all from one or more dataspaces</option>
                  <option value="dataspace_random" ${participantMode === "dataspace_random" ? "selected" : ""}>Randomly extract from dataspaces</option>
                  <option value="ai_search_users" ${participantMode === "ai_search_users" ? "selected" : ""}>AI search in user descriptions</option>
                </select>
              </label>
              ${
                participantMode === "manual_selected"
                  ? `<label class="dr-node-label">
                      User IDs or emails (one per line)
                      <textarea class="dr-input dr-node-textarea" data-field="participantUserIds">${escapeHtml(participantUsersText)}</textarea>
                    </label>`
                  : ""
              }
              ${
                participantMode === "dataspace_invite_all" || participantMode === "dataspace_random"
                  ? `<label class="dr-node-label">
                      Dataspace IDs (one per line)
                      <textarea class="dr-input dr-node-textarea" data-field="participantDataspaceIds">${escapeHtml(participantDataspacesText)}</textarea>
                    </label>`
                  : ""
              }
              ${
                participantMode === "dataspace_random"
                  ? `<label class="dr-node-label">
                      Number of participants
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="participantCount" value="${data.participantCount ?? ""}" />
                    </label>`
                  : ""
              }
              ${
                participantMode === "ai_search_users"
                  ? `<label class="dr-node-label">
                      AI search query
                      <textarea class="dr-input dr-node-textarea" data-field="participantQuery" placeholder="Find participants with relevant description keywords">${escapeHtml(data.participantQuery ?? "")}</textarea>
                    </label>`
                  : ""
              }
              <label class="dr-node-label">
                Note
                <textarea class="dr-input dr-node-textarea" data-field="participantNote" placeholder="Optional participant-selection note">${escapeHtml(data.participantNote ?? "")}</textarea>
              </label>`
            : ""
        }
        ${
          type === "START"
            ? `<label class="dr-node-label">
                Start mode
                <select class="dr-input dr-node-input" data-field="startMode">
                  <option value="specific_datetime" ${startMode === "specific_datetime" ? "selected" : ""}>Specific day and time</option>
                  <option value="when_x_join" ${startMode === "when_x_join" ? "selected" : ""}>When X people join</option>
                  <option value="organizer_manual" ${startMode === "organizer_manual" ? "selected" : ""}>Organizer clicks start</option>
                  <option value="when_x_join_and_datetime" ${startMode === "when_x_join_and_datetime" ? "selected" : ""}>When X join and at a specific day/time</option>
                </select>
              </label>
              ${
                startMode === "specific_datetime" || startMode === "when_x_join_and_datetime"
                  ? `<label class="dr-node-label">
                      Start date
                      <input class="dr-input dr-node-input" type="date" data-field="startDate" value="${escapeHtml(data.startDate ?? "")}" />
                    </label>
                    <label class="dr-node-label">
                      Start time
                      <input class="dr-input dr-node-input" type="time" data-field="startTime" value="${escapeHtml(data.startTime ?? "")}" />
                    </label>
                    <label class="dr-node-label">
                      Timezone
                      <input class="dr-input dr-node-input" type="text" data-field="timezone" value="${escapeHtml(data.timezone ?? "")}" placeholder="Europe/Berlin" />
                    </label>`
                  : ""
              }
              ${
                startMode === "when_x_join" || startMode === "when_x_join_and_datetime"
                  ? `<label class="dr-node-label">
                      Required participants
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="requiredParticipants" value="${data.requiredParticipants ?? ""}" />
                    </label>`
                  : ""
              }
              <label class="dr-node-label">
                Note
                <textarea class="dr-input dr-node-textarea" data-field="note" placeholder="Optional organizer note">${escapeHtml(data.note ?? "")}</textarea>
              </label>`
            : ""
        }
        ${
          type === "DISCUSSION"
            ? `<label class="dr-node-label">
                Max participants
                <input class="dr-input dr-node-input" type="number" min="2" data-field="roundMaxParticipants" value="${data.roundMaxParticipants ?? ""}" />
              </label>
              ${
                options.liveAiSupported
                  ? `<label class="dr-node-label dr-node-checkbox">
                       <input type="checkbox" data-field="aiAgentsEnabled" ${aiAgentsEnabled ? "checked" : ""} />
                       <span>Enable AI participants</span>
                     </label>`
                  : `<div class="dr-node-label"><span>AI participants</span></div>`
              }
              ${
                options.liveAiSupported && aiAgentsEnabled
                  ? `<div class="dr-node-label">
                      <span>Assigned AI agents</span>
                      <div class="mt-2 space-y-2">${aiAgentsMarkup}</div>
                    </div>
                    <label class="dr-node-label">
                      Agent interval (seconds)
                      <input class="dr-input dr-node-input" type="number" min="15" data-field="aiAgentIntervalSeconds" value="${data.aiAgentIntervalSeconds ?? 60}" />
                    </label>
                    <label class="dr-node-label">
                      Cooldown (seconds)
                      <input class="dr-input dr-node-input" type="number" min="15" data-field="aiAgentCooldownSeconds" value="${data.aiAgentCooldownSeconds ?? 120}" />
                    </label>
                    <label class="dr-node-label">
                      Max replies
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="aiAgentMaxReplies" value="${data.aiAgentMaxReplies ?? 5}" />
                    </label>
                    <label class="dr-node-label">
                      Round override prompt
                      <textarea class="dr-input dr-node-textarea" data-field="aiAgentPromptOverride" placeholder="Optional round-specific instruction for selected AI agents">${escapeHtml(data.aiAgentPromptOverride ?? "")}</textarea>
                    </label>`
                  : `<div class="dr-node-label"><div class="mt-2 space-y-2">${aiAgentsMarkup}</div></div>`
              }`
            : ""
        }
        ${
          type === "PROMPT"
            ? `<label class="dr-node-label">
                Prompt source
                <select class="dr-input dr-node-input" data-field="posterId">
                  <option value="">Write prompt directly</option>
                  ${posterOptions}
                </select>
              </label>
              <label class="dr-node-label">
                Prompt title
                <input class="dr-input dr-node-input" type="text" data-field="posterTitle" value="${escapeHtml(data.posterTitle ?? "")}" placeholder="Context setting" />
              </label>
              <label class="dr-node-label">
                Prompt text
                <textarea class="dr-input dr-node-textarea" data-field="posterContent" placeholder="Write the prompt shown to participants">${escapeHtml(data.posterContent ?? data.note ?? "")}</textarea>
                <button
                  type="button"
                  class="mt-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                  data-action="open-prompt-modal"
                >
                  Create or edit prompt
                </button>
              </label>`
            : ""
        }
        ${
          type === "EMBED" || type === "HARMONICA"
            ? `<label class="dr-node-label">
                ${type === "HARMONICA" ? "Harmonica URL" : "Embed URL"}
                <input class="dr-input dr-node-input" type="text" data-field="${type === "HARMONICA" ? "harmonicaUrl" : "embedUrl"}" value="${escapeHtml(type === "HARMONICA" ? data.harmonicaUrl ?? "" : data.embedUrl ?? "")}" placeholder="https://..." />
              </label>`
            : ""
        }
        ${
          type === "GROUPING"
            ? `<label class="dr-node-label">
                Mode
                <select class="dr-input dr-node-input" data-field="matchingMode">
                  <option value="polar" ${matchingMode === "polar" ? "selected" : ""}>Polarize</option>
                  <option value="anti" ${matchingMode === "anti" ? "selected" : ""}>Anti-polarize</option>
                  <option value="random" ${matchingMode === "random" ? "selected" : ""}>Random</option>
                </select>
                <div class="mt-2 text-[11px] leading-4 text-slate-500">
                  Creates rooms for the next Discussion block using that round's room size.
                </div>
              </label>`
            : ""
        }
        ${
          type === "FORM"
            ? `<label class="dr-node-label">
                Question
                <input class="dr-input dr-node-input" type="text" data-field="formQuestion" value="${escapeHtml(data.formQuestion ?? "")}" />
              </label>
              <label class="dr-node-label">
                Options (one per line)
                <textarea class="dr-input dr-node-textarea" data-field="formChoices">${escapeHtml(choicesText)}</textarea>
              </label>`
            : ""
        }
        ${
          type === "PAUSE"
            ? `<label class="dr-node-label">
                Animation
                <select class="dr-input dr-node-input" data-field="meditationAnimationId">
                  ${MEDITATION_ANIMATIONS.map((option) => {
                    const selected = data.meditationAnimationId === option.id ? "selected" : "";
                    return `<option value="${escapeHtml(option.id)}" ${selected}>${escapeHtml(option.label)}</option>`;
                  }).join("")}
                </select>
              </label>
              <label class="dr-node-label">
                Audio
                <select class="dr-input dr-node-input" data-field="meditationAudioUrl">
                  <option value="">No audio</option>
                  ${audioOptions}
                </select>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                    data-action="preview-pause-module"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                    data-action="upload-pause-audio"
                  >
                    Upload audio
                  </button>
                </div>
              </label>`
            : ""
        }
      </div>
    </div>
  `;
}

function nodeDataFromBlock(block: any): NodeData {
  return {
    durationSeconds: block.type === "START" ? 0 : block.durationSeconds ?? DEFAULT_DURATIONS[block.type as BlockType],
    startMode: block.startMode ?? "specific_datetime",
    startDate: block.startDate ?? null,
    startTime: block.startTime ?? null,
    timezone: block.timezone ?? null,
    requiredParticipants: block.requiredParticipants ?? null,
    note: block.note ?? null,
    participantMode: block.participantMode ?? "manual_selected",
    participantUserIds: block.participantUserIds ?? [],
    participantDataspaceIds: block.participantDataspaceIds ?? [],
    participantCount: block.participantCount ?? null,
    participantQuery: block.participantQuery ?? null,
    participantNote: block.participantNote ?? null,
    roundMaxParticipants: block.roundMaxParticipants ?? null,
    aiAgentsEnabled: block.aiAgentsEnabled ?? null,
    aiAgentIds: block.aiAgentIds ?? [],
    aiAgentIntervalSeconds: block.aiAgentIntervalSeconds ?? null,
    aiAgentCooldownSeconds: block.aiAgentCooldownSeconds ?? null,
    aiAgentMaxReplies: block.aiAgentMaxReplies ?? null,
    aiAgentPromptOverride: block.aiAgentPromptOverride ?? null,
    posterId: block.posterId ?? null,
    embedUrl: block.embedUrl ?? null,
    harmonicaUrl: block.harmonicaUrl ?? null,
    matchingMode: block.matchingMode ?? "polar",
    formQuestion: block.formQuestion ?? null,
    formChoices: block.formChoices ?? [],
    posterTitle: block.posterTitle ?? null,
    posterContent: block.posterContent ?? block.note ?? null,
    meditationAnimationId: block.meditationAnimationId ?? null,
    meditationAudioUrl: block.meditationAudioUrl ?? null
  };
}

function buildBlockFromNode(type: BlockType, data: NodeData, liveAiSupported: boolean) {
  const rawDuration = Number(data.durationSeconds || DEFAULT_DURATIONS[type]);
  const durationSeconds =
    type === "START"
      ? 0
      : Number.isFinite(rawDuration)
        ? Math.max(1, Math.round(rawDuration))
        : DEFAULT_DURATIONS[type];
  const rawMax = data.roundMaxParticipants ?? null;
  const roundMaxParticipants =
    type === "DISCUSSION" && typeof rawMax === "number" && rawMax >= 2 ? Math.round(rawMax) : null;
  return {
    type,
    durationSeconds,
    startMode: data.startMode ?? (type === "START" ? "specific_datetime" : null),
    startDate: data.startDate ?? null,
    startTime: data.startTime ?? null,
    timezone: data.timezone ?? null,
    requiredParticipants: data.requiredParticipants ?? null,
    note: data.note ?? null,
    participantMode: data.participantMode ?? (type === "PARTICIPANTS" ? "manual_selected" : null),
    participantUserIds: data.participantUserIds ?? [],
    participantDataspaceIds: data.participantDataspaceIds ?? [],
    participantCount: data.participantCount ?? null,
    participantQuery: data.participantQuery ?? null,
    participantNote: data.participantNote ?? null,
    roundMaxParticipants,
    aiAgentsEnabled: type === "DISCUSSION" && liveAiSupported ? Boolean(data.aiAgentsEnabled) : null,
    aiAgentIds: type === "DISCUSSION" && liveAiSupported && data.aiAgentsEnabled ? data.aiAgentIds ?? [] : [],
    aiAgentIntervalSeconds:
      type === "DISCUSSION" && liveAiSupported && data.aiAgentsEnabled ? data.aiAgentIntervalSeconds ?? 60 : null,
    aiAgentCooldownSeconds:
      type === "DISCUSSION" && liveAiSupported && data.aiAgentsEnabled ? data.aiAgentCooldownSeconds ?? 120 : null,
    aiAgentMaxReplies:
      type === "DISCUSSION" && liveAiSupported && data.aiAgentsEnabled ? data.aiAgentMaxReplies ?? 5 : null,
    aiAgentPromptOverride:
      type === "DISCUSSION" && liveAiSupported && data.aiAgentsEnabled ? data.aiAgentPromptOverride ?? null : null,
    posterId: data.posterId ?? null,
    embedUrl: data.embedUrl ?? null,
    harmonicaUrl: data.harmonicaUrl ?? null,
    matchingMode: data.matchingMode ?? (type === "GROUPING" ? "polar" : null),
    formQuestion: data.formQuestion ?? null,
    formChoices: data.formChoices ?? [],
    posterTitle: data.posterTitle ?? null,
    posterContent: data.posterContent ?? data.note ?? null,
    meditationAnimationId: data.meditationAnimationId ?? null,
    meditationAudioUrl: data.meditationAudioUrl ?? null
  };
}

function buildDefaultData(type: BlockType): NodeData {
  return {
    durationSeconds: type === "START" ? 0 : DEFAULT_DURATIONS[type],
    startMode: type === "START" ? "specific_datetime" : undefined,
    participantMode: type === "PARTICIPANTS" ? "manual_selected" : undefined,
    matchingMode: type === "GROUPING" ? "polar" : undefined
  };
}

function buildDefaultStartBlock(): TemplateBlock {
  return {
    type: "START",
    durationSeconds: 0,
    startMode: "specific_datetime",
    startDate: null,
    startTime: null,
    timezone: null,
    requiredParticipants: null,
    note: null
  };
}

function ensureStartBlock(blocks: TemplateBlock[]): TemplateBlock[] {
  if (blocks.some((block) => block.type === "START")) {
    return blocks;
  }
  return [buildDefaultStartBlock(), ...blocks];
}

function getAutoLayoutPositions(
  count: number,
  canvasWidth: number,
  options?: { startX?: number; startY?: number; cardWidth?: number; gapX?: number; gapY?: number }
) {
  const startX = options?.startX ?? 72;
  const startY = options?.startY ?? 72;
  const cardWidth = options?.cardWidth ?? 248;
  const gapX = options?.gapX ?? 64;
  const gapY = options?.gapY ?? 168;
  const availableWidth = Math.max(canvasWidth - startX * 2, cardWidth);
  const maxColumns = Math.max(1, Math.floor((availableWidth + gapX) / (cardWidth + gapX)));
  const columns = Math.min(Math.max(1, maxColumns), Math.max(1, Math.ceil(Math.sqrt(count || 1))));

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowLength = Math.min(columns, count - row * columns);
    const rowWidth = rowLength * cardWidth + Math.max(0, rowLength - 1) * gapX;
    const rowOffset = Math.max(startX, Math.round((canvasWidth - rowWidth) / 2));
    return {
      x: rowOffset + column * (cardWidth + gapX),
      y: startY + row * gapY
    };
  });
}

function serializeDraft(draft: TemplateDraft | null) {
  return draft ? JSON.stringify(draft) : "";
}

export function ModularBuilderClient({
  templates = [],
  dataspaces,
  initialTemplateId,
  draft,
  onDraftChange,
  workspaceMode = false
}: Props) {
  const { data: session } = useSession();
  const editorRef = useRef<any>(null);
  const drawflowRef = useRef<HTMLDivElement | null>(null);
  const externalDraftSignatureRef = useRef<string>("");
  const appliedExternalDraftSignatureRef = useRef<string>("");
  const emittedDraftSignatureRef = useRef<string>("");
  const fallbackLoggedSignatureRef = useRef<string>("");
  const [drawflowReady, setDrawflowReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modulesCollapsed, setModulesCollapsed] = useState(false);
  const [hoveredModuleTooltip, setHoveredModuleTooltip] = useState<{
    label: string;
    description: string;
    top: number;
    left: number;
  } | null>(null);
  const [templatesCollapsed, setTemplatesCollapsed] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    initialTemplateId || null
  );
  const [templateName, setTemplateName] = useState("New template");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templatePublic, setTemplatePublic] = useState(false);
  const [syncMode, setSyncMode] = useState<"SERVER" | "CLIENT">("SERVER");
  const [maxParticipantsPerRoom, setMaxParticipantsPerRoom] = useState(2);
  const [allowOddGroup, setAllowOddGroup] = useState(false);
  const [language, setLanguage] = useState("EN");
  const [provider, setProvider] = useState("DEEPGRAMLIVE");
  const [timezone, setTimezone] = useState("");
  const [dataspaceId, setDataspaceId] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [capacity, setCapacity] = useState<number | "">("");
  const [pairingMinutes, setPairingMinutes] = useState(10);
  const [pairingCount, setPairingCount] = useState(3);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [compileReport, setCompileReport] = useState<TemplateCompileResult | null>(null);
  const [compileModalOpen, setCompileModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(
    "Design a 90-minute citizen assembly template to deliberate on a civic issue. Include context setting, small-group discussion, data capture, and a closing summary."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRaw, setAiRaw] = useState("");
  const [aiRequestId, setAiRequestId] = useState<string | null>(null);
  const [pendingAiDraft, setPendingAiDraft] = useState<TemplateDraft | null>(null);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [audioFiles, setAudioFiles] = useState<Array<AudioFileItem>>([]);
  const [aiAgents, setAiAgents] = useState<AiAgentOption[]>([]);
  const [pauseAudioUploadNodeId, setPauseAudioUploadNodeId] = useState<number | null>(null);
  const [pauseAudioUploadFile, setPauseAudioUploadFile] = useState<File | null>(null);
  const [pauseAudioUploading, setPauseAudioUploading] = useState(false);
  const [pauseAudioUploadError, setPauseAudioUploadError] = useState<string | null>(null);
  const [pausePreviewOpen, setPausePreviewOpen] = useState(false);
  const [pausePreviewTitle, setPausePreviewTitle] = useState("Pause preview");
  const [pausePreviewAnimationFile, setPausePreviewAnimationFile] = useState(
    MEDITATION_ANIMATIONS[0]?.file ?? ""
  );
  const [pausePreviewAudioUrl, setPausePreviewAudioUrl] = useState<string | null>(null);
  const [promptModalNodeId, setPromptModalNodeId] = useState<number | null>(null);
  const [promptModalTitle, setPromptModalTitle] = useState("");
  const [promptModalContent, setPromptModalContent] = useState("");
  const [templatesState, setTemplatesState] = useState<TemplateSummary[]>(templates);
  const [editorVersion, setEditorVersion] = useState(0);
  const [currentDraftSignature, setCurrentDraftSignature] = useState("");
  const [lastSavedDraftSignature, setLastSavedDraftSignature] = useState("");
  const resolvedTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const externalDraftSignature = useMemo(
    () => (draft ? JSON.stringify(draft) : ""),
    [draft]
  );
  const startModulePresent = useMemo(() => {
    if (!editorRef.current) return false;
    const exported = editorRef.current.export();
    const nodes = Object.values(exported?.drawflow?.Home?.data ?? {}) as any[];
    return nodes.some((node) => node?.name === "START");
  }, [editorVersion]);
  function showModuleTooltip(
    event: any,
    module: { label: string; description: string }
  ) {
    if (isMobile) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredModuleTooltip({
      label: module.label,
      description: module.description,
      top: rect.top + rect.height / 2,
      left: Math.min(rect.right + 14, window.innerWidth - 264)
    });
  }

  function hideModuleTooltip() {
    setHoveredModuleTooltip(null);
  }

  const isDirty = !workspaceMode && currentDraftSignature !== lastSavedDraftSignature;

  function confirmDiscardUnsavedChanges() {
    if (!isDirty) return true;
    if (typeof window === "undefined") return false;
    return window.confirm("You have unsaved changes in this template. Discard them and continue?");
  }


  useEffect(() => {
    let active = true;
    async function loadAiAgents() {
      try {
        const response = await fetch("/api/ai-agents", { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (!active) return;
        setAiAgents(Array.isArray(payload?.agents) ? payload.agents : []);
      } catch {}
    }
    loadAiAgents().finally(() => refreshAllNodeHtml());
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialTemplateId) return;
    if (workspaceMode) return;
    if (!drawflowReady || !editorReady || !editorRef.current) return;
    const target = templatesState.find((t) => t.id === initialTemplateId);
    if (target) {
      loadTemplate(target);
    }
  }, [initialTemplateId, templatesState, drawflowReady, editorReady, workspaceMode]);

  useEffect(() => {
    if (!workspaceMode || !draft) return;
    if (!drawflowReady || !editorReady || !editorRef.current) return;
    if (emittedDraftSignatureRef.current && emittedDraftSignatureRef.current === externalDraftSignature) {
      externalDraftSignatureRef.current = externalDraftSignature;
      appliedExternalDraftSignatureRef.current = externalDraftSignature;
      return;
    }
    if (externalDraftSignatureRef.current === externalDraftSignature) return;
    externalDraftSignatureRef.current = externalDraftSignature;
    appliedExternalDraftSignatureRef.current = externalDraftSignature;
    emittedDraftSignatureRef.current = externalDraftSignature;
    void postClientLog({
      scope: "template_modular_builder",
      message: "template_modular_external_draft_applied",
      meta: {
        templateId: draft.id ?? null,
        blockCount: draft.blocks.length,
        workspaceMode
      }
    });
    applyDraftToBuilder(draft);
  }, [workspaceMode, draft, drawflowReady, editorReady, externalDraftSignature]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Drawflow) {
      setDrawflowReady(true);
    }
  }, []);

  useEffect(() => {
    function update() {
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      setIsMobile(mobile);
      if (mobile) {
        setTemplatesCollapsed(true);
        setDetailsCollapsed(true);
      } else {
        setDetailsCollapsed(false);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    async function loadPosters() {
      try {
        const response = await fetch("/api/posters");
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        setPosters(payload?.posters ?? []);
      } catch {}
    }
    async function loadAudio() {
      try {
        const response = await fetch("/api/meditation/audio");
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        setAudioFiles(payload?.files ?? []);
      } catch {}
    }
    loadPosters().finally(() => refreshAllNodeHtml());
    loadAudio().finally(() => refreshAllNodeHtml());
  }, []);

  useEffect(() => {
    refreshAllNodeHtml();
  }, [provider]);

  useEffect(() => {
    if (!workspaceMode || !onDraftChange) return;
    if (!drawflowReady || !editorReady || !editorRef.current) return;
    if (appliedExternalDraftSignatureRef.current !== externalDraftSignature) return;
    const nextDraft = buildWorkspaceDraft();
    if (!nextDraft) return;
    const serialized = JSON.stringify(nextDraft);
    if (serialized === emittedDraftSignatureRef.current) return;
    emittedDraftSignatureRef.current = serialized;
    void postClientLog({
      scope: "template_modular_builder",
      message: "template_modular_draft_emitted",
      meta: {
        templateId: nextDraft.id ?? null,
        blockCount: nextDraft.blocks.length,
        workspaceMode
      }
    });
    onDraftChange(nextDraft);
  }, [
    workspaceMode,
    onDraftChange,
    drawflowReady,
    editorReady,
    editorVersion,
    currentTemplateId,
    templateName,
    templateDescription,
    templatePublic,
    syncMode,
    maxParticipantsPerRoom,
    allowOddGroup,
    language,
    provider,
    timezone,
    dataspaceId,
    requiresApproval,
    capacity
  ]);

  useEffect(() => {
    if (workspaceMode) return;
    if (!drawflowReady || !editorReady || !editorRef.current) return;
    const nextDraft = buildWorkspaceDraft();
    const serialized = serializeDraft(nextDraft);
    setCurrentDraftSignature((prev) => (prev === serialized ? prev : serialized));
  }, [
    workspaceMode,
    drawflowReady,
    editorReady,
    editorVersion,
    currentTemplateId,
    templateName,
    templateDescription,
    templatePublic,
    syncMode,
    maxParticipantsPerRoom,
    allowOddGroup,
    language,
    provider,
    timezone,
    dataspaceId,
    requiresApproval,
    capacity
  ]);

  useEffect(() => {
    if (workspaceMode || !isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [workspaceMode, isDirty]);

  function setupEditor() {
    if (!drawflowRef.current || !window.Drawflow) return;
    const editor = new window.Drawflow(drawflowRef.current);
    editor.reroute = true;
    editor.start();
    editor.on("nodeCreated", (id: number) => {
      const node = editor.getNodeFromId(id);
      updateNodeHtml(id, node?.name, node?.data, isLiveTranscriptionProvider(provider));
    });
    editor.on("connectionCreated", () => {
      setEditorVersion((prev) => prev + 1);
    });
    editor.on("connectionRemoved", () => {
      setEditorVersion((prev) => prev + 1);
    });
    editor.on("nodeMoved", () => {
      setEditorVersion((prev) => prev + 1);
    });
    editorRef.current = editor;
    setEditorReady(true);
  }

  useEffect(() => {
    if (!drawflowReady) return;
    setupEditor();
    return () => {
      editorRef.current = null;
      setEditorReady(false);
    };
  }, [drawflowReady]);

  function updateNodeHtml(id: number, type: BlockType, data: NodeData, liveAiSupported = isLiveTranscriptionProvider(provider)) {
    if (!editorRef.current) return;
    const html = buildNodeHtml(type, data, { posters, audioFiles, aiAgents, liveAiSupported });
    const nodeEl = document.getElementById(`node-${id}`);
    if (nodeEl) {
      const content = nodeEl.querySelector(".drawflow_content_node");
      if (content) {
        content.innerHTML = html;
      }
    }
  }

  function updateZoomLevel() {
    const current = editorRef.current?.zoom;
    if (typeof current === "number" && Number.isFinite(current)) {
      setZoomLevel(current);
    }
  }

  function applyEditorTransform(nextX: number, nextY: number, nextZoom: number) {
    const editor = editorRef.current;
    if (!editor?.precanvas) return;
    editor.canvas_x = nextX;
    editor.canvas_y = nextY;
    editor.zoom = nextZoom;
    editor.precanvas.style.transform = `translate(${nextX}px, ${nextY}px) scale(${nextZoom})`;
    setZoomLevel(nextZoom);
  }

  function focusNodeInViewport(nodeId: number) {
    const editor = editorRef.current;
    const container = drawflowRef.current;
    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (!editor || !container || !nodeEl) return;

    const currentZoom = typeof editor.zoom === "number" ? editor.zoom : zoomLevel;
    const nextZoom = Math.max(0.68, Math.min(0.92, currentZoom));
    const nodeWidth = nodeEl.offsetWidth || (isMobile ? 224 : 248);
    const nodeHeight = nodeEl.offsetHeight || 176;
    const nodeCenterX = nodeEl.offsetLeft + nodeWidth / 2;
    const nodeCenterY = nodeEl.offsetTop + nodeHeight / 2;
    const nextX = container.clientWidth / 2 - nodeCenterX * nextZoom;
    const nextY = container.clientHeight / 2 - nodeCenterY * nextZoom;

    if (editor.precanvas?.style) {
      editor.precanvas.style.transition = "transform 180ms ease";
      window.setTimeout(() => {
        if (editorRef.current?.precanvas) {
          editorRef.current.precanvas.style.transition = "";
        }
      }, 220);
    }

    applyEditorTransform(nextX, nextY, nextZoom);
  }

  function zoomIn() {
    const editor = editorRef.current;
    if (!editor) return;
    if (typeof editor.zoom_in === "function") {
      editor.zoom_in();
      updateZoomLevel();
      return;
    }
    const current = typeof editor.zoom === "number" ? editor.zoom : zoomLevel;
    const next = Math.min(2, current + 0.1);
    editor.zoom = next;
    if (typeof editor.zoom_refresh === "function") editor.zoom_refresh();
    setZoomLevel(next);
  }

  function zoomOut() {
    const editor = editorRef.current;
    if (!editor) return;
    if (typeof editor.zoom_out === "function") {
      editor.zoom_out();
      updateZoomLevel();
      return;
    }
    const current = typeof editor.zoom === "number" ? editor.zoom : zoomLevel;
    const next = Math.max(0.5, current - 0.1);
    editor.zoom = next;
    if (typeof editor.zoom_refresh === "function") editor.zoom_refresh();
    setZoomLevel(next);
  }

  function resetView() {
    applyEditorTransform(0, 0, 1);
  }

  function fitView() {
    const editor = editorRef.current;
    const container = drawflowRef.current;
    if (!editor || !container) return;
    const exported = editor.export();
    const data = exported?.drawflow?.Home?.data ?? {};
    const nodes = Object.values(data) as Array<{ pos_x?: number; pos_y?: number }>;
    if (nodes.length === 0) {
      resetView();
      return;
    }

    const cardWidth = isMobile ? 224 : 248;
    const cardHeight = 176;
    const padding = 96;
    const minX = Math.min(...nodes.map((node) => Number(node.pos_x ?? 0)));
    const minY = Math.min(...nodes.map((node) => Number(node.pos_y ?? 0)));
    const maxX = Math.max(...nodes.map((node) => Number(node.pos_x ?? 0) + cardWidth));
    const maxY = Math.max(...nodes.map((node) => Number(node.pos_y ?? 0) + cardHeight));
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const scaleX = (container.clientWidth - padding) / boundsWidth;
    const scaleY = (container.clientHeight - padding) / boundsHeight;
    const nextZoom = Math.max(0.5, Math.min(1.2, Math.min(scaleX, scaleY)));
    const nextX = (container.clientWidth - boundsWidth * nextZoom) / 2 - minX * nextZoom;
    const nextY = (container.clientHeight - boundsHeight * nextZoom) / 2 - minY * nextZoom;
    applyEditorTransform(nextX, nextY, nextZoom);
  }

  function scheduleFitView() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        fitView();
      });
    });
  }

  useEffect(() => {
    const container = drawflowRef.current;
    if (!container || !editorReady) return;
    const currentContainer = container;

    function handleWheel(event: WheelEvent) {
      if (!editorRef.current) return;
      event.preventDefault();

      const editor = editorRef.current;
      const currentZoom = typeof editor.zoom === "number" ? editor.zoom : zoomLevel;
      const currentX = typeof editor.canvas_x === "number" ? editor.canvas_x : 0;
      const currentY = typeof editor.canvas_y === "number" ? editor.canvas_y : 0;

      if (event.ctrlKey || event.metaKey) {
        const rect = currentContainer.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        const nextZoom = Math.max(0.5, Math.min(2, currentZoom + delta));
        if (nextZoom === currentZoom) return;
        const worldX = (pointerX - currentX) / currentZoom;
        const worldY = (pointerY - currentY) / currentZoom;
        const nextX = pointerX - worldX * nextZoom;
        const nextY = pointerY - worldY * nextZoom;
        applyEditorTransform(nextX, nextY, nextZoom);
        return;
      }

      applyEditorTransform(currentX - event.deltaX, currentY - event.deltaY, currentZoom);
    }

    currentContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      currentContainer.removeEventListener("wheel", handleWheel);
    };
  }, [editorReady, zoomLevel]);

  function refreshAllNodeHtml() {
    if (!editorRef.current) return;
    const exported = editorRef.current.export();
    const data = exported?.drawflow?.Home?.data ?? {};
    const liveAiSupported = isLiveTranscriptionProvider(provider);
    Object.values(data).forEach((node: any) => {
      updateNodeHtml(Number(node.id), node.name as BlockType, node.data as NodeData, liveAiSupported);
    });
  }

  function addNode(type: BlockType, clientX: number, clientY: number) {
    if (!editorRef.current || !drawflowRef.current) return;
    if (type === "START") {
      const exported = editorRef.current.export();
      const nodes = Object.values(exported?.drawflow?.Home?.data ?? {}) as any[];
      if (nodes.some((node) => node?.name === "START")) {
        return;
      }
    }
    const editor = editorRef.current;
    const rect = drawflowRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    const posY = clientY - rect.top;
    const data = buildDefaultData(type);
    const html = buildNodeHtml(type, data, { posters, audioFiles, aiAgents, liveAiSupported: isLiveTranscriptionProvider(provider) });
    const nodeId = editor.addNode(type, 1, 1, posX, posY, type, data, html);
    setTimeout(() => updateNodeHtml(nodeId, type, data), 0);
    setEditorVersion((prev) => prev + 1);
  }

  function addNodeAtCenter(type: BlockType) {
    if (!drawflowRef.current) return;
    const rect = drawflowRef.current.getBoundingClientRect();
    addNode(type, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function connectSequentialNodes(nodeIds: number[]) {
    const editor = editorRef.current;
    if (!editor || nodeIds.length < 2) return;
    for (let index = 0; index < nodeIds.length - 1; index += 1) {
      const fromId = nodeIds[index];
      const toId = nodeIds[index + 1];
      try {
        editor.addConnection(fromId, toId, "output_1", "input_1");
      } catch {
        // Drawflow throws if a connection already exists or nodes are not ready yet.
      }
    }
  }

  function refreshConnectionLayout(nodeIds: number[]) {
    const editor = editorRef.current;
    if (!editor || nodeIds.length === 0 || typeof window === "undefined") return;
    const refresh = () => {
      nodeIds.forEach((nodeId) => {
        try {
          if (typeof editor.updateConnectionNodes === "function") {
            editor.updateConnectionNodes(`node-${nodeId}`);
            return;
          }
          const nodeEl = document.getElementById(`node-${nodeId}`);
          if (nodeEl && typeof editor.updateConnectionNodes === "function") {
            editor.updateConnectionNodes(nodeEl.id);
          }
        } catch {
          // Drawflow can throw transiently while DOM is still settling.
        }
      });
    };
    window.requestAnimationFrame(() => {
      refresh();
      window.requestAnimationFrame(() => {
        refresh();
      });
    });
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("dr-module");
    if (!payload) return;
    addNode(payload as BlockType, event.clientX, event.clientY);
  }

  function handleDragStart(event: React.DragEvent, type: BlockType) {
    event.dataTransfer.setData("dr-module", type);
  }

  function resetEditor() {
    if (!editorRef.current) return;
    editorRef.current.clearModuleSelected();
    editorRef.current.import({ drawflow: { Home: { data: {} } } });
    setEditorVersion((prev) => prev + 1);
  }

  function buildChainFromExport(exported: any) {
    const data = exported?.drawflow?.Home?.data ?? {};
    const nodes = Object.values(data) as any[];
    if (nodes.length === 0) return { chain: [] as any[] };

    const inputMap = new Map<number, number[]>();
    const outputMap = new Map<number, number[]>();
    nodes.forEach((node) => {
      const nodeId = Number(node.id);
      const inputs = node.inputs ?? {};
      const outputs = node.outputs ?? {};
      Object.values(inputs).forEach((input: any) => {
        input.connections?.forEach((conn: any) => {
          const fromId = Number(conn.node);
          if (!inputMap.has(nodeId)) inputMap.set(nodeId, []);
          inputMap.get(nodeId)?.push(fromId);
        });
      });
      Object.values(outputs).forEach((output: any) => {
        output.connections?.forEach((conn: any) => {
          const toId = Number(conn.node);
          if (!outputMap.has(nodeId)) outputMap.set(nodeId, []);
          outputMap.get(nodeId)?.push(toId);
        });
      });
    });

    const starts = nodes.filter((node) => {
      const nodeId = Number(node.id);
      return !inputMap.get(nodeId) || inputMap.get(nodeId)?.length === 0;
    });
    if (starts.length !== 1) {
      return { error: "Template must be a single linear chain." };
    }
    const chain: any[] = [];
    const visited = new Set<number>();
    let current = starts[0];
    while (current) {
      const nodeId = Number(current.id);
      if (visited.has(nodeId)) {
        return { error: "Cycle detected in the chain." };
      }
      visited.add(nodeId);
      chain.push(current);
      const outputs = outputMap.get(nodeId) ?? [];
      if (outputs.length > 1) {
        return { error: "Each block must connect to only one next block." };
      }
      const nextId = outputs[0];
      current = nextId ? data[nextId] : null;
    }
    return { chain };
  }

  function buildBlocksFromEditor(options?: {
    strictChain?: boolean;
    requireCompleteFields?: boolean;
  }) {
    const strictChain = options?.strictChain ?? true;
    const requireCompleteFields = options?.requireCompleteFields ?? true;
    if (!editorRef.current) return { error: "Editor not ready" };
    const exported = editorRef.current.export();
    const chainResult = buildChainFromExport(exported);
    const exportedNodes = Object.values(exported?.drawflow?.Home?.data ?? {}) as any[];
    if (strictChain && chainResult.error) return { error: chainResult.error };
    const chain =
      !chainResult.error && (chainResult.chain?.length ?? 0) > 0
        ? chainResult.chain ?? []
        : [...exportedNodes].sort((a, b) => {
            const posY = Number(a?.pos_y ?? 0) - Number(b?.pos_y ?? 0);
            if (Math.abs(posY) > 24) return posY;
            return Number(a?.pos_x ?? 0) - Number(b?.pos_x ?? 0);
          });
    if (!strictChain && chainResult.error) {
      const fallbackSignature = JSON.stringify({
        currentTemplateId,
        editorVersion,
        error: chainResult.error,
        count: exportedNodes.length
      });
      if (fallbackLoggedSignatureRef.current !== fallbackSignature) {
        fallbackLoggedSignatureRef.current = fallbackSignature;
        void postClientLog({
          level: "warn",
          scope: "template_modular_builder",
          message: "template_modular_fallback_order_used",
          meta: {
            templateId: currentTemplateId,
            editorVersion,
            reason: chainResult.error,
            nodeCount: exportedNodes.length
          }
        });
      }
    }
    if (chain.length === 0) {
      return { error: "Template must contain at least one block." };
    }
    const blocks = chain.map((node: any) => {
      const type = node.name as BlockType;
      const data = node.data as NodeData;
      return buildBlockFromNode(type, data, isLiveTranscriptionProvider(provider));
    });

    if (requireCompleteFields) {
      for (const block of blocks) {
      if (
        block.type === "PROMPT" &&
        !block.posterId &&
        !(block.posterTitle?.trim() && block.posterContent?.trim())
      ) {
        return { error: "Prompt blocks need a selected prompt or direct prompt text." };
      }
      if (block.type === "FORM" && (!block.formQuestion || block.formChoices?.length === 0)) {
        return { error: "Form blocks need a question and at least one option." };
      }
      if (block.type === "EMBED" && !block.embedUrl) {
        return { error: "Embed blocks need a URL." };
      }
      if (block.type === "HARMONICA" && !block.harmonicaUrl) {
        return { error: "Harmonica blocks need a URL." };
      }
      }
    }

    const normalized = blocks.map((block) => {
      if (block.type === "EMBED" && block.embedUrl) {
        return { ...block, embedUrl: normalizeEmbedUrl(block.embedUrl) || block.embedUrl };
      }
      if (block.type === "HARMONICA" && block.harmonicaUrl) {
        return { ...block, harmonicaUrl: normalizeEmbedUrl(block.harmonicaUrl) || block.harmonicaUrl };
      }
      if (block.type === "FORM") {
        const question = block.formQuestion?.trim() ?? "";
        const choices = (block.formChoices ?? [])
          .map((choice) => ({ ...choice, label: choice.label?.trim() ?? "" }))
          .filter((choice) => choice.label.length > 0);
        return { ...block, formQuestion: question || null, formChoices: choices };
      }
      if (block.type === "PROMPT") {
        return {
          ...block,
          posterTitle: block.posterTitle?.trim() || null,
          posterContent: block.posterContent?.trim() || null
        };
      }
      return block;
    });

    return { blocks: normalized };
  }

  function buildWorkspaceDraft(): TemplateDraft | null {
    const build = buildBlocksFromEditor({
      strictChain: false,
      requireCompleteFields: false
    });
    if ("error" in build || !build.blocks) {
      return null;
    }
    return {
      id: currentTemplateId,
      name: templateName.trim() || "Untitled template",
      description: templateDescription.trim() || null,
      isPublic: templatePublic,
      settings: {
        syncMode,
        maxParticipantsPerRoom,
        allowOddGroup,
        language,
        transcriptionProvider: provider,
        timezone: timezone || resolvedTimezone,
        dataspaceId: dataspaceId || null,
        requiresApproval,
        capacity: capacity === "" ? null : Number(capacity)
      },
      blocks: build.blocks
    };
  }

  async function runAi(mode: "generate" | "modify") {
    setAiLoading(true);
    setAiError(null);
    setAiRaw("");
    setAiRequestId(null);
    setPendingAiDraft(null);
    try {
      const currentDraft = buildWorkspaceDraft();
      const response = await fetch("/api/templates/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: aiPrompt,
          mode,
          draft: mode === "modify" ? currentDraft ?? undefined : undefined
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
        throw new Error(payload?.error ?? `AI request failed (${response.status}).`);
      }
      if (!payload?.template) {
        throw new Error("AI did not return a template draft.");
      }
      setPendingAiDraft({
        ...buildDefaultTemplateDraft(),
        ...payload.template,
        id: mode === "modify" ? currentTemplateId ?? null : null,
        settings: {
          ...buildDefaultTemplateDraft().settings,
          ...(payload.template.settings ?? {})
        },
        blocks: ensureStartBlock(payload.template.blocks ?? [])
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Unable to process AI request.");
    } finally {
      setAiLoading(false);
    }
  }

  function applyPendingAiDraft() {
    if (!pendingAiDraft) return;
    applyDraftToBuilder(pendingAiDraft);
    setPendingAiDraft(null);
  }

  function applyDraftToBuilder(nextDraft: TemplateDraft) {
    const normalizedBlocks = ensureStartBlock(nextDraft.blocks ?? []);
    const normalizedDraft: TemplateDraft = {
      ...nextDraft,
      blocks: normalizedBlocks
    };
    setCurrentDraftSignature(serializeDraft(normalizedDraft));
    setCurrentTemplateId(normalizedDraft.id ?? null);
    setTemplateName(normalizedDraft.name || "New template");
    setTemplateDescription(normalizedDraft.description ?? "");
    setTemplatePublic(Boolean(normalizedDraft.isPublic));
    setSyncMode(normalizedDraft.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER");
    setMaxParticipantsPerRoom(
      Math.max(2, Math.min(12, Number(normalizedDraft.settings?.maxParticipantsPerRoom ?? 2) || 2))
    );
    setAllowOddGroup(Boolean(normalizedDraft.settings?.allowOddGroup));
    setLanguage(normalizedDraft.settings?.language === "IT" ? "IT" : "EN");
    setProvider(normalizedDraft.settings?.transcriptionProvider || "DEEPGRAMLIVE");
    setTimezone(normalizedDraft.settings?.timezone ?? "");
    setDataspaceId(normalizedDraft.settings?.dataspaceId ?? "");
    setRequiresApproval(Boolean(normalizedDraft.settings?.requiresApproval));
    setCapacity(
      typeof normalizedDraft.settings?.capacity === "number" && Number.isFinite(normalizedDraft.settings.capacity)
        ? normalizedDraft.settings.capacity
        : ""
    );
    if (!editorRef.current) return;
    resetEditor();
    const rect = drawflowRef.current?.getBoundingClientRect();
    const positions = getAutoLayoutPositions(normalizedBlocks.length, rect?.width ?? 960);
    const createdNodeIds: number[] = [];
    normalizedBlocks.forEach((block, index) => {
      const type = block.type as BlockType;
      const data = nodeDataFromBlock(block);
      const position = positions[index] ?? { x: 80, y: 60 + index * 168 };
      const html = buildNodeHtml(type, data, { posters, audioFiles, aiAgents, liveAiSupported: isLiveTranscriptionProvider(provider) });
      const id = editorRef.current.addNode(type, 1, 1, position.x, position.y, type, data, html);
      createdNodeIds.push(id);
      updateNodeHtml(id, type, data, isLiveTranscriptionProvider(provider));
    });
    connectSequentialNodes(createdNodeIds);
    refreshConnectionLayout(createdNodeIds);
    setEditorVersion((prev) => prev + 1);
    scheduleFitView();
  }

  async function refreshTemplates() {
    const response = await fetch("/api/plan-templates");
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    setTemplatesState(payload?.templates ?? []);
  }

  async function handleSave() {
    setSaveError(null);
    const draftToCompile = buildWorkspaceDraft();
    if (!draftToCompile) {
      const result = {
        ok: false,
        errors: [{ severity: "error" as const, message: "Template could not be compiled from the current canvas state." }],
        warnings: [],
        totalDurationMinutes: 0,
        discussionRounds: 0,
        segmentCount: 0
      };
      setCompileReport(result);
      setCompileModalOpen(true);
      setSaveError("Template must compile before it can be saved.");
      return;
    }
    const compileResult = compileTemplateDraft(draftToCompile);
    if (!compileResult.ok) {
      setCompileReport(compileResult);
      setCompileModalOpen(true);
      setSaveError("Template must compile before it can be saved.");
      void postClientLog({
        level: "warn",
        scope: "template_modular_builder",
        message: "template_compile_blocked_save",
        meta: {
          templateId: currentTemplateId,
          errorCount: compileResult.errors.length,
          warningCount: compileResult.warnings.length
        }
      });
      return;
    }
    const build = buildBlocksFromEditor();
    if ("error" in build) {
      setSaveError(build.error ?? "Unable to save template.");
      void postClientLog({
        level: "warn",
        scope: "template_modular_builder",
        message: "template_modular_strict_save_blocked",
        meta: {
          templateId: currentTemplateId,
          error: build.error ?? "Unable to save template."
        }
      });
      return;
    }
    const blocks = build.blocks;
    if (!blocks || blocks.length === 0) {
      setSaveError("Add at least one block before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: templateName.trim() || "Untitled template",
        description: templateDescription.trim() || null,
        isPublic: templatePublic,
        settings: {
          syncMode,
          maxParticipantsPerRoom,
          allowOddGroup,
          language,
          transcriptionProvider: provider,
          timezone: timezone || resolvedTimezone,
          dataspaceId: dataspaceId || null,
          requiresApproval,
          capacity: capacity === "" ? null : Number(capacity)
        },
        blocks
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
        const fieldErrors = result?.error?.fieldErrors ?? {};
        const fieldMessages = Object.values(fieldErrors).flat().filter(Boolean);
        setSaveError(
          fieldMessages[0] ??
            result?.error?.formErrors?.[0] ??
            result?.error ??
            "Unable to save template."
        );
        setSaving(false);
        return;
      }
      if (!currentTemplateId && result?.id) {
        setCurrentTemplateId(result.id);
      }
      const savedDraft: TemplateDraft = {
        id: currentTemplateId ?? result?.id ?? null,
        name: payload.name,
        description: payload.description,
        isPublic: payload.isPublic,
        settings: {
          syncMode,
          maxParticipantsPerRoom,
          allowOddGroup,
          language,
          transcriptionProvider: provider,
          timezone: timezone || resolvedTimezone,
          dataspaceId: dataspaceId || null,
          requiresApproval,
          capacity: capacity === "" ? null : Number(capacity)
        },
        blocks
      };
      const serialized = serializeDraft(savedDraft);
      setCurrentDraftSignature(serialized);
      setLastSavedDraftSignature(serialized);
      await refreshTemplates();
      setEditorVersion((prev) => prev + 1);
    } catch {
      setSaveError("Unable to save template.");
    } finally {
      setSaving(false);
    }
  }

  function loadTemplate(template: TemplateSummary) {
    if (!confirmDiscardUnsavedChanges()) return;
    const nextDraft: TemplateDraft = {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      isPublic: template.isPublic,
      settings: {
        syncMode: template.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER",
        maxParticipantsPerRoom: Math.max(2, Math.min(12, Number(template.settings?.maxParticipantsPerRoom ?? 2) || 2)),
        allowOddGroup: Boolean(template.settings?.allowOddGroup),
        language: template.settings?.language === "IT" ? "IT" : "EN",
        transcriptionProvider: template.settings?.transcriptionProvider || "DEEPGRAMLIVE",
        timezone: template.settings?.timezone ?? "",
        dataspaceId: template.settings?.dataspaceId ?? null,
        requiresApproval: Boolean(template.settings?.requiresApproval),
        capacity:
          typeof template.settings?.capacity === "number" && Number.isFinite(template.settings.capacity)
            ? template.settings.capacity
            : null
      },
      blocks: ensureStartBlock(template.blocks)
    };
    const serialized = serializeDraft(nextDraft);
    setCurrentDraftSignature(serialized);
    setLastSavedDraftSignature(serialized);
    setCurrentTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? "");
    setTemplatePublic(template.isPublic);
    setSyncMode(template.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER");
    setMaxParticipantsPerRoom(
      Math.max(2, Math.min(12, Number(template.settings?.maxParticipantsPerRoom ?? 2) || 2))
    );
    setAllowOddGroup(Boolean(template.settings?.allowOddGroup));
    setLanguage(template.settings?.language === "IT" ? "IT" : "EN");
    setProvider(template.settings?.transcriptionProvider || "DEEPGRAMLIVE");
    setTimezone(template.settings?.timezone ?? "");
    setDataspaceId(template.settings?.dataspaceId ?? "");
    setRequiresApproval(Boolean(template.settings?.requiresApproval));
    setCapacity(
      typeof template.settings?.capacity === "number" && Number.isFinite(template.settings.capacity)
        ? template.settings.capacity
        : ""
    );
    if (!editorRef.current) return;
    resetEditor();
    const nodes = nextDraft.blocks.map((block, index) => {
      const type = block.type as BlockType;
      const data = nodeDataFromBlock(block);
      return { type, data, index };
    });
    const rect = drawflowRef.current?.getBoundingClientRect();
    const positions = getAutoLayoutPositions(nodes.length, rect?.width ?? 960);
    const createdNodeIds: number[] = [];
    nodes.forEach((node, index) => {
      const position = positions[index] ?? { x: 80, y: 60 + index * 168 };
      const html = buildNodeHtml(node.type, node.data, { posters, audioFiles, aiAgents, liveAiSupported: isLiveTranscriptionProvider(provider) });
      const id = editorRef.current.addNode(node.type, 1, 1, position.x, position.y, node.type, node.data, html);
      createdNodeIds.push(id);
      updateNodeHtml(id, node.type, node.data, isLiveTranscriptionProvider(provider));
    });
    connectSequentialNodes(createdNodeIds);
    refreshConnectionLayout(createdNodeIds);
    setEditorVersion((prev) => prev + 1);
    scheduleFitView();
  }

  function createNewTemplate() {
    if (!confirmDiscardUnsavedChanges()) return;
    const nextDraft: TemplateDraft = {
      ...buildDefaultTemplateDraft(),
      settings: {
        ...buildDefaultTemplateDraft().settings,
        timezone: resolvedTimezone || "",
      }
    };
    const serialized = serializeDraft(nextDraft);
    setCurrentDraftSignature(serialized);
    setLastSavedDraftSignature(serialized);
    setCurrentTemplateId(null);
    setTemplateName("New template");
    setTemplateDescription("");
    setTemplatePublic(false);
    setSyncMode("SERVER");
    setMaxParticipantsPerRoom(2);
    setAllowOddGroup(false);
    setLanguage("EN");
    setProvider("DEEPGRAMLIVE");
    setTimezone(resolvedTimezone || "");
    setDataspaceId("");
    setRequiresApproval(false);
    setCapacity("");
    setPairingMinutes(10);
    setPairingCount(3);
    applyDraftToBuilder(nextDraft);
  }

  function updateNodeDataById(nodeId: number, partial: Partial<NodeData>) {
    if (!editorRef.current) return;
    const existing = editorRef.current.getNodeFromId(nodeId);
    const next = { ...(existing?.data || {}), ...partial };
    editorRef.current.updateNodeDataFromId(nodeId, next);
    const type = (existing?.name as BlockType | undefined) ?? "PROMPT";
    updateNodeHtml(nodeId, type, next);
    setEditorVersion((prev) => prev + 1);
  }

  function removeNodeById(nodeId: number) {
    const editor = editorRef.current;
    if (!editor) return;
    if (typeof editor.removeNodeId === "function") {
      try {
        editor.removeNodeId(`node-${nodeId}`);
        setEditorVersion((prev) => prev + 1);
        return;
      } catch {}
      try {
        editor.removeNodeId(String(nodeId));
        setEditorVersion((prev) => prev + 1);
        return;
      } catch {}
      try {
        editor.removeNodeId(nodeId);
        setEditorVersion((prev) => prev + 1);
        return;
      } catch {}
    }
    if (typeof editor.removeNode === "function") {
      try {
        editor.removeNode(nodeId);
        setEditorVersion((prev) => prev + 1);
      } catch {}
    }
  }

  function getNodeIdFromEventTarget(target: HTMLElement | null) {
    const nodeEl = target?.closest?.("[id^='node-']") as HTMLElement | null;
    if (!nodeEl) return null;
    const raw = nodeEl.id.replace("node-", "");
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }

  function getPausePreviewState(target: HTMLElement, fallback: NodeData) {
    const nodeEl = target.closest?.("[id^='node-']") as HTMLElement | null;
    const animationSelect = nodeEl?.querySelector?.(
      "select[data-field='meditationAnimationId']"
    ) as HTMLSelectElement | null;
    const audioSelect = nodeEl?.querySelector?.(
      "select[data-field='meditationAudioUrl']"
    ) as HTMLSelectElement | null;

    return {
      meditationAnimationId: animationSelect?.value || fallback.meditationAnimationId || null,
      meditationAudioUrl: audioSelect?.value || fallback.meditationAudioUrl || null
    };
  }

  function handleInlineClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const previewPauseActionEl = target.closest?.("[data-action='preview-pause-module']") as HTMLElement | null;
    if (previewPauseActionEl) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = getNodeIdFromEventTarget(previewPauseActionEl);
      if (!nodeId || !editorRef.current) return;
      const existing = editorRef.current.getNodeFromId(nodeId);
      const data = (existing?.data || {}) as NodeData;
      const previewState = getPausePreviewState(previewPauseActionEl, data);
      const animation =
        MEDITATION_ANIMATIONS.find((item) => item.id === previewState.meditationAnimationId) ??
        MEDITATION_ANIMATIONS[0];
      setPausePreviewTitle(`${existing?.name === "PAUSE" ? "Pause" : "Meditation"} preview`);
      setPausePreviewAnimationFile(animation?.file ?? "");
      setPausePreviewAudioUrl(previewState.meditationAudioUrl);
      setPausePreviewOpen(true);
      return;
    }
    const promptActionEl = target.closest?.("[data-action='open-prompt-modal']") as HTMLElement | null;
    if (promptActionEl) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = getNodeIdFromEventTarget(promptActionEl);
      if (!nodeId || !editorRef.current) return;
      const existing = editorRef.current.getNodeFromId(nodeId);
      const data = (existing?.data || {}) as NodeData;
      setPromptModalNodeId(nodeId);
      setPromptModalTitle(String(data.posterTitle || ""));
      setPromptModalContent(String(data.posterContent || data.note || ""));
      return;
    }
    const uploadActionEl = target.closest?.("[data-action='upload-pause-audio']") as HTMLElement | null;
    if (uploadActionEl) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = getNodeIdFromEventTarget(uploadActionEl);
      if (!nodeId) return;
      setPauseAudioUploadNodeId(nodeId);
      setPauseAudioUploadFile(null);
      setPauseAudioUploadError(null);
      return;
    }
    const actionEl = target.closest?.("[data-action='delete-node']") as HTMLElement | null;
    if (actionEl) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = getNodeIdFromEventTarget(actionEl);
      if (!nodeId) return;
      removeNodeById(nodeId);
      return;
    }

    const interactiveTarget = target.closest?.(
      "input, textarea, select, button, a, label, .input, .output"
    ) as HTMLElement | null;
    if (interactiveTarget) return;

    const nodeId = getNodeIdFromEventTarget(target);
    if (!nodeId) return;
    focusNodeInViewport(nodeId);
  }

  function handleInlineInput(event: React.FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const field = (target as HTMLInputElement).dataset?.field;
    if (!field) return;
    const nodeId = getNodeIdFromEventTarget(target);
    if (!nodeId) return;

    if (field === "durationMinutes" || field === "durationSecondsPart") {
      const nodeEl = (target as HTMLElement).closest?.("[id^='node-']") as HTMLElement | null;
      if (!nodeEl) return;
      const minutesInput = nodeEl.querySelector("[data-field='durationMinutes']") as HTMLInputElement | null;
      const secondsInput = nodeEl.querySelector("[data-field='durationSecondsPart']") as HTMLInputElement | null;
      const minutes = minutesInput ? Number(minutesInput.value) : 0;
      let seconds = secondsInput ? Number(secondsInput.value) : 0;
      if (seconds > 59) seconds = 59;
      const existing = editorRef.current?.getNodeFromId(nodeId);
      const fallbackType = (existing?.name as BlockType | undefined) ?? "PROMPT";
      const fallback = DEFAULT_DURATIONS[fallbackType] ?? DEFAULT_DURATIONS.PROMPT;
      const totalSeconds = Number.isFinite(minutes) || Number.isFinite(seconds)
        ? Math.max(1, (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0))
        : fallback;
      updateNodeDataById(nodeId, { durationSeconds: totalSeconds });
    } else if (field === "roundMaxParticipants") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { roundMaxParticipants: raw ? Number(raw) : null });
    } else if (field === "aiAgentIntervalSeconds") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { aiAgentIntervalSeconds: raw ? Number(raw) : 60 });
    } else if (field === "aiAgentCooldownSeconds") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { aiAgentCooldownSeconds: raw ? Number(raw) : 120 });
    } else if (field === "aiAgentMaxReplies") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { aiAgentMaxReplies: raw ? Number(raw) : 5 });
    } else if (field === "embedUrl") {
      updateNodeDataById(nodeId, { embedUrl: (target as HTMLInputElement).value });
    } else if (field === "harmonicaUrl") {
      updateNodeDataById(nodeId, { harmonicaUrl: (target as HTMLInputElement).value });
    } else if (field === "startDate") {
      updateNodeDataById(nodeId, { startDate: (target as HTMLInputElement).value || null });
    } else if (field === "startTime") {
      updateNodeDataById(nodeId, { startTime: (target as HTMLInputElement).value || null });
    } else if (field === "timezone") {
      updateNodeDataById(nodeId, { timezone: (target as HTMLInputElement).value || null });
    } else if (field === "requiredParticipants") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { requiredParticipants: raw ? Number(raw) : null });
    } else if (field === "participantCount") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { participantCount: raw ? Number(raw) : null });
    } else if (field === "formQuestion") {
      updateNodeDataById(nodeId, { formQuestion: (target as HTMLInputElement).value });
    } else if (field === "posterTitle") {
      updateNodeDataById(nodeId, { posterTitle: (target as HTMLInputElement).value });
    } else if (field === "note") {
      updateNodeDataById(nodeId, { note: (target as HTMLTextAreaElement).value });
    } else if (field === "posterContent") {
      updateNodeDataById(nodeId, { posterContent: (target as HTMLTextAreaElement).value });
    } else if (field === "aiAgentPromptOverride") {
      updateNodeDataById(nodeId, { aiAgentPromptOverride: (target as HTMLTextAreaElement).value });
    } else if (field === "participantUserIds") {
      const raw = (target as HTMLTextAreaElement).value;
      const values = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      updateNodeDataById(nodeId, { participantUserIds: values });
    } else if (field === "participantDataspaceIds") {
      const raw = (target as HTMLTextAreaElement).value;
      const values = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      updateNodeDataById(nodeId, { participantDataspaceIds: values });
    } else if (field === "participantQuery") {
      updateNodeDataById(nodeId, { participantQuery: (target as HTMLTextAreaElement).value });
    } else if (field === "participantNote") {
      updateNodeDataById(nodeId, { participantNote: (target as HTMLTextAreaElement).value });
    } else if (field === "formChoices") {
      const raw = (target as HTMLTextAreaElement).value;
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const formChoices = lines.map((label, index) => ({ key: `opt-${index + 1}`, label }));
      updateNodeDataById(nodeId, { formChoices });
    }
  }

  function handleInlineChange(event: React.ChangeEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const field = (target as HTMLInputElement).dataset?.field;
    if (!field) return;
    const nodeId = getNodeIdFromEventTarget(target);
    if (!nodeId) return;

    if (field === "posterId") {
      const value = (target as HTMLSelectElement).value;
      updateNodeDataById(nodeId, { posterId: value || null });
    } else if (field === "participantMode") {
      updateNodeDataById(nodeId, {
        participantMode: (target as HTMLSelectElement).value as NodeData["participantMode"]
      });
    } else if (field === "startMode") {
      updateNodeDataById(nodeId, {
        startMode: (target as HTMLSelectElement).value as NodeData["startMode"]
      });
    } else if (field === "aiAgentsEnabled") {
      const checked = (target as HTMLInputElement).checked;
      updateNodeDataById(nodeId, {
        aiAgentsEnabled: checked,
        aiAgentIds: checked ? [] : [],
        aiAgentIntervalSeconds: checked ? 60 : null,
        aiAgentCooldownSeconds: checked ? 120 : null,
        aiAgentMaxReplies: checked ? 5 : null,
        aiAgentPromptOverride: checked ? "" : null
      });
    } else if (field === "aiAgentIds") {
      const checkbox = target as HTMLInputElement;
      const existing = editorRef.current?.getNodeFromId(nodeId);
      const current = new Set<string>(((existing?.data || {}) as NodeData).aiAgentIds ?? []);
      if (checkbox.checked) {
        current.add(checkbox.value);
      } else {
        current.delete(checkbox.value);
      }
      updateNodeDataById(nodeId, { aiAgentIds: Array.from(current) });
    } else if (field === "matchingMode") {
      const rawValue = (target as HTMLSelectElement).value;
      const value = rawValue === "anti" ? "anti" : rawValue === "random" ? "random" : "polar";
      updateNodeDataById(nodeId, { matchingMode: value });
    } else if (field === "meditationAnimationId") {
      updateNodeDataById(nodeId, { meditationAnimationId: (target as HTMLSelectElement).value || null });
    } else if (field === "meditationAudioUrl") {
      updateNodeDataById(nodeId, { meditationAudioUrl: (target as HTMLSelectElement).value || null });
    }
  }

  function handleInlineBlur(event: React.FocusEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const field = (target as HTMLInputElement).dataset?.field;
    if (field !== "embedUrl" && field !== "harmonicaUrl") return;
    const nodeId = getNodeIdFromEventTarget(target);
    if (!nodeId) return;
    const normalized = normalizeEmbedUrl((target as HTMLInputElement).value);
    if (normalized !== (target as HTMLInputElement).value) {
      (target as HTMLInputElement).value = normalized;
    }
    updateNodeDataById(nodeId, field === "harmonicaUrl" ? { harmonicaUrl: normalized } : { embedUrl: normalized });
  }

  async function handlePauseAudioUpload() {
    if (!pauseAudioUploadNodeId || !pauseAudioUploadFile || pauseAudioUploading) return;
    setPauseAudioUploading(true);
    setPauseAudioUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", pauseAudioUploadFile);
      const response = await fetch("/api/meditation/audio", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to upload audio.");
      }
      const nextFile: AudioFileItem = {
        name: String(payload?.name || pauseAudioUploadFile.name),
        url: String(payload?.url || "")
      };
      if (!nextFile.url) {
        throw new Error("Uploaded audio URL missing.");
      }
      setAudioFiles((current) => {
        const withoutDuplicate = current.filter((item) => item.url !== nextFile.url);
        return [...withoutDuplicate, nextFile].sort((a, b) => a.name.localeCompare(b.name));
      });
      updateNodeDataById(pauseAudioUploadNodeId, { meditationAudioUrl: nextFile.url });
      setPauseAudioUploadNodeId(null);
      setPauseAudioUploadFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload audio.";
      setPauseAudioUploadError(message);
      void postClientLog({
        level: "error",
        scope: "modular_builder",
        message: "pause_audio_upload_failed",
        meta: {
          fileName: pauseAudioUploadFile?.name || null,
          error: message
        }
      });
    } finally {
      setPauseAudioUploading(false);
    }
  }

  function applyPromptModal() {
    if (!promptModalNodeId) return;
    updateNodeDataById(promptModalNodeId, {
      posterId: null,
      posterTitle: promptModalTitle.trim() || null,
      posterContent: promptModalContent.trim() || null
    });
    setPromptModalNodeId(null);
    setPromptModalTitle("");
    setPromptModalContent("");
  }

  return (
    <div className={`flex min-h-[560px] flex-col overflow-hidden ${workspaceMode ? "h-full gap-0" : "h-[calc(100dvh-96px)] gap-3"}`}>
      <Script
        src="https://cdn.jsdelivr.net/gh/jerosoler/Drawflow@0.0.48/dist/drawflow.min.js"
        onLoad={() => setDrawflowReady(true)}
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/jerosoler/Drawflow@0.0.48/dist/drawflow.min.css"
      />

      {!workspaceMode ? (
        <div className="dr-card flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 sm:block">
              Modular Builder
            </p>
            <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              {templateName || "New template"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              isDirty
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              {isDirty ? "Unsaved changes" : "Saved"}
            </div>
            <button
              type="button"
              className="dr-button px-2 py-1 text-[11px] sm:px-3 sm:text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save template"}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row ${workspaceMode ? "gap-0" : "gap-3"}`}>
        <div
          className={`dr-card shrink-0 flex flex-col gap-3 overflow-hidden border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.96))] p-3 shadow-[0_28px_72px_rgba(15,23,42,0.11)] ${
            isMobile
              ? "w-full"
              : modulesCollapsed
                ? "w-[56px]"
                : "w-[296px]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={modulesCollapsed ? "sr-only" : ""}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Modules
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Build the flow
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModulesCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              {modulesCollapsed ? ">" : "<"}
            </button>
          </div>
          {modulesCollapsed ? (
            <div className={`min-h-0 flex-1 ${isMobile ? "overflow-visible" : "overflow-auto pr-1"}`}>
              <div className={`flex ${isMobile ? "flex-row flex-wrap" : "flex-col"} items-center gap-2`}>
              {BASIC_MODULES.map((module) => {
                const startAlreadyIncluded = module.type === "START" && startModulePresent;
                return (
                  <button
                    key={module.type}
                    type="button"
                    draggable={!isMobile && !startAlreadyIncluded}
                    onDragStart={(event) => handleDragStart(event, module.type)}
                    onClick={() => (isMobile && !startAlreadyIncluded ? addNodeAtCenter(module.type) : undefined)}
                    onMouseEnter={(event) => showModuleTooltip(event, module)}
                    onMouseLeave={hideModuleTooltip}
                    onFocus={(event) => showModuleTooltip(event, module)}
                    onBlur={hideModuleTooltip}
                    title={startAlreadyIncluded ? "Start module is already included" : module.label}
                    disabled={startAlreadyIncluded}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[10px] font-semibold shadow-sm transition ${startAlreadyIncluded ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)]"} ${module.color}`}
                  >
                    {renderModuleIcon(module.icon)}
                  </button>
                );
              })}
              {PARTNER_MODULES.map((module) => (
                <button
                  key={module.type}
                  type="button"
                  draggable={!isMobile}
                  onDragStart={(event) => handleDragStart(event, module.type)}
                  onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                  onMouseEnter={(event) => showModuleTooltip(event, module)}
                  onMouseLeave={hideModuleTooltip}
                  onFocus={(event) => showModuleTooltip(event, module)}
                  onBlur={hideModuleTooltip}
                  title={module.label}
                  className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-[10px] font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)] ${module.color}`}
                >
                  {renderModuleIcon(module.icon)}
                </button>
              ))}
            </div>
            </div>
          ) : (
            <>
              <div className={`${isMobile ? "space-y-3" : "space-y-3 overflow-auto pr-1"}`}>
                <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Basic modules
                  </div>
                  <div className={`${isMobile ? "flex flex-wrap gap-2" : "space-y-2"}`}>
                    {BASIC_MODULES.map((module) => {
                      const startAlreadyIncluded = module.type === "START" && startModulePresent;
                      return (
                        <button
                          key={module.type}
                          type="button"
                          draggable={!isMobile && !startAlreadyIncluded}
                          onDragStart={(event) => handleDragStart(event, module.type)}
                          onClick={() => (isMobile && !startAlreadyIncluded ? addNodeAtCenter(module.type) : undefined)}
                          onMouseEnter={(event) => showModuleTooltip(event, module)}
                          onMouseLeave={hideModuleTooltip}
                          onFocus={(event) => showModuleTooltip(event, module)}
                          onBlur={hideModuleTooltip}
                          disabled={startAlreadyIncluded}
                          className={`group relative flex w-full items-center gap-3 rounded-[22px] border border-slate-200 bg-white/96 px-3 py-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300/80 ${startAlreadyIncluded ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"}`}
                        >
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ring-1 ring-inset ring-white/70 ${module.color}`}>
                            {renderModuleIcon(module.icon)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">{module.label}</span>
                            {isMobile ? (
                              <span className="mt-1 block text-[11px] font-medium text-slate-500">
                                {module.description}
                              </span>
                            ) : null}
                          </span>
                          {isMobile ? (
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition group-hover:border-slate-300 group-hover:bg-slate-100">
                              {startAlreadyIncluded ? "Included" : "Add"}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Participation platforms
                  </div>
                  <div className={`${isMobile ? "flex flex-wrap gap-2" : "space-y-2"}`}>
                    {PARTNER_MODULES.map((module) => (
                      <button
                        key={module.type}
                        type="button"
                        draggable={!isMobile}
                        onDragStart={(event) => handleDragStart(event, module.type)}
                        onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                        onMouseEnter={(event) => showModuleTooltip(event, module)}
                        onMouseLeave={hideModuleTooltip}
                        onFocus={(event) => showModuleTooltip(event, module)}
                        onBlur={hideModuleTooltip}
                        className="group relative flex w-full cursor-pointer items-center gap-3 rounded-[22px] border border-slate-200 bg-white/96 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-slate-300/80"
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ring-1 ring-inset ring-white/70 ${module.color}`}>
                          {renderModuleIcon(module.icon)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{module.label}</span>
                          {isMobile ? (
                            <span className="mt-1 block text-[11px] font-medium text-slate-500">
                              {module.description}
                            </span>
                          ) : null}
                        </span>
                        {isMobile ? (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition group-hover:border-slate-300 group-hover:bg-slate-100">
                            Add
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                {session?.user?.role === "ADMIN" ? (
                  <Link
                    href="/templates/workspace/modules"
                    className="block rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/80 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Edit module descriptions
                  </Link>
                ) : null}
              </div>
              <p className="mt-auto px-1 text-[11px] text-slate-500">
                {isMobile ? "Tap to add." : "Drag into the canvas."}
              </p>
            </>
          )}
        </div>

        <div className="dr-card relative min-h-0 min-w-0 flex-1 p-0">
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
              <span>Zoom</span>
              <span className="text-slate-800">{Math.round(zoomLevel * 100)}%</span>
            </div>
            <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm">
              <button
                type="button"
                onClick={zoomIn}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                +
              </button>
              <button
                type="button"
                onClick={zoomOut}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                −
              </button>
              <button
                type="button"
                onClick={fitView}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={resetView}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="flex h-full min-h-0 flex-col">
            <div
              ref={drawflowRef}
              className={`modular-canvas min-h-0 flex-1 w-full rounded-t-2xl ${isMobile ? "min-h-[360px]" : "min-h-[520px]"}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={handleInlineClick}
              onInput={handleInlineInput}
              onChange={handleInlineChange}
              onBlur={handleInlineBlur}
            />
            <div className="border-t border-slate-200 bg-white/75 px-4 py-2 text-[11px] font-medium text-slate-500">
              Scroll to pan · Ctrl/Cmd + scroll to zoom
            </div>
          </div>
          {!drawflowReady ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              Loading builder…
            </div>
          ) : null}
        </div>

        {!workspaceMode ? (
        <div
          className={`dr-card flex flex-col p-3 ${
            isMobile
              ? "w-full"
              : templatesCollapsed
                ? "w-[56px]"
                : "w-[260px]"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold text-slate-900 ${templatesCollapsed ? "sr-only" : ""}`}>Templates</h3>
            <button
              type="button"
              onClick={() => setTemplatesCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {templatesCollapsed ? ">" : "<"}
            </button>
          </div>
          {!templatesCollapsed ? (
            <>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Info
                  </div>
                  <button
                    type="button"
                    onClick={createNewTemplate}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-700"
                  >
                    New template
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="text-[11px] font-medium text-slate-700">
                    Name
                    <input
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      className="dr-input mt-1 w-full rounded px-2 py-1 text-[11px]"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-slate-700">
                    Description
                    <input
                      value={templateDescription}
                      onChange={(event) => setTemplateDescription(event.target.value)}
                      className="dr-input mt-1 w-full rounded px-2 py-1 text-[11px]"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[11px] font-medium text-slate-700">
                      Minutes per discussion
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={pairingMinutes}
                        onChange={(event) => setPairingMinutes(Number(event.target.value))}
                        className="dr-input mt-1 w-full rounded px-2 py-1 text-[11px]"
                      />
                    </label>
                    <label className="text-[11px] font-medium text-slate-700">
                      Pairings
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={pairingCount}
                        onChange={(event) => setPairingCount(Number(event.target.value))}
                        className="dr-input mt-1 w-full rounded px-2 py-1 text-[11px]"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={templatePublic}
                      onChange={(event) => setTemplatePublic(event.target.checked)}
                    />
                    Public
                  </label>
                  {saveError ? <p className="text-[11px] text-rose-600">{saveError}</p> : null}
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  All templates
                </div>
              </div>
              <div className={`flex-1 space-y-2 overflow-auto ${isMobile ? "max-h-[22dvh]" : ""}`}>
                {templatesState.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => loadTemplate(template)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                      template.id === currentTemplateId
                        ? "border-slate-400 bg-slate-100"
                        : "border-slate-200 bg-white/80"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                    <p className="text-[11px] text-slate-500">{template.description || "No description"}</p>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-500">{templatesState.length} templates</div>
            </>
          ) : (
            <div className="mt-2 text-center text-[10px] text-slate-500">
              <div className="font-semibold uppercase tracking-[0.2em]">More</div>
            </div>
          )}
        </div>
        ) : null}

        {!workspaceMode ? (
          <div className={`dr-card flex flex-col p-3 ${isMobile ? "w-full" : "w-[300px]"}`}>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                AI helper
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">Generate or modify this template</h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Use AI without leaving the modular canvas. Generate a new draft or update the current one.
              </p>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              className="dr-input mt-3 min-h-[150px] w-full rounded-xl px-3 py-2 text-xs"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="dr-button px-3 py-1 text-xs"
                onClick={() => runAi("generate")}
                disabled={aiLoading}
              >
                {aiLoading ? "Working..." : "Generate"}
              </button>
              <button
                type="button"
                className="dr-button-outline px-3 py-1 text-xs"
                onClick={() => runAi("modify")}
                disabled={aiLoading}
              >
                Modify
              </button>
            </div>

            {aiError ? <p className="mt-3 text-xs text-rose-600">{aiError}</p> : null}
            {aiRequestId ? <p className="mt-2 text-[11px] text-slate-400">Request ID: {aiRequestId}</p> : null}

            {pendingAiDraft ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
                <p className="text-xs font-semibold text-emerald-900">AI draft ready</p>
                <p className="mt-1 text-[11px] text-emerald-800">
                  {pendingAiDraft.name || "Untitled template"} · {pendingAiDraft.blocks.length} blocks
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="dr-button px-3 py-1 text-xs" onClick={applyPendingAiDraft}>
                    Apply
                  </button>
                  <button
                    type="button"
                    className="dr-button-outline px-3 py-1 text-xs"
                    onClick={() => setPendingAiDraft(null)}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white/70 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Raw output
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-700">
                {aiRaw || "No AI output yet."}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
      {hoveredModuleTooltip ? (
        <div
          className="pointer-events-none fixed z-[120] w-60 -translate-y-1/2 rounded-[22px] border border-slate-700/80 bg-slate-950/95 px-3.5 py-3 text-left text-[11px] font-medium leading-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.45)] backdrop-blur"
          style={{
            top: hoveredModuleTooltip.top,
            left: hoveredModuleTooltip.left
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Module
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {hoveredModuleTooltip.label}
          </p>
          <p className="mt-2 text-slate-200">{hoveredModuleTooltip.description}</p>
        </div>
      ) : null}
      {pauseAudioUploadNodeId ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Pause audio
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Upload meditation audio</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Add a new audio file and assign it to this Pause module immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pauseAudioUploading) return;
                  setPauseAudioUploadNodeId(null);
                  setPauseAudioUploadFile(null);
                  setPauseAudioUploadError(null);
                }}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.webm,audio/*"
                onChange={(event) => setPauseAudioUploadFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
              />
              {pauseAudioUploadFile ? (
                <p className="text-xs text-slate-500">
                  Selected: <span className="font-semibold text-slate-700">{pauseAudioUploadFile.name}</span>
                </p>
              ) : null}
              {pauseAudioUploadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {pauseAudioUploadError}
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pauseAudioUploading) return;
                  setPauseAudioUploadNodeId(null);
                  setPauseAudioUploadFile(null);
                  setPauseAudioUploadError(null);
                }}
                className="dr-button-outline px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePauseAudioUpload}
                disabled={!pauseAudioUploadFile || pauseAudioUploading}
                className="dr-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pauseAudioUploading ? "Uploading..." : "Upload and use"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pausePreviewOpen ? (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/80">
          <div className="relative h-full w-full overflow-hidden bg-black">
            {pausePreviewAnimationFile ? (
              <iframe
                title={pausePreviewTitle}
                src={pausePreviewAnimationFile}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
                No animation selected.
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.34)_100%)]" />
            <div className="absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              {pausePreviewTitle}
            </div>
            <button
              type="button"
              onClick={() => setPausePreviewOpen(false)}
              className="absolute right-6 top-6 rounded-full border border-white/30 bg-black/60 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-black/70"
            >
              Close preview
            </button>
            {pausePreviewAudioUrl ? (
              <audio src={pausePreviewAudioUrl} autoPlay loop className="hidden" />
            ) : null}
          </div>
        </div>
      ) : null}
      {compileModalOpen && compileReport ? (
        <div className="fixed inset-0 z-[139] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Template compile
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {compileReport.ok ? "Template can run" : "Template has blocking issues"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {compileReport.discussionRounds} discussion rounds · {compileReport.segmentCount} runtime segments · {compileReport.totalDurationMinutes} min total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompileModalOpen(false)}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                  Errors
                </p>
                {compileReport.errors.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-700">No blocking errors.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-rose-800">
                    {compileReport.errors.map((issue, index) => (
                      <li key={`compile-error-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Warnings
                </p>
                {compileReport.warnings.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No warnings.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-amber-900">
                    {compileReport.warnings.map((issue, index) => (
                      <li key={`compile-warning-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompileModalOpen(false)}
                className="dr-button-outline px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {promptModalNodeId ? (
        <div className="fixed inset-0 z-[141] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Prompt module
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Create or edit text prompt</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Write the prompt directly for this module without leaving the builder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromptModalNodeId(null);
                  setPromptModalTitle("");
                  setPromptModalContent("");
                }}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-slate-700">
                Prompt title
                <input
                  type="text"
                  value={promptModalTitle}
                  onChange={(event) => setPromptModalTitle(event.target.value)}
                  placeholder="Context setting"
                  className="dr-input mt-1 w-full"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Prompt text
                <textarea
                  value={promptModalContent}
                  onChange={(event) => setPromptModalContent(event.target.value)}
                  rows={8}
                  placeholder="Write the prompt shown to participants"
                  className="dr-input mt-1 w-full"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPromptModalNodeId(null);
                  setPromptModalTitle("");
                  setPromptModalContent("");
                }}
                className="dr-button-outline px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPromptModal}
                disabled={!promptModalTitle.trim() && !promptModalContent.trim()}
                className="dr-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply prompt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
