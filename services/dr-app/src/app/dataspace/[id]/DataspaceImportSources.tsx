"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dataspaceId: string;
};

export function DataspaceImportSources({ dataspaceId }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#import-sources") {
      dialogRef.current?.showModal();
    }
  }, []);

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
    setDragActive(false);
  }

  function acceptFile(nextFile: File | null) {
    if (!nextFile) return;
    if (!/\.txt$/i.test(nextFile.name) && nextFile.type !== "text/plain") {
      setError("Only .txt files are supported.");
      return;
    }
    setError(null);
    setFile(nextFile);
  }

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
    } catch {
      setError("Unable to import text");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="dr-button-outline px-3 py-2 text-xs"
      >
        Import Sources
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(96vw,880px)] max-w-none rounded-none border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Import sources
            </p>
            <p className="text-sm text-slate-700">
              Upload transcript files or paste conversation text into this dataspace.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleImport} className="max-h-[calc(90vh-72px)] space-y-5 overflow-y-auto px-6 py-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) {
                setDragActive(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragActive
                ? "border-slate-900 bg-slate-50"
                : "border-slate-300 bg-slate-50/70"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">Drag and drop a `.txt` transcript here</p>
            <p className="mt-2 text-xs text-slate-500">
              or use the upload button below. Max size 2MB.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="dr-button px-4 py-2 text-sm"
              >
                Upload file
              </button>
              {file ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  {file.name}
                </span>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-900">Paste transcript text</label>
            <textarea
              value={pasteContent}
              onChange={(event) => setPasteContent(event.target.value)}
              className="dr-input mt-2 w-full rounded px-3 py-2 text-sm"
              rows={10}
              placeholder="Paste the conversation transcript here..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Imported sources are saved as dataspace texts and can later feed analysis.
            </p>
            <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
              {loading ? "Importing..." : "Import transcript"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
