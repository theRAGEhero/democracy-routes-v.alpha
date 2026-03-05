"use client";

import { useEffect, useRef, useState } from "react";
import { getMeditationAnimationFile } from "@/lib/meditation";

type Props = {
  isOpen: boolean;
  meditationIndex: number;
  roundAfter: number | null;
  endsAtMs: number;
  animationId?: string | null;
  audioUrl?: string | null;
  onComplete: (audio: Blob, meditationIndex: number, roundAfter: number | null) => void;
};

export function MeditationRoundModal({
  isOpen,
  meditationIndex,
  roundAfter,
  endsAtMs,
  animationId,
  audioUrl,
  onComplete
}: Props) {
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) return;
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
      } catch (error) {
        onComplete(new Blob(), meditationIndex, roundAfter);
      }
    }

    start();

    return () => {
      mounted = false;
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
  }, [audioUrl, isOpen, onComplete]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [endsAtMs, isOpen]);

  if (!isOpen) return null;

  const animationFile = getMeditationAnimationFile(animationId);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
      <div className="relative h-[calc(100dvh-2rem)] w-[min(100%,1100px)] overflow-hidden rounded-3xl border border-slate-200 bg-black/80 shadow-[0_24px_60px_rgba(15,23,42,0.3)]">
        {animationFile ? (
          <iframe
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
      </div>
    </div>
  );
}
