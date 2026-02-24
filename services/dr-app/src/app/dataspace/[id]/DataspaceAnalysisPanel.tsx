"use client";

import { useState } from "react";

const DEFAULT_PROMPT =
  "Analyze this dataspace activity across templates and meetings. Highlight key themes, agreements, disagreements, and notable quotes.";

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

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${index}`} className="text-xl font-semibold text-slate-900">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      index += 1;
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
  const [analysis, setAnalysis] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dataspaces/${dataspaceId}/analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt, provider })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to analyze dataspace.");
      }

      const payload = await response.json();
      setAnalysis(payload.analysis ?? "");
      setCreatedAt(payload.createdAt ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dr-card space-y-4 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dataspace analysis
          </p>
          <h2
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Analysis Prompt
          </h2>
          <p className="text-sm text-slate-600">
            Ask the AI to read all templates and meetings in this dataspace.
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

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Prompt
        </label>
        <textarea
          className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="dr-button px-4 py-2 text-sm"
          onClick={handleAnalyze}
          disabled={isLoading || prompt.trim().length === 0}
        >
          {isLoading ? "Analyzing..." : "Run analysis"}
        </button>
        {createdAt ? (
          <span className="text-xs text-slate-500">Last run: {new Date(createdAt).toLocaleString()}</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {analysis ? (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 space-y-3">
          {renderMarkdownBlocks(analysis)}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No analysis yet.</p>
      )}
    </div>
  );
}
