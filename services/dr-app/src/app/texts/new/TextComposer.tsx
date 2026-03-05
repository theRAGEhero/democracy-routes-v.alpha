"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DataspaceOption = {
  id: string;
  name: string;
};

type Props = {
  dataspaces: DataspaceOption[];
  initialText?: {
    id: string;
    content: string;
    dataspaceId: string | null;
  };
};

export function TextComposer({ dataspaces, initialText }: Props) {
  const router = useRouter();
  const [textId, setTextId] = useState<string | null>(initialText?.id ?? null);
  const [content, setContent] = useState(initialText?.content ?? "");
  const [dataspaceId, setDataspaceId] = useState(initialText?.dataspaceId ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialText?.id) {
      setStatus("saved");
      return;
    }
    let active = true;
    async function createDraft() {
      setStatus("saving");
      const response = await fetch("/api/texts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataspaceId: dataspaceId || null })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (active) {
          setStatus("error");
          setError(payload?.error ?? "Unable to create text");
        }
        return;
      }
      if (active) {
        setTextId(payload?.id ?? null);
        setStatus("saved");
      }
    }
    createDraft();
    return () => {
      active = false;
    };
  }, [initialText?.id]);

  const trimmed = useMemo(() => content.trim(), [content]);

  useEffect(() => {
    if (!textId) return;
    setStatus("saving");

    const timer = setTimeout(async () => {
      const response = await fetch(`/api/texts/${textId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          dataspaceId: dataspaceId || null
        })
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("saved");
    }, 500);

    return () => clearTimeout(timer);
  }, [content, dataspaceId, textId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex h-[calc(100dvh-2rem)] w-[min(100%,1100px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              New text
            </p>
            <p className="text-sm text-slate-500">
              {status === "saving" ? "Saving..." : status === "error" ? "Save failed" : "Saved"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dataspaceId}
              onChange={(event) => setDataspaceId(event.target.value)}
              className="dr-input rounded px-3 py-2 text-sm"
            >
              <option value="">Personal</option>
              {dataspaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="dr-button-outline px-4 py-2 text-sm"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-8">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Start writing..."
            className="h-full w-full resize-none border-none bg-transparent text-[18px] leading-relaxed text-slate-800 outline-none"
            style={{ fontFamily: "var(--font-serif)" }}
          />
        </div>
        <div className="border-t border-slate-200 bg-white/90 px-6 py-3 text-xs text-slate-500">
          {error ? error : trimmed ? `${trimmed.length} characters` : "Your text is autosaved."}
        </div>
      </div>
    </div>
  );
}
