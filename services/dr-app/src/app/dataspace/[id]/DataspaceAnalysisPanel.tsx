"use client";

import { useState } from "react";

const DEFAULT_PROMPT =
  "Analyze this dataspace activity across templates and meetings. Highlight key themes, agreements, disagreements, and notable quotes.";

const PROMPT_PRESETS = [
  {
    id: "summary",
    label: "Summary",
    prompt:
      "Provide a concise summary of the dataspace activity across templates and meetings. Highlight key themes, outcomes, and notable quotes."
  },
  {
    id: "conflicts",
    label: "Conflict Finding",
    prompt:
      "Identify points of disagreement, conflict, or tension in the dataspace activity. Quote supporting excerpts and name the related topics."
  },
  {
    id: "agreements",
    label: "Agreements",
    prompt:
      "Extract points of agreement and alignment across participants. Include supporting quotes and note which meetings/templates they came from."
  },
  {
    id: "actions",
    label: "Action Items",
    prompt:
      "List actionable decisions, next steps, and responsibilities implied by the activity. Flag unclear ownership or missing follow-ups."
  },
  {
    id: "insights",
    label: "Insights",
    prompt:
      "Surface key insights, emerging patterns, and risks from the dataspace activity. Provide evidence snippets for each insight."
  }
];

type DataspaceAnalysisPanelProps = {
  dataspaceId: string;
};

type InlineChunk = { type: "text" | "bold" | "code"; value: string };

function parseInlineMarkdown(text: string): InlineChunk[] {
  const chunks: InlineChunk[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      chunks.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      chunks.push({ type: "code", value: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: "text", value: text.slice(lastIndex) });
  }

  return chunks;
}

function renderInline(text: string) {
  return parseInlineMarkdown(text).map((chunk, index) => {
    if (chunk.type === "bold") {
      return <strong key={`bold-${index}`}>{chunk.value}</strong>;
    }
    if (chunk.type === "code") {
      return (
        <code
          key={`code-${index}`}
          className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]"
        >
          {chunk.value}
        </code>
      );
    }
    return <span key={`text-${index}`}>{chunk.value}</span>;
  });
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("###### ")) {
      blocks.push(
        <h6 key={`h6-${index}`} className="text-xs font-semibold uppercase text-slate-600">
          {renderInline(trimmed.slice(7))}
        </h6>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("##### ")) {
      blocks.push(
        <h5 key={`h5-${index}`} className="text-sm font-semibold text-slate-700">
          {renderInline(trimmed.slice(6))}
        </h5>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      blocks.push(
        <h4 key={`h4-${index}`} className="text-base font-semibold text-slate-900">
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`} className="text-lg font-semibold text-slate-900">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`} className="text-xl font-semibold text-slate-900">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${index}`} className="text-2xl font-semibold text-slate-900">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current.startsWith("> ")) break;
        quoteLines.push(current.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600"
        >
          {renderInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current.startsWith("* ") && !current.startsWith("- ")) break;
        items.push(current.slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 text-slate-700">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!/^\d+\.\s+/.test(current)) break;
        items.push(current.replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 text-slate-700">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trimEnd();
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith("# ") ||
        currentTrimmed.startsWith("## ") ||
        currentTrimmed.startsWith("### ") ||
        currentTrimmed.startsWith("* ") ||
        currentTrimmed.startsWith("- ") ||
        /^\d+\.\s+/.test(currentTrimmed)
      ) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      index += 1;
    }
    const paragraph = paragraphLines.join(" ");
    if (paragraph) {
      blocks.push(
        <p key={`p-${index}`} className="text-sm text-slate-700">
          {renderInline(paragraph)}
        </p>
      );
    }
  }

  return blocks;
}

export function DataspaceAnalysisPanel({ dataspaceId }: DataspaceAnalysisPanelProps) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [provider, setProvider] = useState<"gemini" | "ollama">("gemini");
  const [createdAt, setCreatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>("summary");
  const [messages, setMessages] = useState<
    Array<
      | { id: string; role: "user"; content: string; createdAt: string }
      | {
          id: string;
          role: "assistant";
          content: string;
          createdAt: string;
          provider: "gemini" | "ollama";
        }
    >
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      prompt: string;
      provider: string;
      analysis: string;
      createdAt: string;
    }>
  >([]);

  const handleAnalyze = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    setIsLoading(true);
    setError(null);
    const requestTimestamp = new Date().toISOString();
    const userMessage = {
      id: `user-${requestTimestamp}`,
      role: "user" as const,
      content: trimmedPrompt,
      createdAt: requestTimestamp
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch(`/api/dataspaces/${dataspaceId}/analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: trimmedPrompt, provider })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to analyze dataspace.");
      }

      const payload = await response.json();
      const analysisText = String(payload.analysis ?? "").trim();
      const nextCreatedAt = payload.createdAt ?? new Date().toISOString();
      setCreatedAt(nextCreatedAt);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${nextCreatedAt}`,
          role: "assistant",
          content: analysisText,
          createdAt: nextCreatedAt,
          provider
        }
      ]);
      setPrompt("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setMessages((current) => current.filter((entry) => entry.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/dataspaces/${dataspaceId}/analysis`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load saved analyses.");
      }
      setHistory(Array.isArray(payload?.analyses) ? payload.analyses : []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load saved analyses.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="dr-card flex min-h-[640px] flex-col gap-4 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dataspace analysis
          </p>
          <h2
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Analysis chat
          </h2>
          <p className="text-sm text-slate-600">
            Use the AI to analyze meetings and templates in this dataspace, then reopen saved reports from the history modal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={provider === "gemini" ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
            onClick={() => setProvider("gemini")}
          >
            Gemini
          </button>
          <button
            type="button"
            className={provider === "ollama" ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
            onClick={() => setProvider("ollama")}
          >
            Ollama
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={isActive ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
              onClick={() => {
                setActivePreset(preset.id);
                setPrompt(preset.prompt);
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center text-center">
            <div className="max-w-lg">
              <p className="text-sm font-semibold text-slate-900">Start the analysis conversation</p>
              <p className="mt-2 text-sm text-slate-500">
                Pick a preset or write a custom prompt below. Saved reports remain available in
                the <span className="font-semibold text-slate-600">Previous runs</span> modal.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-sm">
                    <p>{message.content}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/60">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {message.provider}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-3">{renderMarkdownBlocks(message.content)}</div>
                  </div>
                </div>
              )
            )}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  Analyzing dataspace activity...
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="dr-button px-4 py-2 text-sm"
            onClick={handleAnalyze}
            disabled={isLoading || prompt.trim().length === 0}
          >
            {isLoading ? "Analyzing..." : "Run analysis"}
          </button>
          <button
            type="button"
            className="dr-button-outline px-4 py-2 text-sm"
            onClick={() => {
              setHistoryOpen(true);
              void loadHistory();
            }}
          >
            Previous runs
          </button>
          {createdAt ? (
            <span className="text-xs text-slate-500">
              Last run: {new Date(createdAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        <textarea
          className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask the AI to analyze this dataspace..."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[var(--surface-soft)] shadow-[0_35px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Dataspace analysis history
                </p>
                <h3
                  className="mt-1 text-2xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Previous runs
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Saved analysis prompts and results for this dataspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {historyLoading ? <p className="text-sm text-slate-500">Loading previous analyses...</p> : null}
              {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
              {!historyLoading && !historyError && history.length === 0 ? (
                <p className="text-sm text-slate-500">No saved analysis runs yet.</p>
              ) : null}
              {!historyLoading && !historyError && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {entry.provider}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="dr-button-outline px-3 py-1 text-xs"
                          onClick={() => {
                            setPrompt(entry.prompt);
                            setProvider(entry.provider === "ollama" ? "ollama" : "gemini");
                            setCreatedAt(entry.createdAt);
                            setMessages([
                              {
                                id: `history-user-${entry.id}`,
                                role: "user",
                                content: entry.prompt,
                                createdAt: entry.createdAt
                              },
                              {
                                id: `history-assistant-${entry.id}`,
                                role: "assistant",
                                content: entry.analysis,
                                createdAt: entry.createdAt,
                                provider: entry.provider === "ollama" ? "ollama" : "gemini"
                              }
                            ]);
                            setHistoryOpen(false);
                          }}
                        >
                          Load into panel
                        </button>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Prompt
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{entry.prompt}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 space-y-3">
                          {renderMarkdownBlocks(entry.analysis)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
