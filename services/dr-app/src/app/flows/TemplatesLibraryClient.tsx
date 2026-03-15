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

type AssistantMessage =
  | {
      id: string;
      role: "user";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      recommendations: Array<{ templateId: string; reason: string }>;
      suggestStartFresh: boolean;
      freshReason: string | null;
      requestId?: string;
    };

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildTemplateLinks(templateId: string) {
  return {
    use: `/flows/new?templateId=${templateId}`,
    structured: `/flows/new?templateId=${templateId}&customize=1`,
    modular: `/templates/workspace?mode=modular&templateId=${templateId}`
  };
}

function TemplateCard({ flow }: { flow: TemplateSummary }) {
  const links = buildTemplateLinks(flow.id);
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
          {(flow.types.PAIRING ?? flow.types.ROUND ?? 0)} discussions
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
        <Link href={links.use} className="dr-button px-4 py-2 text-sm">
          Use this template
        </Link>
        <Link href={links.structured} className="dr-button-outline px-4 py-2 text-sm">
          Structured
        </Link>
        <Link href={links.modular} className="dr-button-outline px-4 py-2 text-sm">
          Modular
        </Link>
      </div>
    </div>
  );
}

export function TemplatesLibraryClient({ templates, currentUserId }: Props) {
  const [filter, setFilter] = useState<"both" | "public" | "personal">("both");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      content:
        "Tell me what kind of session you want to run. I can point you to an existing template, or tell you when it is better to start fresh in Structured or Modular Builder.",
      recommendations: [],
      suggestStartFresh: false,
      freshReason: null
    }
  ]);

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
  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  );

  async function handleAssistantSubmit() {
    const prompt = assistantInput.trim();
    if (!prompt || assistantLoading) return;

    const nextUserMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setAssistantInput("");
    setAssistantLoading(true);
    setAssistantError(null);

    try {
      const response = await fetch("/api/templates/library-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          templates,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorText =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.details?.error?.message === "string"
              ? data.details.error.message
              : "Unable to run the template library assistant.";
        throw new Error(errorText);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.assistantMessage,
          recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
          suggestStartFresh: Boolean(data.suggestStartFresh),
          freshReason: typeof data.freshReason === "string" ? data.freshReason : null,
          requestId: typeof data.requestId === "string" ? data.requestId : undefined
        }
      ]);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Unable to run the template library assistant.");
    } finally {
      setAssistantLoading(false);
    }
  }

  const assistantPanel = (
    <section
      className={`dr-card flex h-full min-h-[520px] flex-col overflow-hidden transition-all duration-200 ${
        assistantCollapsed ? "w-full max-w-[72px] p-2" : "p-5"
      }`}
    >
      <div className={`${assistantCollapsed ? "flex h-full flex-col items-center gap-3" : ""}`}>
        <div className={`flex items-start justify-between gap-3 ${assistantCollapsed ? "w-full flex-col items-center" : ""}`}>
          {assistantCollapsed ? (
            <button
              type="button"
              onClick={() => setAssistantCollapsed(false)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label="Open AI assistant"
            >
              AI
            </button>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  AI assistant
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Template helper</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Ask for a starting point. The assistant can recommend an existing template or tell
                  you when to start fresh in Structured or Modular Builder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssistantCollapsed(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Collapse AI assistant"
              >
                {"<"}
              </button>
            </>
          )}
        </div>

        {assistantCollapsed ? (
          <div className="mt-auto flex -rotate-180 items-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 [writing-mode:vertical-rl]">
            Template helper
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link href="/flows/new?mode=template" className="dr-button-outline px-3 py-2">
                Start in Structured
              </Link>
              <Link href="/templates/workspace?mode=modular" className="dr-button-outline px-3 py-2">
                Start in Modular
              </Link>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-full space-y-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700 shadow-sm">
                      <p>{message.content}</p>

                      {message.recommendations.length ? (
                        <div className="grid gap-3">
                          {message.recommendations.map((recommendation) => {
                            const template = templateById.get(recommendation.templateId);
                            if (!template) return null;
                            const links = buildTemplateLinks(template.id);
                            return (
                              <div
                                key={recommendation.templateId}
                                className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-900">{template.name}</p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {template.description || "No description provided."}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500">
                                    {formatDuration(template.totalSeconds)}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-600">{recommendation.reason}</p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <Link href={links.use} className="dr-button px-3 py-2 text-xs">
                                    Use
                                  </Link>
                                  <Link href={links.structured} className="dr-button-outline px-3 py-2 text-xs">
                                    Structured
                                  </Link>
                                  <Link href={links.modular} className="dr-button-outline px-3 py-2 text-xs">
                                    Modular
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {message.suggestStartFresh ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
                          <p className="font-semibold">Start fresh</p>
                          <p className="mt-1">{message.freshReason || "A new template is likely the better fit."}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link href="/flows/new?mode=template" className="dr-button-outline px-3 py-2 text-xs">
                              Structured Builder
                            </Link>
                            <Link
                              href="/templates/workspace?mode=modular"
                              className="dr-button-outline px-3 py-2 text-xs"
                            >
                              Modular Builder
                            </Link>
                          </div>
                        </div>
                      ) : null}

                      {message.requestId ? (
                        <p className="text-[11px] text-slate-400">Request ID: {message.requestId}</p>
                      ) : null}
                    </div>
                  </div>
                )
              )}

              {assistantError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {assistantError}
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ask for a starting point
              </label>
              <textarea
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                rows={3}
                placeholder="For example: I need a 60-minute conflict mediation session for 20 people, with structured prompts and a short closing form."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Session-local helper. Recommendations are not saved.
                </p>
                <button
                  type="button"
                  onClick={handleAssistantSubmit}
                  disabled={assistantLoading || !assistantInput.trim()}
                  className="dr-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assistantLoading ? "Thinking..." : "Ask AI"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-6 xl:grid-cols-[minmax(0,1fr)_${assistantCollapsed ? "72px" : "360px"}]`}
      >
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

          <div className="xl:hidden">{assistantPanel}</div>

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

        <div className="hidden xl:block">{assistantPanel}</div>
      </div>
    </div>
  );
}
