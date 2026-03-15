"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type FeedbackProvider = "NONE" | "DEEPGRAM" | "VOSK";

export function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [provider, setProvider] = useState<FeedbackProvider>("NONE");
  const [providerLoading, setProviderLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const pagePath = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProviderLoading(true);
    fetch("/api/feedback/transcribe")
      .then((response) => response.json().catch(() => null).then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        if (!ok) {
          setProvider("NONE");
          return;
        }
        setProvider(payload?.provider === "DEEPGRAM" || payload?.provider === "VOSK" ? payload.provider : "NONE");
      })
      .catch(() => {
        if (!cancelled) setProvider("NONE");
      })
      .finally(() => {
        if (!cancelled) setProviderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function transcribeAudio(audioBlob: Blob) {
    setTranscribing(true);
    setTranscriptionError(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, `feedback-${Date.now()}.webm`);
      const response = await fetch("/api/feedback/transcribe", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to transcribe audio.");
      }
      const transcript = typeof payload?.transcript === "string" ? payload.transcript.trim() : "";
      if (!transcript) {
        throw new Error("No transcript text returned.");
      }
      setMessage((current) => {
        const prefix = current.trim();
        return prefix ? `${prefix}\n\n${transcript}` : transcript;
      });
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : "Unable to transcribe audio.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleMicToggle() {
    if (transcribing) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    setTranscriptionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(750);
      setRecording(true);
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : "Microphone access failed.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setStatus("idle");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, pagePath })
    });
    setSending(false);
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setStatus("sent");
    setMessage("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col-reverse items-end gap-2 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.15)] backdrop-blur hover:border-slate-300 hover:text-slate-900"
      >
        Leave feedback
      </button>
      {open ? (
        <div className="relative w-[min(96vw,28rem)] max-h-[78dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_30px_70px_rgba(15,23,42,0.2)] sm:w-[min(92vw,28rem)] sm:max-h-[70vh] sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Feedback</p>
              <p className="text-lg font-semibold text-slate-900">Share your thoughts</p>
            </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Page: {pagePath}</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleMicToggle}
                      disabled={provider === "NONE" || providerLoading || transcribing}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        recording
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                      aria-label={transcribing ? "Transcribing audio" : recording ? "Stop microphone" : "Start microphone dictation"}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Zm-7-4h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11Z" />
                      </svg>
                      <span>{transcribing ? "Transcribing..." : recording ? "Stop mic" : "Mic"}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="dr-input min-h-[140px] w-full rounded px-3 py-2 text-sm"
                  placeholder="What should we improve or fix?"
                  required
                />
              </div>
              {transcriptionError ? <p className="text-sm text-red-600">{transcriptionError}</p> : null}
              {status === "sent" ? (
                <p className="text-sm text-emerald-600">Thanks! Feedback sent.</p>
              ) : null}
              {status === "error" ? (
                <p className="text-sm text-red-600">Unable to send feedback.</p>
              ) : null}
              <div className="flex items-center justify-between">
                <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={sending}>
                  {sending ? "Sending..." : "Send feedback"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
        </div>
      ) : null}
    </div>
  );
}
