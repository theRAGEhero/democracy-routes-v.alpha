"use client";

import { useEffect, useRef, useState } from "react";
import { getMeditationAnimationFile } from "@/lib/meditation";

type Props = {
  meditationIndex: number;
  roundAfter: number | null;
  endsAtMs: number;
  animationId?: string | null;
  audioUrl?: string | null;
  isMuted?: boolean;
  onComplete: (audio: Blob, meditationIndex: number, roundAfter: number | null) => void;
  className?: string;
};

export function MeditationRoundEmbed({
  meditationIndex,
  roundAfter,
  endsAtMs,
  animationId,
  audioUrl,
  isMuted = false,
  onComplete,
  className
}: Props) {
  const [level, setLevel] = useState(0);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
        onComplete(blob, meditationIndex, roundAfter);
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

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.loop = true;
        audioRef.current = audio;
        await audio.play().catch(() => null);
      }

      setStarted(true);
    } catch (error) {
      setStartError("Tap to allow microphone and audio.");
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }, Math.max(0, endsAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAtMs, started]);

  useEffect(() => {
    if (!started || !iframeRef.current) return;
    iframeRef.current.contentWindow?.postMessage(
      { type: "meditation-mic", level },
      "*"
    );
  }, [level, started]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isMuted;
  }, [isMuted]);

  const animationFile = getMeditationAnimationFile(animationId);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/80 ${className ?? ""}`}
    >
      {animationFile ? (
        <iframe
          ref={iframeRef}
          title="Pause animation"
          src={animationFile}
          className="h-full w-full"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-200">
          Pause
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-40 w-40 rounded-full border border-white/40 bg-white/10"
          style={{
            transform: `scale(${1 + level * 0.5})`,
            transition: "transform 120ms ease-out"
          }}
        />
      </div>
      <div className="absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold uppercase text-white/80">
        Pause {meditationIndex}
      </div>
      {!started ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-6 py-5 text-center text-slate-100">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              Pause
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Tap to start audio and microphone.
            </p>
            {startError ? <p className="mt-2 text-xs text-rose-200">{startError}</p> : null}
            <button
              type="button"
              onClick={startCapture}
              className="mt-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-900"
              disabled={starting}
            >
              {starting ? "Starting..." : "Start meditation"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
