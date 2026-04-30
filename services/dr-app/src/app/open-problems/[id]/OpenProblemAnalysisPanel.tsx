"use client";

import { useState } from "react";

const DEFAULT_PROMPT =
  "Analyze this open problem together with its linked meetings and flows. Highlight key themes, decisions, open tensions, and next steps.";

const PROMPT_PRESETS = [
  {
    id: "summary",
    label: "Summary",
    prompt:
      "Summarize this open problem and the associated meetings and flows. Highlight the main issue, what has already been discussed, and where the process stands."
  },
  {
    id: "meetings",
    label: "Meetings",
    prompt:
      "Focus on the linked meetings. Extract themes, agreements, disagreements, and notable quotes from the available meeting material."
  },
  {
    id: "flows",
    label: "Flows",
    prompt:
      "Focus on the linked flows. Explain what process work has already been organized, what insights were captured, and what remains unresolved."
  },
  {
    id: "actions",
    label: "Actions",
    prompt:
      "List concrete next actions, follow-ups, and missing connections across the linked meetings and flows for this open problem."
  }
] as const;

type Props = {
  openProblemId: string;
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
    if (token.startsWith("**")) chunks.push({ type: "bold", value: token.slice(2, -2) });
    else if (token.startsWith("`")) chunks.push({ type: "code", value: token.slice(1, -1) });
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    chunks.push({ type: "text", value: text.slice(lastIndex) });
  }
  return chunks;
}

function renderInline(text: string) {
  return parseInlineMarkdown(text).map((chunk, index) => {
    if (chunk.type === "bold") return <strong key={`bold-${index}`}>{chunk.value}</strong>;
    if (chunk.type === "code") {
      return (
        <code key={`code-${index}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
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
    const trimmed = lines[index]?.trim() ?? "";
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`} className="text-base font-semibold text-slate-900">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      index += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`} className="text-lg font-semibold text-slate-900">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      index += 1;
      continue;
    }
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        if (!current.startsWith("* ") && !current.startsWith("- ")) break;
        items.push(current.slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 text-slate-700">
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index]?.trim() ?? "";
      if (!current || current.startsWith("## ") || current.startsWith("### ") || current.startsWith("* ") || current.startsWith("- ")) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`} className="text-sm text-slate-700">
        {renderInline(paragraphLines.join(" "))}
      </p>
    );
  }

  return blocks;
}

export function OpenProblemAnalysisPanel({ openProblemId }: Props) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [provider, setProvider] = useState<"gemini" | "ollama">("gemini");
  const [activePreset, setActivePreset] = useState("summary");
  const [createdAt, setCreatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<
      | { id: string; role: "user"; content: string; createdAt: string }
      | { id: string; role: "assistant"; content: string; createdAt: string; provider: "gemini" | "ollama" }
    >
  >([]);

  async function handleAnalyze() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) return;
    const requestTimestamp = new Date().toISOString();
    const userMessage = {
      id: `user-${requestTimestamp}`,
      role: "user" as const,
      content: trimmedPrompt,
      createdAt: requestTimestamp
    };
    setMessages((current) => [...current, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/open-problems/${openProblemId}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, provider })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to analyze open problem.");
      }
      const nextCreatedAt = payload?.createdAt ?? new Date().toISOString();
      setCreatedAt(nextCreatedAt);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${nextCreatedAt}`,
          role: "assistant",
          content: String(payload?.analysis ?? "").trim(),
          createdAt: nextCreatedAt,
          provider
        }
      ]);
      setPrompt("");
    } catch (nextError) {
      setMessages((current) => current.filter((entry) => entry.id !== userMessage.id));
      setError(nextError instanceof Error ? nextError.message : "Unable to analyze open problem.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="dr-card flex min-h-[640px] flex-col gap-4 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Open problem analysis
          </p>
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Analysis chat
          </h2>
          <p className="text-sm text-slate-600">
            Ask the AI to analyze this open problem and the linked meetings and flows together.
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
        {PROMPT_PRESETS.map((preset) => (
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

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center text-center">
            <div className="max-w-lg">
              <p className="text-sm font-semibold text-slate-900">Start with a focused question</p>
              <p className="mt-2 text-sm text-slate-500">
                The analysis will use the open problem itself together with the meetings and flows linked to it.
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
                  Analyzing linked meetings and flows...
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
          {createdAt ? <span className="text-xs text-slate-500">Last run: {new Date(createdAt).toLocaleString()}</span> : null}
        </div>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask the AI about the open problem and its linked items..."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
