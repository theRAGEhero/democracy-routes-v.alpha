"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  isPublic: boolean;
  createdById: string;
  blocks: Array<Record<string, unknown>>;
};

type Poster = {
  id: string;
  title: string;
  content: string;
};

type Props = {
  templates: TemplateSummary[];
  initialTemplateId?: string | null;
};

type BlockType =
  | "PAIRING"
  | "PAUSE"
  | "PROMPT"
  | "NOTES"
  | "RECORD"
  | "FORM"
  | "EMBED"
  | "MATCHING";

type NodeData = {
  durationSeconds?: number;
  roundMaxParticipants?: number | null;
  posterId?: string | null;
  embedUrl?: string | null;
  matchingMode?: "polar" | "anti";
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }>;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

const MODULES: Array<{ type: BlockType; label: string; color: string }> = [
  { type: "PAIRING", label: "Pairing", color: "bg-amber-100 text-amber-900" },
  { type: "PAUSE", label: "Pause", color: "bg-sky-100 text-sky-900" },
  { type: "PROMPT", label: "Prompt", color: "bg-emerald-100 text-emerald-900" },
  { type: "NOTES", label: "Notes", color: "bg-slate-100 text-slate-900" },
  { type: "FORM", label: "Form", color: "bg-violet-100 text-violet-900" },
  { type: "EMBED", label: "Embed", color: "bg-orange-100 text-orange-900" },
  { type: "MATCHING", label: "Matching", color: "bg-rose-100 text-rose-900" },
  { type: "RECORD", label: "Record", color: "bg-indigo-100 text-indigo-900" }
];

const DEFAULT_DURATIONS: Record<BlockType, number> = {
  PAIRING: 600,
  PAUSE: 300,
  PROMPT: 120,
  NOTES: 120,
  FORM: 120,
  EMBED: 180,
  MATCHING: 60,
  RECORD: 120
};

const MEDITATION_ANIMATIONS = [
  { id: "default", label: "Default Flow" },
  { id: "pulse", label: "Pulse" },
  { id: "wave", label: "Wave" }
];

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

  return `
    <div class="dr-node-card" data-type="${escapeHtml(type)}">
      <div class="dr-node-header">
        <span class="dr-node-title">${escapeHtml(label)}</span>
        <span class="dr-node-tag">${escapeHtml(type)}</span>
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
          type === "EMBED"
            ? `<label class="dr-node-label">
                Embed URL
                <input class="dr-input dr-node-input" type="text" data-field="embedUrl" value="${escapeHtml(data.embedUrl ?? "")}" placeholder="https://..." />
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
    roundMaxParticipants: block.roundMaxParticipants ?? null,
    posterId: block.posterId ?? null,
    embedUrl: block.embedUrl ?? null,
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
    roundMaxParticipants,
    posterId: data.posterId ?? null,
    embedUrl: data.embedUrl ?? null,
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
    matchingMode: type === "MATCHING" ? "polar" : undefined
  };
}

export function ModularBuilderClient({ templates, initialTemplateId }: Props) {
  const editorRef = useRef<any>(null);
  const drawflowRef = useRef<HTMLDivElement | null>(null);
  const [drawflowReady, setDrawflowReady] = useState(false);
  const [modulesCollapsed, setModulesCollapsed] = useState(false);
  const [templatesCollapsed, setTemplatesCollapsed] = useState(true);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    initialTemplateId || null
  );
  const [templateName, setTemplateName] = useState("New template");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templatePublic, setTemplatePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [audioFiles, setAudioFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [templatesState, setTemplatesState] = useState<TemplateSummary[]>(templates);


  useEffect(() => {
    if (!initialTemplateId) return;
    const target = templatesState.find((t) => t.id === initialTemplateId);
    if (target) {
      loadTemplate(target);
    }
  }, [initialTemplateId, templatesState]);

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
  }

  useEffect(() => {
    if (!drawflowReady) return;
    setupEditor();
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
    }

    const normalized = blocks.map((block) => {
      if (block.type === "EMBED" && block.embedUrl) {
        return { ...block, embedUrl: normalizeEmbedUrl(block.embedUrl) || block.embedUrl };
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
  }

  function createNewTemplate() {
    setCurrentTemplateId(null);
    setTemplateName("New template");
    setTemplateDescription("");
    setTemplatePublic(false);
    resetEditor();
  }

  function updateNodeDataById(nodeId: number, partial: Partial<NodeData>) {
    if (!editorRef.current) return;
    const existing = editorRef.current.getNodeFromId(nodeId);
    const next = { ...(existing?.data || {}), ...partial };
    editorRef.current.updateNodeDataFromId(nodeId, next);
  }

  function getNodeIdFromEventTarget(target: HTMLElement | null) {
    const nodeEl = target?.closest?.("[id^='node-']") as HTMLElement | null;
    if (!nodeEl) return null;
    const raw = nodeEl.id.replace("node-", "");
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
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
    } else if (field === "formQuestion") {
      updateNodeDataById(nodeId, { formQuestion: (target as HTMLInputElement).value });
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
    if (field !== "embedUrl") return;
    const nodeId = getNodeIdFromEventTarget(target);
    if (!nodeId) return;
    const normalized = normalizeEmbedUrl((target as HTMLInputElement).value);
    if (normalized !== (target as HTMLInputElement).value) {
      (target as HTMLInputElement).value = normalized;
    }
    updateNodeDataById(nodeId, { embedUrl: normalized });
  }

  return (
    <div className="flex h-[calc(100dvh-96px)] min-h-[560px] flex-col gap-3 overflow-hidden">
      <Script
        src="https://cdn.jsdelivr.net/gh/jerosoler/Drawflow@0.0.48/dist/drawflow.min.js"
        onLoad={() => setDrawflowReady(true)}
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/jerosoler/Drawflow@0.0.48/dist/drawflow.min.css"
      />

      <div className="dr-card flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Modular Builder</p>
            <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              {templateName || "New template"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-500">Name</label>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                className="dr-input mt-1 w-[220px] rounded px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-500">Description</label>
              <input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                className="dr-input mt-1 w-[280px] rounded px-2 py-1.5 text-xs"
              />
            </div>
            <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={templatePublic}
                onChange={(event) => setTemplatePublic(event.target.checked)}
              />
              Public
            </label>
            {saveError ? <p className="mt-5 text-xs text-rose-600">{saveError}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dr-button-outline px-3 py-1 text-xs" onClick={createNewTemplate}>
            New template
          </button>
          <button type="button" className="dr-button px-3 py-1 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className={`dr-card flex flex-col gap-3 p-3 ${modulesCollapsed ? "w-[56px]" : "w-[200px]"}`}>
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
            <div className="flex flex-col items-center gap-2">
              {MODULES.map((module) => (
                <div
                  key={module.type}
                  draggable
                  onDragStart={(event) => handleDragStart(event, module.type)}
                  title={module.label}
                  className={`flex h-9 w-9 cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-white text-[10px] font-semibold ${module.color}`}
                >
                  {module.label.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2 overflow-auto">
                {MODULES.map((module) => (
                  <div
                    key={module.type}
                    draggable
                    onDragStart={(event) => handleDragStart(event, module.type)}
                    className={`flex cursor-grab items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold ${module.color}`}
                  >
                    {module.label}
                  </div>
                ))}
              </div>
              <p className="mt-auto text-[11px] text-slate-500">
                Drag a module into the canvas to add it to your template.
              </p>
            </>
          )}
        </div>

        <div className="dr-card relative min-h-0 flex-1 p-0">
          <div
            ref={drawflowRef}
            className="h-full min-h-[520px] w-full rounded-2xl"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
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

        <div className={`dr-card flex flex-col p-3 ${templatesCollapsed ? "w-[56px]" : "w-[260px]"}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-semibold text-slate-900 ${templatesCollapsed ? "sr-only" : ""}`}>Templates</h3>
            <button
              type="button"
              onClick={() => setTemplatesCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {templatesCollapsed ? "<" : ">"}
            </button>
          </div>
          {!templatesCollapsed ? (
            <>
              <div className="mt-3 flex-1 space-y-2 overflow-auto">
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
            <div className="mt-2 text-center text-[10px] text-slate-500">{templatesState.length}</div>
          )}
        </div>
      </div>
    </div>
  );
}
