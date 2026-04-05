"use client";

import { useMemo, useState } from "react";
import { TEMPLATE_BLOCK_TYPES } from "@/lib/templateDraft";

type Props = {
  initialDescriptions: Record<string, string>;
  defaults: Record<string, string>;
  initialInstructions: string;
  instructionDefaults: string;
};

export function TemplateModuleDescriptionsClient({
  initialDescriptions,
  defaults,
  initialInstructions,
  instructionDefaults
}: Props) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initialDescriptions);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modules = useMemo(
    () =>
      TEMPLATE_BLOCK_TYPES.map((type) => ({
        type,
        description: descriptions[type] || "",
        defaultDescription: defaults[type] || ""
      })),
    [descriptions, defaults]
  );

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/template-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          descriptions,
          instructions
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save module descriptions."
        );
      }
      setDescriptions(payload?.descriptions ?? descriptions);
      setInstructions(payload?.instructions ?? instructions);
      setStatus("Saved");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save module descriptions.");
    } finally {
      setSaving(false);
    }
  }

  function restoreDefault(type: string) {
    setDescriptions((current) => ({
      ...current,
      [type]: defaults[type] || current[type] || ""
    }));
  }

  function restoreInstructionDefault() {
    setInstructions(instructionDefaults);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Template workspace
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Module descriptions
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            These descriptions are used by Template AI when it decides how to generate or modify templates.
            They are also the reference text for future builder help surfaces.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="dr-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save descriptions"}
          </button>
        </div>
      </div>

      <section className="dr-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Template AI instructions</h2>
            <p className="mt-1 text-sm text-slate-600">
              This is the global instruction text injected into the Template AI system prompt before it
              generates or modifies templates.
            </p>
          </div>
          <button
            type="button"
            onClick={restoreInstructionDefault}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Restore default
          </button>
        </div>

        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={14}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        />

        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Show default instructions
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{instructionDefaults}</p>
        </details>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {modules.map((module) => (
          <section key={module.type} className="dr-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{module.type}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  AI-facing module guidance
                </p>
              </div>
              <button
                type="button"
                onClick={() => restoreDefault(module.type)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Restore default
              </button>
            </div>

            <textarea
              value={module.description}
              onChange={(event) =>
                setDescriptions((current) => ({
                  ...current,
                  [module.type]: event.target.value
                }))
              }
              rows={6}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            />

            <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">
                Show default description
              </summary>
              <p className="mt-2 whitespace-pre-wrap">{module.defaultDescription}</p>
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}
