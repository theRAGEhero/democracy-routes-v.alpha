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
  provider?: string;
  status?: string;
  contentType?: string;
  error?: string | null;
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
  if (kind === "uploaded-media") return "Uploaded media";
  return "Recording";
}

export function MeetingFilesModal({ meetingId }: { meetingId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProvider, setUploadProvider] = useState("DEEPGRAM");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.sessionId === selectedId) ?? files[0] ?? null,
    [files, selectedId]
  );
  const transcriptAvailable = useMemo(() => files.some((file) => file.transcriptExists), [files]);

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

  async function handleUpload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadMessage(null);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("provider", uploadProvider);
      const response = await fetch(`/api/meetings/${meetingId}/media-upload`, {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to upload media");
      }
      setUploadMessage("Media uploaded and queued for transcription.");
      setUploadFile(null);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload media");
    } finally {
      setUploading(false);
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
        className="dr-button-outline inline-flex items-center gap-1.5 px-2 py-1 text-[11px]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.75 5.75A1.75 1.75 0 0 1 4.5 4h3.1c.48 0 .94.19 1.27.53l1.1 1.1c.33.34.79.53 1.27.53h4.26a1.75 1.75 0 0 1 1.75 1.75v6.59A1.75 1.75 0 0 1 15.5 16.25h-11A1.75 1.75 0 0 1 2.75 14.5z" />
          <path d="M2.75 8h14.5" />
        </svg>
        <span>Files</span>
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
              <p className="mt-1 text-xs text-slate-400">
                You can also upload external media and run it through the same meeting transcript and summary pipeline.
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
              <div className="border-b border-slate-200 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Import external media
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm,audio/*,video/*"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  />
                  <select
                    value={uploadProvider}
                    onChange={(event) => setUploadProvider(event.target.value)}
                    className="dr-input w-full rounded px-3 py-2 text-xs"
                  >
                    <option value="DEEPGRAM">Deepgram modular</option>
                    <option value="VOSK">Vosk modular</option>
                    <option value="WHISPERREMOTE">Whisper remote</option>
                    <option value="AUTOREMOTE">Auto remote</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleUpload()}
                    className="dr-button w-full px-3 py-2 text-xs"
                    disabled={!uploadFile || uploading}
                  >
                    {uploading ? "Uploading..." : "Upload and transcribe"}
                  </button>
                  {uploadMessage ? <p className="text-[11px] text-emerald-700">{uploadMessage}</p> : null}
                  <p className="text-[11px] text-slate-500">
                    The latest completed upload becomes the meeting transcript used by exports, AI summary, and downstream analysis.
                  </p>
                </div>
              </div>
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
                      {file.provider || file.status ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          {[file.provider, file.status].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {file.transcriptExists ? (
                        <p className="mt-2 text-[11px] font-medium text-emerald-700">Transcript file available</p>
                      ) : null}
                      {file.error ? (
                        <p className="mt-2 text-[11px] font-medium text-rose-700">{file.error}</p>
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
                    {(selectedFile.contentType || "").startsWith("audio/") ? (
                      <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-black/70 px-4 py-8">
                        <audio key={selectedFile.sessionId} controls preload="metadata" className="w-full max-w-xl">
                          <source src={selectedFile.playbackUrl} type={selectedFile.contentType || "audio/webm"} />
                        </audio>
                      </div>
                    ) : (
                      <video
                        key={selectedFile.sessionId}
                        controls
                        preload="metadata"
                        className="max-h-[52dvh] w-full rounded-2xl bg-black"
                      >
                        <source src={selectedFile.playbackUrl} type={selectedFile.contentType || "video/webm"} />
                      </video>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Audio fallback
                    </p>
                    <audio key={`${selectedFile.sessionId}:audio`} controls preload="metadata" className="mt-3 w-full">
                      <source src={selectedFile.playbackUrl} type="audio/webm" />
                    </audio>
                  </div>

                  {transcriptAvailable ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Transcript exports
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Download the meeting transcript as readable text, platform JSON, or ontology-style JSON.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`/api/meetings/${meetingId}/transcript/export?format=txt`}
                          className="dr-button-outline px-3 py-2 text-xs"
                        >
                          Download .txt
                        </a>
                        <a
                          href={`/api/meetings/${meetingId}/transcript/export?format=json`}
                          className="dr-button-outline px-3 py-2 text-xs"
                        >
                          Download .json
                        </a>
                        <a
                          href={`/api/meetings/${meetingId}/transcript/export?format=ontology`}
                          className="dr-button-outline px-3 py-2 text-xs"
                        >
                          Download ontology JSON
                        </a>
                      </div>
                    </div>
                  ) : null}
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
