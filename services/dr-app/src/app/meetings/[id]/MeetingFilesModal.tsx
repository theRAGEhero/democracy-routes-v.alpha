"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RecordingFile = {
  sessionId: string;
  filename: string;
  bytes: number;
  updatedAt: string;
  transcriptExists: boolean;
  transcriptUpdatedAt: string | null;
  kind: string;
  playbackUrl: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatKind(kind: string) {
  if (kind === "room-recording") return "Room recording";
  if (kind === "peer-recording") return "Peer recording";
  return "Recording";
}

export function MeetingFilesModal({ meetingId }: { meetingId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.sessionId === selectedId) ?? files[0] ?? null,
    [files, selectedId]
  );

  async function loadFiles() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/recordings`, {
        credentials: "include"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load meeting files");
      }
      const nextFiles = Array.isArray(payload?.files) ? (payload.files as RecordingFile[]) : [];
      setFiles(nextFiles);
      setSelectedId(nextFiles[0]?.sessionId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load meeting files");
      setFiles([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    dialogRef.current?.showModal();
    void loadFiles();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = () => setError(null);
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="dr-button-outline px-2 py-1 text-[11px]"
      >
        Files
      </button>

      <dialog
        ref={dialogRef}
        className="backdrop:bg-slate-950/55 m-auto h-[min(86dvh,760px)] w-[min(96vw,1080px)] rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Meeting files</h3>
              <p className="text-sm text-slate-500">
                Browse and play the media files saved for this meeting.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadFiles()}
                className="dr-button-outline px-3 py-2 text-xs"
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="dr-button-outline px-3 py-2 text-xs"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px,1fr]">
            <div className="min-h-0 overflow-auto border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
              {error ? <p className="px-4 py-4 text-sm text-rose-700">{error}</p> : null}
              {!error && !loading && files.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">No media files found for this meeting.</p>
              ) : null}
              <div className="space-y-2 p-3">
                {files.map((file) => {
                  const active = selectedFile?.sessionId === file.sessionId;
                  return (
                    <button
                      key={file.sessionId}
                      type="button"
                      onClick={() => setSelectedId(file.sessionId)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-slate-900 bg-white shadow-sm"
                          : "border-slate-200 bg-white/85 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {formatKind(file.kind)}
                      </p>
                      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{file.filename}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatBytes(file.bytes)} · {new Date(file.updatedAt).toLocaleString()}
                      </p>
                      {file.transcriptExists ? (
                        <p className="mt-2 text-[11px] font-medium text-emerald-700">Transcript file available</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-4 lg:p-5">
              {selectedFile ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {formatKind(selectedFile.kind)}
                    </p>
                    <h4 className="mt-2 break-all text-lg font-semibold text-slate-900">
                      {selectedFile.filename}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatBytes(selectedFile.bytes)} · {new Date(selectedFile.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-950 p-3 shadow-inner">
                    <video
                      key={selectedFile.sessionId}
                      controls
                      preload="metadata"
                      className="max-h-[52dvh] w-full rounded-2xl bg-black"
                    >
                      <source src={selectedFile.playbackUrl} type="video/webm" />
                    </video>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Audio fallback
                    </p>
                    <audio key={`${selectedFile.sessionId}:audio`} controls preload="metadata" className="mt-3 w-full">
                      <source src={selectedFile.playbackUrl} type="audio/webm" />
                    </audio>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a file to preview it.</p>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
