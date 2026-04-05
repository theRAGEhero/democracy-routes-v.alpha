"use client";

import { useMemo, useState } from "react";

const PRESETS = [
  {
    id: "conflict-mediation",
    label: "Conflict mediation",
    prompt:
      "Design a 45-minute conflict mediation template for 12 participants. Include a warm-up prompt, structured discussion, a note capture step, and a closing reflection."
  },
  {
    id: "citizen-assembly",
    label: "Citizen assembly",
    prompt:
      "Design a 90-minute citizen assembly template to deliberate on a civic issue. Include context setting, small-group discussion, data capture, and a closing summary."
  },
  {
    id: "deliberation",
    label: "Deliberation",
    prompt:
      "Create a structured deliberation template with 3 rounds of discussion, short pauses, and a final notes block to capture commitments."
  },
  {
    id: "strategy",
    label: "Strategy sprint",
    prompt:
      "Create a 60-minute strategy sprint template for a civic tech team. Include prompts, a form vote, and a record block for audio capture."
  },
  {
    id: "custom",
    label: "Custom",
    prompt:
      "Create a collaborative session template for 20 participants with a strong focus on agreements and action items."
  }
];

const MODULES = [
  "START",
  "PARTICIPANTS",
  "DISCUSSION",
  "PAUSE",
  "PROMPT",
  "NOTES",
  "RECORD",
  "FORM",
  "EMBED",
  "GROUPING",
  "BREAK",
  "HARMONICA",
  "DEMBRANE",
  "DELIBERAIDE",
  "POLIS",
  "AGORACITIZENS",
  "NEXUSPOLITICS",
  "SUFFRAGO"
] as const;

type Block = {
  type: (typeof MODULES)[number];
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

type TemplateDraft = {
  name: string;
  description?: string | null;
  isPublic?: boolean;
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
  };
  blocks: Block[];
};

export function TemplateAiClient() {
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [activePreset, setActivePreset] = useState(PRESETS[0].id);
  const [result, setResult] = useState<TemplateDraft | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);

  const totalDuration = useMemo(() => {
    if (!result?.blocks?.length) return 0;
    return result.blocks.reduce((sum, block) => sum + (block.durationSeconds || 0), 0);
  }, [result]);

  const debugOutput = useMemo(() => {
    if (raw) return raw;
    if (!error && !requestId && !lastStatus) return "No raw output yet.";
    return JSON.stringify(
      {
        error: error || "No valid template JSON was created.",
        requestId: requestId || null,
        lastStatus: lastStatus || null
      },
      null,
      2
    );
  }, [error, lastStatus, raw, requestId]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    setCreatedTemplateId(null);
    setRaw("");
    setLastStatus(null);
    setRequestId(null);
    try {
      const response = await fetch("/api/templates/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt })
      });
      const payloadText = await response.text();
      setRaw(payloadText || "");
      setLastStatus(`${response.status} ${response.statusText || ""}`.trim());
      let payload: any = null;
      try {
        payload = payloadText ? JSON.parse(payloadText) : null;
      } catch {
        payload = null;
      }
      if (typeof payload?.requestId === "string") {
        setRequestId(payload.requestId);
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? `Unable to generate template (HTTP ${response.status}).`);
      }
      if (!payload?.template) {
        throw new Error("No template returned by the API.");
      }
      setResult(payload.template);
      setRaw(payload.raw ?? payloadText ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate template.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    setCreatedTemplateId(null);
    try {
      const response = await fetch("/api/plan-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: result.name?.trim() || "Untitled template",
          description: result.description || null,
          isPublic: Boolean(result.isPublic),
          settings: result.settings ?? undefined,
          blocks: result.blocks
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to save template.");
      }
      setSaveMessage("Template created.");
      if (payload?.id) {
        setCreatedTemplateId(payload.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save template.";
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="dr-card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Template AI
            </p>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Generate a template with AI
            </h1>
            <p className="text-sm text-slate-600">
              Describe your session goals. The AI returns a full template using the available modules.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dr-button-outline px-3 py-1 text-xs"
              onClick={() => {
                setResult(null);
                setRaw("");
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="dr-button px-3 py-1 text-xs"
              onClick={handleGenerate}
              disabled={isLoading || prompt.trim().length === 0}
            >
              {isLoading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={activePreset === preset.id ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
              onClick={() => {
                setActivePreset(preset.id);
                setPrompt(preset.prompt);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="dr-card space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Generated template</h2>
            <div className="flex flex-wrap items-center gap-2">
              {createdTemplateId ? (
                <a
                  href={`/templates/workspace?mode=modular&templateId=${createdTemplateId}`}
                  className="dr-button-outline px-3 py-1 text-xs"
                >
                  Open in workspace
                </a>
              ) : null}
              <button
                type="button"
                className="dr-button px-3 py-1 text-xs"
                onClick={handleSave}
                disabled={!result || saving}
              >
                {saving ? "Saving..." : "Create template"}
              </button>
            </div>
          </div>
          {saveMessage ? <p className="text-xs text-slate-500">{saveMessage}</p> : null}
          {lastStatus ? <p className="text-[11px] text-slate-400">Last response: {lastStatus}</p> : null}
          {requestId ? <p className="text-[11px] text-slate-400">Request ID: {requestId}</p> : null}
          {result ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Name</p>
                <p className="text-base font-semibold text-slate-900">{result.name}</p>
              </div>
              {result.description ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Description</p>
                  <p className="text-sm text-slate-700">{result.description}</p>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{result.blocks.length} blocks</span>
                <span>{Math.round(totalDuration / 60)} min total</span>
              </div>
              <div className="space-y-2">
                {result.blocks.map((block, index) => (
                  <div key={`${block.type}-${index}`} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{block.type}</span>
                      <span>{Math.round(block.durationSeconds / 60)} min</span>
                    </div>
                    {block.formQuestion ? (
                      <p className="mt-1 text-xs text-slate-500">Q: {block.formQuestion}</p>
                    ) : null}
                    {block.embedUrl ? (
                      <p className="mt-1 text-xs text-slate-500">Embed: {block.embedUrl}</p>
                    ) : null}
                    {block.harmonicaUrl ? (
                      <p className="mt-1 text-xs text-slate-500">Harmonica: {block.harmonicaUrl}</p>
                    ) : null}
                    {block.matchingMode ? (
                      <p className="mt-1 text-xs text-slate-500">Grouping: {block.matchingMode}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No template yet. Run generation to see a draft.</p>
          )}
        </div>

        <div className="dr-card space-y-3 p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Raw output</p>
            <p className="text-sm text-slate-600">
              The JSON returned by the model, for transparency and debugging. If valid template JSON is not created, this panel shows the error log context instead.
            </p>
          </div>
          <pre className="min-h-[220px] sm:min-h-[320px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-700">
            {debugOutput}
          </pre>
        </div>
      </div>
    </div>
  );
}
