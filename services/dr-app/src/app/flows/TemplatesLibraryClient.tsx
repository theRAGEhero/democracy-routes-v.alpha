"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  authorEmail: string;
  createdById: string;
  isPublic: boolean;
  totalSeconds: number;
  types: Record<string, number>;
};

type Props = {
  templates: TemplateSummary[];
  currentUserId: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function TemplateCard({ flow }: { flow: TemplateSummary }) {
  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{flow.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {flow.description || "No description provided."}
          </p>
          <p className="mt-1 text-xs text-slate-500">By {flow.authorEmail}</p>
        </div>
        <div className="text-xs text-slate-500">
          Updated {new Date(flow.updatedAt).toLocaleString()}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold">
          {formatDuration(flow.totalSeconds)} total
        </span>
        <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
          {(flow.types.PAIRING ?? flow.types.ROUND ?? 0)} pairings
        </span>
        {(flow.types.PAUSE ?? flow.types.MEDITATION) ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
            {(flow.types.PAUSE ?? flow.types.MEDITATION)} pauses
          </span>
        ) : null}
        {flow.types.RECORD ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
            {flow.types.RECORD} records
          </span>
        ) : null}
        {(flow.types.PROMPT ?? flow.types.POSTER) ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
            {(flow.types.PROMPT ?? flow.types.POSTER)} prompts
          </span>
        ) : null}
        {(flow.types.NOTES ?? flow.types.TEXT) ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
            {(flow.types.NOTES ?? flow.types.TEXT)} notes
          </span>
        ) : null}
        {flow.types.FORM ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
            {flow.types.FORM} forms
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/flows/new?templateId=${flow.id}`} className="dr-button px-4 py-2 text-sm">
          Use this template
        </Link>
        <Link
          href={`/flows/new?templateId=${flow.id}&customize=1`}
          className="dr-button-outline px-4 py-2 text-sm"
        >
          Structured
        </Link>
        <Link
          href={`/templates/workspace?mode=modular&templateId=${flow.id}`}
          className="dr-button-outline px-4 py-2 text-sm"
        >
          Modular
        </Link>
        <Link
          href={`/templates/workspace?mode=ai&templateId=${flow.id}`}
          className="dr-button-outline px-4 py-2 text-sm"
        >
          AI
        </Link>
      </div>
    </div>
  );
}

export function TemplatesLibraryClient({ templates, currentUserId }: Props) {
  const [filter, setFilter] = useState<"both" | "public" | "personal">("both");

  const { personalTemplates, publicTemplates } = useMemo(() => {
    const personal = templates.filter((template) => template.createdById === currentUserId);
    const personalIds = new Set(personal.map((template) => template.id));
    const publicOnly = templates.filter(
      (template) => template.isPublic && !personalIds.has(template.id)
    );
    return {
      personalTemplates: personal,
      publicTemplates: publicOnly
    };
  }, [currentUserId, templates]);

  const showPersonal = filter === "both" || filter === "personal";
  const showPublic = filter === "both" || filter === "public";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Template library
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            All templates
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse public templates, your own templates, or both.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-white/80 p-1 text-xs font-semibold text-slate-600">
            {[
              { key: "both", label: "Both" },
              { key: "public", label: "Public" },
              { key: "personal", label: "Personal" }
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key as typeof filter)}
                className={`rounded-full px-3 py-1.5 transition ${
                  filter === option.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Link href="/flows/new?mode=template" className="dr-button px-4 py-2 text-sm">
            New template
          </Link>
        </div>
      </div>

      {showPersonal ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your templates</h2>
            <p className="mt-1 text-sm text-slate-600">
              Templates created by you, including private drafts.
            </p>
          </div>
          {personalTemplates.length === 0 ? (
            <div className="dr-card p-6 text-sm text-slate-600">You have not created any templates yet.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {personalTemplates.map((flow) => (
                <TemplateCard key={flow.id} flow={flow} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showPublic ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Public templates</h2>
            <p className="mt-1 text-sm text-slate-600">
              Shared templates you can reuse immediately or customize.
            </p>
          </div>
          {publicTemplates.length === 0 ? (
            <div className="dr-card p-6 text-sm text-slate-600">No public templates yet.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {publicTemplates.map((flow) => (
                <TemplateCard key={flow.id} flow={flow} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
