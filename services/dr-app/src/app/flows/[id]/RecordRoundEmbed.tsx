"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  recordIndex?: number;
  endsAtMs: number;
  onComplete: (audio: Blob, recordIndex: number | null) => void;
  className?: string;
};

export function RecordRoundEmbed({
  recordIndex,
  endsAtMs,
  onComplete,
  className
}: Props) {
  const [level, setLevel] = useState(0);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const didCompleteRef = useRef(false);

  async function startCapture() {
    if (starting || started) return;
    setStarting(true);
    setStartError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (didCompleteRef.current) return;
        didCompleteRef.current = true;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onComplete(blob, recordIndex ?? null);
      };

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setLevel(Math.min(1, average / 140));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      recorder.start();
      setStarted(true);
    } catch (error) {
      setStartError("Tap to allow microphone access.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }, Math.max(0, endsAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAtMs, started]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/85 ${className ?? ""}`}
    >
      <div className="absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold uppercase text-white/80">
        Record {recordIndex ? recordIndex : ""}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-44 w-44 rounded-full border border-emerald-200/40 bg-emerald-200/10"
          style={{
            transform: `scale(${1 + level * 0.55})`,
            transition: "transform 120ms ease-out"
          }}
        />
      </div>
      {!started ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-6 py-5 text-center text-slate-100">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              Record
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Tap to start recording your voice.
            </p>
            {startError ? <p className="mt-2 text-xs text-rose-200">{startError}</p> : null}
            <button
              type="button"
              onClick={startCapture}
              className="mt-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-900"
              disabled={starting}
            >
              {starting ? "Starting..." : "Start recording"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
