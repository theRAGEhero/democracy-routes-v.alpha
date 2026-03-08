"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { MEDITATION_ANIMATIONS } from "@/lib/meditation";
import { buildDefaultTemplateDraft, type TemplateBlock, type TemplateBlockType, type TemplateDraft } from "@/lib/templateDraft";

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

type Props = {
  templates?: TemplateSummary[];
  dataspaces: Array<{ id: string; name: string }>;
  initialTemplateId?: string | null;
  draft?: TemplateDraft | null;
  onDraftChange?: (draft: TemplateDraft) => void;
  workspaceMode?: boolean;
};

type BlockType = TemplateBlockType;

type NodeData = {
  durationSeconds?: number;
  startMode?:
    | "specific_datetime"
    | "when_x_join"
    | "organizer_manual"
    | "when_x_join_and_datetime"
    | "random_selection_among_x";
  startDate?: string | null;
  startTime?: string | null;
  timezone?: string | null;
  requiredParticipants?: number | null;
  agreementRequired?: boolean | null;
  agreementDeadline?: string | null;
  minimumParticipants?: number | null;
  allowStartBeforeFull?: boolean | null;
  poolSize?: number | null;
  selectedParticipants?: number | null;
  selectionRule?: "random" | null;
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
  posterId?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti";
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }>;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

const MODULES: Array<{ type: BlockType; label: string; description: string; color: string; icon: string }> = [
  {
    type: "START",
    label: "Start",
    description: "Define how and when a template session is allowed to begin.",
    color: "bg-zinc-100 text-zinc-900",
    icon: "M5 4h14v4H5zM7 2h2v4H7zm8 0h2v4h-2zM5 10h14v10H5zm3 3h3v3H8z"
  },
  {
    type: "PARTICIPANTS",
    label: "Participants",
    description: "Describe who should be invited, selected, or searched for this template.",
    color: "bg-stone-100 text-stone-900",
    icon: "M4 18h16v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2Zm8-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
  },
  {
    type: "PAIRING",
    label: "Pairing",
    description: "Split people into small-group calls or rounds for timed discussion.",
    color: "bg-amber-100 text-amber-900",
    icon: "M4 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-10 2a4 4 0 0 0-4 4v2h6v-2a4 4 0 0 0-2-4Zm8 0a4 4 0 0 0-2 4v2h6v-2a4 4 0 0 0-4-4Z"
  },
  {
    type: "PAUSE",
    label: "Pause",
    description: "Insert a breathing space, meditation, or silent interval between activities.",
    color: "bg-sky-100 text-sky-900",
    icon: "M6 4h3v16H6zM11 4h3v16h-3z"
  },
  {
    type: "PROMPT",
    label: "Prompt",
    description: "Show a guiding question, instruction, or framing message to participants.",
    color: "bg-emerald-100 text-emerald-900",
    icon: "M4 5h16v10H7l-3 3V5z"
  },
  {
    type: "NOTES",
    label: "Notes",
    description: "Provide written context, notes, or facilitator guidance inside the template.",
    color: "bg-slate-100 text-slate-900",
    icon: "M6 4h8l4 4v12H6zM14 4v4h4"
  },
  {
    type: "FORM",
    label: "Form",
    description: "Collect structured participant answers, votes, or short submissions.",
    color: "bg-violet-100 text-violet-900",
    icon: "M6 5h12v2H6zM6 10h12v2H6zM6 15h7v2H6z"
  },
  {
    type: "EMBED",
    label: "Embed",
    description: "Display external content such as a board, document, or video inside the flow.",
    color: "bg-orange-100 text-orange-900",
    icon: "M7 7l-4 3 4 3M17 7l4 3-4 3M10 17l4-10"
  },
  {
    type: "MATCHING",
    label: "Matching",
    description: "Trigger AI or rule-based rematching between rounds or group transitions.",
    color: "bg-rose-100 text-rose-900",
    icon: "M5 12h6M13 12h6M8 9l3 3-3 3"
  },
  {
    type: "BREAK",
    label: "Break",
    description: "Insert a simple break block with no extra logic beyond time and pacing.",
    color: "bg-cyan-100 text-cyan-900",
    icon: "M7 5h4v14H7zM13 5h4v14h-4z"
  },
  {
    type: "RECORD",
    label: "Record",
    description: "Capture spoken contributions or recording-focused moments in the template.",
    color: "bg-indigo-100 text-indigo-900",
    icon: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
  },
  {
    type: "HARMONICA",
    label: "Harmonica",
    description: "Placeholder for future Harmonica integration and deliberation workflows.",
    color: "bg-teal-100 text-teal-900",
    icon: "M4 9h16v6H4zM7 9v6M11 9v6M15 9v6M18 9v6"
  },
  {
    type: "DEMBRANE",
    label: "Dembrane",
    description: "Placeholder partner module for Dembrane-linked participation flows.",
    color: "bg-cyan-100 text-cyan-900",
    icon: "M5 6h14v12H5zM8 9h8M8 12h8M8 15h5"
  },
  {
    type: "DELIBERAIDE",
    label: "DeliberAIde",
    description: "Placeholder partner module for future DeliberAIde assistance.",
    color: "bg-lime-100 text-lime-900",
    icon: "M12 4l7 4v8l-7 4-7-4V8l7-4Zm0 4v4m0 4h.01"
  },
  {
    type: "POLIS",
    label: "Pol.is",
    description: "Placeholder partner module for Pol.is style opinion clustering.",
    color: "bg-fuchsia-100 text-fuchsia-900",
    icon: "M4 6h16v10H7l-3 3V6zM8 10h2M12 10h2M16 10h.01"
  },
  {
    type: "AGORACITIZENS",
    label: "Agora Citizens",
    description: "Placeholder partner module for civic assembly and Agora Citizens flows.",
    color: "bg-emerald-100 text-emerald-900",
    icon: "M4 18h16M6 16V9l6-4 6 4v7M9 18v-4h6v4"
  },
  {
    type: "NEXUSPOLITICS",
    label: "Nexus Politics",
    description: "Placeholder partner module for graph-based political collaboration tools.",
    color: "bg-blue-100 text-blue-900",
    icon: "M6 6h5v5H6zM13 13h5v5h-5zM13 6h5v5h-5zM6 13h5v5H6zM11 8h2M8 11v2M13 11h2M11 13v2"
  },
  {
    type: "SUFFRAGO",
    label: "Suffrago",
    description: "Placeholder partner module for voting, ballots, and suffrage-related tools.",
    color: "bg-rose-100 text-rose-900",
    icon: "M6 4h12v4H6zM8 8v10m8-10v10M5 20h14"
  }
];

const DEFAULT_DURATIONS: Record<BlockType, number> = {
  START: 60,
  PARTICIPANTS: 90,
  PAIRING: 600,
  PAUSE: 300,
  PROMPT: 120,
  NOTES: 120,
  FORM: 120,
  EMBED: 180,
  MATCHING: 60,
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
  }
) {
  const module = MODULES.find((item) => item.type === type);
  const label = module?.label ?? type;
  const icon = module?.icon ?? "M5 5h14v14H5z";
  const durationValue = data.durationSeconds ?? DEFAULT_DURATIONS[type];
  const duration = Number.isFinite(durationValue) ? Math.max(1, Math.round(durationValue)) : DEFAULT_DURATIONS[type];

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

  const matchingMode = data.matchingMode === "anti" ? "anti" : "polar";
  const choicesText = (data.formChoices ?? []).map((choice) => choice.label).join("\n");
  const participantMode = data.participantMode ?? "manual_selected";
  const participantUsersText = (data.participantUserIds ?? []).join("\n");
  const participantDataspacesText = (data.participantDataspaceIds ?? []).join("\n");
  const startMode = data.startMode ?? "specific_datetime";
  const agreementRequired = data.agreementRequired ? "checked" : "";
  const allowStartBeforeFull = data.allowStartBeforeFull ? "checked" : "";

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
        <button
          type="button"
          class="dr-node-delete"
          data-action="delete-node"
          aria-label="Remove ${escapeHtml(label)} module"
          title="Remove module"
        >
          ×
        </button>
      </div>
      <div class="dr-node-body">
        <div class="dr-node-label">
          Duration
          <div class="dr-node-duration">
            <input class="dr-input dr-node-input" type="number" min="0" data-field="durationMinutes" value="${Math.floor(duration / 60)}" />
            <span class="dr-node-duration-unit">min</span>
            <input class="dr-input dr-node-input" type="number" min="0" max="59" data-field="durationSecondsPart" value="${duration % 60}" />
            <span class="dr-node-duration-unit">sec</span>
          </div>
        </div>
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
                  <option value="random_selection_among_x" ${startMode === "random_selection_among_x" ? "selected" : ""}>Random selection among X participants</option>
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
                    </label>
                    <label class="dr-node-label dr-node-checkbox">
                      <input type="checkbox" data-field="agreementRequired" ${agreementRequired} />
                      <span>Require date-time agreement</span>
                    </label>
                    <label class="dr-node-label">
                      Agreement deadline
                      <input class="dr-input dr-node-input" type="datetime-local" data-field="agreementDeadline" value="${escapeHtml(data.agreementDeadline ?? "")}" />
                    </label>`
                  : ""
              }
              ${
                startMode === "organizer_manual"
                  ? `<label class="dr-node-label">
                      Minimum participants
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="minimumParticipants" value="${data.minimumParticipants ?? ""}" />
                    </label>
                    <label class="dr-node-label dr-node-checkbox">
                      <input type="checkbox" data-field="allowStartBeforeFull" ${allowStartBeforeFull} />
                      <span>Allow start before full attendance</span>
                    </label>`
                  : ""
              }
              ${
                startMode === "random_selection_among_x"
                  ? `<label class="dr-node-label">
                      Candidate pool size
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="poolSize" value="${data.poolSize ?? ""}" />
                    </label>
                    <label class="dr-node-label">
                      Selected participants
                      <input class="dr-input dr-node-input" type="number" min="1" data-field="selectedParticipants" value="${data.selectedParticipants ?? ""}" />
                    </label>
                    <label class="dr-node-label">
                      Selection rule
                      <select class="dr-input dr-node-input" data-field="selectionRule">
                        <option value="random" ${(data.selectionRule ?? "random") === "random" ? "selected" : ""}>Random</option>
                      </select>
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
          type === "PAIRING"
            ? `<label class="dr-node-label">
                Max participants
                <input class="dr-input dr-node-input" type="number" min="2" data-field="roundMaxParticipants" value="${data.roundMaxParticipants ?? ""}" />
              </label>`
            : ""
        }
        ${
          type === "PROMPT"
            ? `<label class="dr-node-label">
                Prompt
                <select class="dr-input dr-node-input" data-field="posterId">
                  <option value="">Select a prompt</option>
                  ${posterOptions}
                </select>
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
          type === "MATCHING"
            ? `<label class="dr-node-label">
                Mode
                <select class="dr-input dr-node-input" data-field="matchingMode">
                  <option value="polar" ${matchingMode === "polar" ? "selected" : ""}>Polarize</option>
                  <option value="anti" ${matchingMode === "anti" ? "selected" : ""}>Anti-polarize</option>
                </select>
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
              </label>`
            : ""
        }
      </div>
    </div>
  `;
}

function nodeDataFromBlock(block: any): NodeData {
  return {
    durationSeconds: block.durationSeconds ?? DEFAULT_DURATIONS[block.type as BlockType],
    startMode: block.startMode ?? "specific_datetime",
    startDate: block.startDate ?? null,
    startTime: block.startTime ?? null,
    timezone: block.timezone ?? null,
    requiredParticipants: block.requiredParticipants ?? null,
    agreementRequired: block.agreementRequired ?? null,
    agreementDeadline: block.agreementDeadline ?? null,
    minimumParticipants: block.minimumParticipants ?? null,
    allowStartBeforeFull: block.allowStartBeforeFull ?? null,
    poolSize: block.poolSize ?? null,
    selectedParticipants: block.selectedParticipants ?? null,
    selectionRule: block.selectionRule ?? "random",
    note: block.note ?? null,
    participantMode: block.participantMode ?? "manual_selected",
    participantUserIds: block.participantUserIds ?? [],
    participantDataspaceIds: block.participantDataspaceIds ?? [],
    participantCount: block.participantCount ?? null,
    participantQuery: block.participantQuery ?? null,
    participantNote: block.participantNote ?? null,
    roundMaxParticipants: block.roundMaxParticipants ?? null,
    posterId: block.posterId ?? null,
    embedUrl: block.embedUrl ?? null,
    harmonicaUrl: block.harmonicaUrl ?? null,
    matchingMode: block.matchingMode ?? "polar",
    formQuestion: block.formQuestion ?? null,
    formChoices: block.formChoices ?? [],
    meditationAnimationId: block.meditationAnimationId ?? null,
    meditationAudioUrl: block.meditationAudioUrl ?? null
  };
}

function buildBlockFromNode(type: BlockType, data: NodeData) {
  const rawDuration = Number(data.durationSeconds || DEFAULT_DURATIONS[type]);
  const durationSeconds = Number.isFinite(rawDuration) ? Math.max(1, Math.round(rawDuration)) : DEFAULT_DURATIONS[type];
  const rawMax = data.roundMaxParticipants ?? null;
  const roundMaxParticipants =
    type === "PAIRING" && typeof rawMax === "number" && rawMax >= 2 ? Math.round(rawMax) : null;
  return {
    type,
    durationSeconds,
    startMode: data.startMode ?? (type === "START" ? "specific_datetime" : null),
    startDate: data.startDate ?? null,
    startTime: data.startTime ?? null,
    timezone: data.timezone ?? null,
    requiredParticipants: data.requiredParticipants ?? null,
    agreementRequired: data.agreementRequired ?? null,
    agreementDeadline: data.agreementDeadline ?? null,
    minimumParticipants: data.minimumParticipants ?? null,
    allowStartBeforeFull: data.allowStartBeforeFull ?? null,
    poolSize: data.poolSize ?? null,
    selectedParticipants: data.selectedParticipants ?? null,
    selectionRule: data.selectionRule ?? (type === "START" ? "random" : null),
    note: data.note ?? null,
    participantMode: data.participantMode ?? (type === "PARTICIPANTS" ? "manual_selected" : null),
    participantUserIds: data.participantUserIds ?? [],
    participantDataspaceIds: data.participantDataspaceIds ?? [],
    participantCount: data.participantCount ?? null,
    participantQuery: data.participantQuery ?? null,
    participantNote: data.participantNote ?? null,
    roundMaxParticipants,
    posterId: data.posterId ?? null,
    embedUrl: data.embedUrl ?? null,
    harmonicaUrl: data.harmonicaUrl ?? null,
    matchingMode: data.matchingMode ?? (type === "MATCHING" ? "polar" : null),
    formQuestion: data.formQuestion ?? null,
    formChoices: data.formChoices ?? [],
    meditationAnimationId: data.meditationAnimationId ?? null,
    meditationAudioUrl: data.meditationAudioUrl ?? null
  };
}

function buildDefaultData(type: BlockType): NodeData {
  return {
    durationSeconds: DEFAULT_DURATIONS[type],
    startMode: type === "START" ? "specific_datetime" : undefined,
    selectionRule: type === "START" ? "random" : undefined,
    participantMode: type === "PARTICIPANTS" ? "manual_selected" : undefined,
    matchingMode: type === "MATCHING" ? "polar" : undefined
  };
}

export function ModularBuilderClient({
  templates = [],
  dataspaces,
  initialTemplateId,
  draft,
  onDraftChange,
  workspaceMode = false
}: Props) {
  const editorRef = useRef<any>(null);
  const drawflowRef = useRef<HTMLDivElement | null>(null);
  const externalDraftSignatureRef = useRef<string>("");
  const emittedDraftSignatureRef = useRef<string>("");
  const [drawflowReady, setDrawflowReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modulesCollapsed, setModulesCollapsed] = useState(false);
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
  const [aiPrompt, setAiPrompt] = useState(
    "Design a 90-minute citizen assembly template to deliberate on a civic issue. Include context setting, small-group pairing, data capture, and a closing summary."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRaw, setAiRaw] = useState("");
  const [aiRequestId, setAiRequestId] = useState<string | null>(null);
  const [pendingAiDraft, setPendingAiDraft] = useState<TemplateDraft | null>(null);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [audioFiles, setAudioFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [templatesState, setTemplatesState] = useState<TemplateSummary[]>(templates);
  const [editorVersion, setEditorVersion] = useState(0);
  const resolvedTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const externalDraftSignature = useMemo(
    () => (draft ? JSON.stringify(draft) : ""),
    [draft]
  );
  const aiWorkspaceHref = useMemo(() => {
    const params = new URLSearchParams({ mode: "ai" });
    if (currentTemplateId) {
      params.set("templateId", currentTemplateId);
    }
    return `/templates/workspace?${params.toString()}`;
  }, [currentTemplateId]);


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
    if (externalDraftSignatureRef.current === externalDraftSignature) return;
    externalDraftSignatureRef.current = externalDraftSignature;
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
        const response = await fetch("/api/integrations/workflow/meditation/audio");
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        setAudioFiles(payload?.files ?? []);
      } catch {}
    }
    loadPosters().finally(() => refreshAllNodeHtml());
    loadAudio().finally(() => refreshAllNodeHtml());
  }, []);

  useEffect(() => {
    if (!workspaceMode || !onDraftChange) return;
    if (!drawflowReady || !editorReady || !editorRef.current) return;
    const nextDraft = buildWorkspaceDraft();
    if (!nextDraft) return;
    const serialized = JSON.stringify(nextDraft);
    if (serialized === emittedDraftSignatureRef.current) return;
    emittedDraftSignatureRef.current = serialized;
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

  function setupEditor() {
    if (!drawflowRef.current || !window.Drawflow) return;
    const editor = new window.Drawflow(drawflowRef.current);
    editor.reroute = true;
    editor.start();
    editor.on("nodeCreated", (id: number) => {
      const node = editor.getNodeFromId(id);
      updateNodeHtml(id, node?.name, node?.data);
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

  function updateNodeHtml(id: number, type: BlockType, data: NodeData) {
    if (!editorRef.current) return;
    const html = buildNodeHtml(type, data, { posters, audioFiles });
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

  function refreshAllNodeHtml() {
    if (!editorRef.current) return;
    const exported = editorRef.current.export();
    const data = exported?.drawflow?.Home?.data ?? {};
    Object.values(data).forEach((node: any) => {
      updateNodeHtml(Number(node.id), node.name as BlockType, node.data as NodeData);
    });
  }

  function addNode(type: BlockType, clientX: number, clientY: number) {
    if (!editorRef.current || !drawflowRef.current) return;
    const editor = editorRef.current;
    const rect = drawflowRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    const posY = clientY - rect.top;
    const data = buildDefaultData(type);
    const html = buildNodeHtml(type, data, { posters, audioFiles });
    const nodeId = editor.addNode(type, 1, 1, posX, posY, type, data, html);
    setTimeout(() => updateNodeHtml(nodeId, type, data), 0);
    setEditorVersion((prev) => prev + 1);
  }

  function addNodeAtCenter(type: BlockType) {
    if (!drawflowRef.current) return;
    const rect = drawflowRef.current.getBoundingClientRect();
    addNode(type, rect.left + rect.width / 2, rect.top + rect.height / 2);
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

  function buildBlocksFromEditor() {
    if (!editorRef.current) return { error: "Editor not ready" };
    const exported = editorRef.current.export();
    const chainResult = buildChainFromExport(exported);
    if (chainResult.error) return { error: chainResult.error };
    const chain = chainResult.chain ?? [];
    if (chain.length === 0) {
      return { error: "Template must contain at least one block." };
    }
    const blocks = chain.map((node: any) => {
      const type = node.name as BlockType;
      const data = node.data as NodeData;
      return buildBlockFromNode(type, data);
    });

    for (const block of blocks) {
      if (block.type === "PROMPT" && !block.posterId) {
        return { error: "Prompt blocks need a selected prompt." };
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
      return block;
    });

    return { blocks: normalized };
  }

  function buildWorkspaceDraft(): TemplateDraft | null {
    const build = buildBlocksFromEditor();
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
        }
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
    setCurrentTemplateId(nextDraft.id ?? null);
    setTemplateName(nextDraft.name || "New template");
    setTemplateDescription(nextDraft.description ?? "");
    setTemplatePublic(Boolean(nextDraft.isPublic));
    setSyncMode(nextDraft.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER");
    setMaxParticipantsPerRoom(
      Math.max(2, Math.min(12, Number(nextDraft.settings?.maxParticipantsPerRoom ?? 2) || 2))
    );
    setAllowOddGroup(Boolean(nextDraft.settings?.allowOddGroup));
    setLanguage(nextDraft.settings?.language === "IT" ? "IT" : "EN");
    setProvider(nextDraft.settings?.transcriptionProvider || "DEEPGRAMLIVE");
    setTimezone(nextDraft.settings?.timezone ?? "");
    setDataspaceId(nextDraft.settings?.dataspaceId ?? "");
    setRequiresApproval(Boolean(nextDraft.settings?.requiresApproval));
    setCapacity(
      typeof nextDraft.settings?.capacity === "number" && Number.isFinite(nextDraft.settings.capacity)
        ? nextDraft.settings.capacity
        : ""
    );
    if (!editorRef.current) return;
    resetEditor();
    let prevId: number | null = null;
    nextDraft.blocks.forEach((block, index) => {
      const type = block.type as BlockType;
      const data = nodeDataFromBlock(block);
      const x = 80 + (index % 2) * 260;
      const y = 60 + index * 140;
      const html = buildNodeHtml(type, data, { posters, audioFiles });
      const id = editorRef.current.addNode(type, 1, 1, x, y, type, data, html);
      if (prevId) {
        editorRef.current.addConnection(prevId, id, "output_1", "input_1");
      }
      prevId = id;
      updateNodeHtml(id, type, data);
    });
    setEditorVersion((prev) => prev + 1);
  }

  function addPairingBlocks() {
    if (!editorRef.current) return;
    const count = Math.max(1, Math.min(50, Math.round(pairingCount || 1)));
    const durationSeconds = Math.max(30, Math.round((pairingMinutes || 1) * 60));
    const exported = editorRef.current.export();
    const data = exported?.drawflow?.Home?.data ?? {};
    const nodes = Object.values(data) as any[];
    const maxY = nodes.reduce((acc, node) => Math.max(acc, Number(node.pos_y ?? 0)), 0);
    let startY = nodes.length > 0 ? maxY + 140 : 80;
    let prevId: number | null = null;
    if (nodes.length > 0) {
      const lastNode = nodes.reduce((acc, node) => (Number(node.pos_y ?? 0) > Number(acc.pos_y ?? 0) ? node : acc), nodes[0]);
      prevId = Number(lastNode.id);
    }
    for (let index = 0; index < count; index += 1) {
      const x = 120 + (index % 2) * 240;
      const y = startY + index * 140;
      const data = { durationSeconds, matchingMode: undefined };
      const html = buildNodeHtml("PAIRING", data, { posters, audioFiles });
      const id = editorRef.current.addNode("PAIRING", 1, 1, x, y, "PAIRING", data, html);
      if (prevId) {
        editorRef.current.addConnection(prevId, id, "output_1", "input_1");
      }
      prevId = id;
      updateNodeHtml(id, "PAIRING", data);
    }
    setEditorVersion((prev) => prev + 1);
  }

  async function refreshTemplates() {
    const response = await fetch("/api/plan-templates");
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    setTemplatesState(payload?.templates ?? []);
  }

  async function handleSave() {
    setSaveError(null);
    const build = buildBlocksFromEditor();
    if ("error" in build) {
      setSaveError(build.error ?? "Unable to save template.");
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
      await refreshTemplates();
      setEditorVersion((prev) => prev + 1);
    } catch {
      setSaveError("Unable to save template.");
    } finally {
      setSaving(false);
    }
  }

  function loadTemplate(template: TemplateSummary) {
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
    const nodes = template.blocks.map((block, index) => {
      const type = block.type as BlockType;
      const data = nodeDataFromBlock(block);
      return { type, data, index };
    });
    let prevId: number | null = null;
    nodes.forEach((node, index) => {
      const x = 80 + (index % 2) * 260;
      const y = 60 + index * 140;
      const html = buildNodeHtml(node.type, node.data, { posters, audioFiles });
      const id = editorRef.current.addNode(node.type, 1, 1, x, y, node.type, node.data, html);
      if (prevId) {
        editorRef.current.addConnection(prevId, id, "output_1", "input_1");
      }
      prevId = id;
      updateNodeHtml(id, node.type, node.data);
    });
    setEditorVersion((prev) => prev + 1);
  }

  function createNewTemplate() {
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
    resetEditor();
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

  function handleInlineClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const actionEl = target.closest?.("[data-action='delete-node']") as HTMLElement | null;
    if (!actionEl) return;
    event.preventDefault();
    event.stopPropagation();
    const nodeId = getNodeIdFromEventTarget(actionEl);
    if (!nodeId) return;
    removeNodeById(nodeId);
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
    } else if (field === "agreementDeadline") {
      updateNodeDataById(nodeId, { agreementDeadline: (target as HTMLInputElement).value || null });
    } else if (field === "minimumParticipants") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { minimumParticipants: raw ? Number(raw) : null });
    } else if (field === "poolSize") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { poolSize: raw ? Number(raw) : null });
    } else if (field === "selectedParticipants") {
      const raw = (target as HTMLInputElement).value;
      updateNodeDataById(nodeId, { selectedParticipants: raw ? Number(raw) : null });
    } else if (field === "formQuestion") {
      updateNodeDataById(nodeId, { formQuestion: (target as HTMLInputElement).value });
    } else if (field === "note") {
      updateNodeDataById(nodeId, { note: (target as HTMLTextAreaElement).value });
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
    } else if (field === "selectionRule") {
      updateNodeDataById(nodeId, {
        selectionRule: ((target as HTMLSelectElement).value || "random") as "random"
      });
    } else if (field === "agreementRequired") {
      updateNodeDataById(nodeId, { agreementRequired: (target as HTMLInputElement).checked });
    } else if (field === "allowStartBeforeFull") {
      updateNodeDataById(nodeId, { allowStartBeforeFull: (target as HTMLInputElement).checked });
    } else if (field === "matchingMode") {
      const value = (target as HTMLSelectElement).value === "anti" ? "anti" : "polar";
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

  return (
    <div className={`flex min-h-[560px] flex-col gap-3 overflow-hidden ${workspaceMode ? "h-full" : "h-[calc(100dvh-96px)]"}`}>
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
            <a
              href={aiWorkspaceHref}
              className="dr-button-outline px-2 py-1 text-[11px] sm:px-3 sm:text-xs"
            >
              AI Builder
            </a>
            <button
              type="button"
              className="dr-button-outline px-2 py-1 text-[11px] sm:px-3 sm:text-xs"
              onClick={addPairingBlocks}
            >
              Add pairings
            </button>
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
        <div
          className={`dr-card flex flex-col gap-3 p-3 ${
            isMobile
              ? "w-full"
              : modulesCollapsed
                ? "w-[56px]"
                : "w-[200px]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 ${modulesCollapsed ? "sr-only" : ""}`}>
              Modules
            </div>
            <button
              type="button"
              onClick={() => setModulesCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {modulesCollapsed ? ">" : "<"}
            </button>
          </div>
          {modulesCollapsed ? (
            <div className={`flex ${isMobile ? "flex-row flex-wrap" : "flex-col"} items-center gap-2`}>
              {BASIC_MODULES.map((module) => (
                <button
                  key={module.type}
                  type="button"
                  draggable={!isMobile}
                  onDragStart={(event) => handleDragStart(event, module.type)}
                  onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                  title={module.label}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-[10px] font-semibold ${module.color}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={module.icon} />
                  </svg>
                </button>
              ))}
              {PARTNER_MODULES.map((module) => (
                <button
                  key={module.type}
                  type="button"
                  draggable={!isMobile}
                  onDragStart={(event) => handleDragStart(event, module.type)}
                  onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                  title={module.label}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-[10px] font-semibold ${module.color}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={module.icon} />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className={`${isMobile ? "space-y-3" : "space-y-3 overflow-auto"}`}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Basic modules
                  </div>
                  <div className={`${isMobile ? "flex flex-wrap gap-2" : "space-y-2"}`}>
                    {BASIC_MODULES.map((module) => (
                      <button
                        key={module.type}
                        type="button"
                        draggable={!isMobile}
                        onDragStart={(event) => handleDragStart(event, module.type)}
                        onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                        title={`${module.label}: ${module.description}`}
                        className={`group relative flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold ${module.color}`}
                      >
                        <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d={module.icon} />
                        </svg>
                        {module.label}
                        {!isMobile ? (
                          <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 hidden w-56 -translate-y-1/2 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-[11px] font-medium leading-4 text-white shadow-xl group-hover:block">
                            {module.description}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Partner modules
                  </div>
                  <div className={`${isMobile ? "flex flex-wrap gap-2" : "space-y-2"}`}>
                    {PARTNER_MODULES.map((module) => (
                      <button
                        key={module.type}
                        type="button"
                        draggable={!isMobile}
                        onDragStart={(event) => handleDragStart(event, module.type)}
                        onClick={() => (isMobile ? addNodeAtCenter(module.type) : undefined)}
                        title={`${module.label}: ${module.description}`}
                        className={`group relative flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold ${module.color}`}
                      >
                        <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d={module.icon} />
                        </svg>
                        {module.label}
                        {!isMobile ? (
                          <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 hidden w-56 -translate-y-1/2 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-[11px] font-medium leading-4 text-white shadow-xl group-hover:block">
                            {module.description}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-auto text-[11px] text-slate-500">
                {isMobile ? "Tap a module to add it to the canvas." : "Drag a module into the canvas to add it to your template."}
              </p>
            </>
          )}
        </div>

        <div className="dr-card relative min-h-0 flex-1 p-0">
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
            </div>
          </div>
          <div
            ref={drawflowRef}
            className={`h-full w-full rounded-2xl ${isMobile ? "min-h-[360px]" : "min-h-[520px]"}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onClick={handleInlineClick}
            onInput={handleInlineInput}
            onChange={handleInlineChange}
            onBlur={handleInlineBlur}
          />
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
                      Minutes per pairing
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
    </div>
  );
}
