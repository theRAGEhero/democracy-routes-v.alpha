"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dataspaceId: string;
};

export function DataspaceImportSources({ dataspaceId }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#import-sources") {
      setIsOpen(true);
    }
  }, []);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!pasteContent.trim() && !file) {
      setError("Paste text or upload a .txt file.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("dataspaceId", dataspaceId);
    if (pasteContent.trim()) {
      formData.append("content", pasteContent.trim());
    }
    if (file) {
      formData.append("file", file);
    }

    try {
      const response = await fetch("/api/texts", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Unable to import text");
        return;
      }
      setSuccess("Transcript imported.");
      setPasteContent("");
      setFile(null);
      router.refresh();
    } catch (err) {
      setError("Unable to import text");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="import-sources" className="dr-card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Import sources</p>
          <p className="text-sm text-slate-600">Add transcript text to this dataspace.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="dr-button-outline px-3 py-1.5 text-xs"
        >
          {isOpen ? "Hide" : "Import"}
        </button>
      </div>
      {isOpen ? (
        <div className="p-6">
        <p className="text-sm text-slate-600">
          Add transcript text to this dataspace from a file or a paste.
        </p>
        <form onSubmit={handleImport} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Paste transcript text</label>
            <textarea
              value={pasteContent}
              onChange={(event) => setPasteContent(event.target.value)}
              className="dr-input mt-2 w-full rounded px-3 py-2 text-sm"
              rows={6}
              placeholder="Paste the conversation transcript here..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Upload .txt file</label>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 text-xs text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-500">Max size 2MB. .txt only.</p>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
            {loading ? "Importing..." : "Import transcript"}
          </button>
        </form>
      </div>
      ) : null}
    </section>
  );
}
