"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  embedUrl: string;
  isActive: boolean;
  hasBaseUrl: boolean;
  statusLabel: string;
  languageLabel: string;
  providerLabel: string;
  joinUrl: string;
  meetingId: string;
  canManage: boolean;
};

export function EmbedCall({
  embedUrl,
  isActive,
  hasBaseUrl,
  statusLabel,
  languageLabel,
  providerLabel,
  joinUrl,
  meetingId,
  canManage
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [showEmbed, setShowEmbed] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"audio" | "av">("av");
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<"auto" | "grid" | "speaker">("auto");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [immersiveEnabled, setImmersiveEnabled] = useState(false);
  const router = useRouter();
  const embedOrigin = useMemo(() => {
    try {
      return new URL(embedUrl, window.location.href).origin;
    } catch {
      return "*";
    }
  }, [embedUrl]);
  const joinCommandData = useMemo(() => {
    try {
      const url = new URL(embedUrl, window.location.href);
      const roomMatch = url.pathname.match(/\/meet\/([^/?#]+)/i);
      const roomId = roomMatch?.[1] ? decodeURIComponent(roomMatch[1]) : "";
      const name = String(url.searchParams.get("name") || "").trim();
      const autoRecordMode = url.searchParams.get("autorecordaudio")
        ? "audio"
        : url.searchParams.get("autorecordvideo")
          ? "av"
          : "";
      const transcriptionLanguage = String(url.searchParams.get("transcriptionLanguage") || "").trim();
      return { roomId, name, autoRecordMode, transcriptionLanguage };
    } catch {
      return { roomId: "", name: "", autoRecordMode: "", transcriptionLanguage: "" };
    }
  }, [embedUrl]);

  function sendBridgeCommand(command: string, data: Record<string, unknown> = {}) {
    if (!iframeRef.current?.contentWindow) return;
    const targetOrigin = embedOrigin === "*" ? "*" : embedOrigin;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "dr-video-command",
        command,
        data
      },
      targetOrigin
    );
  }

  useEffect(() => {
    if (showModal || (immersiveEnabled && callConnected && isActive)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [showModal, immersiveEnabled, callConnected, isActive]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (embedOrigin !== "*" && event.origin !== embedOrigin) return;
      const message = event.data;
      if (!message || typeof message !== "object" || message.source !== "dr-video") return;

      const payload = message.payload ?? {};
      switch (message.type) {
        case "ready":
          setBridgeReady(true);
          setBridgeError(null);
          break;
        case "connected":
          setCallConnected(Boolean(payload.connected));
          break;
        case "participants":
          setParticipantCount(Number(payload.count) || 0);
          break;
        case "recording-state":
          setRecordingActive(Boolean(payload.enabled));
          setRecordingMode(payload.mode === "audio" ? "audio" : "av");
          break;
        case "media-state":
          if (typeof payload.micEnabled === "boolean") setMicEnabled(payload.micEnabled);
          if (typeof payload.camEnabled === "boolean") setCamEnabled(payload.camEnabled);
          break;
        case "view-state":
          if (payload.mode === "auto" || payload.mode === "grid" || payload.mode === "speaker") {
            setViewMode(payload.mode);
          }
          break;
        case "join-error":
        case "command-error":
          setBridgeError(String(payload.message || "Bridge error"));
          break;
        case "left":
          setCallConnected(false);
          setRecordingActive(false);
          setParticipantCount(0);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedOrigin]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  if (!hasBaseUrl) {
    return (
      <p className="mt-3 text-sm text-amber-600">
        DEMOCRACYROUTES_CALL_BASE_URL is not configured.
      </p>
    );
  }

  async function handleDeactivate() {
    if (!canManage || !isActive) return;

    const confirmed = window.confirm("Deactivate this meeting?");
    if (!confirmed) return;

    setActionError(null);
    setDeactivating(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/deactivate`, {
        method: "POST"
      });
      if (!response.ok) {
        const payload = await response.json();
        setActionError(payload?.error ?? "Unable to deactivate meeting");
      } else {
        router.refresh();
      }
    } catch (error) {
      setActionError("Unable to deactivate meeting");
    } finally {
      setDeactivating(false);
    }
  }

  const immersiveActive = immersiveEnabled && callConnected && isActive && !showModal;

  return (
    <div>
      {showModal ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="absolute right-6 top-6 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
      ) : null}
      <div
        className={`overflow-hidden rounded-lg border border-slate-200 bg-white/80 ${
          showModal
            ? "fixed inset-0 z-[10000] m-4 flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col"
            : immersiveActive
              ? "fixed inset-0 z-[9000] flex h-[100dvh] w-screen flex-col rounded-none border-0 bg-black"
              : "flex h-[calc(100dvh-14rem)] min-h-[560px] flex-col"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {showEmbed && isActive ? (
          <iframe
            ref={iframeRef}
            title="Call"
            src={embedUrl}
            className="w-full flex-1"
            allow="camera; microphone; fullscreen"
          />
        ) : (
          <div
            className="flex flex-1 items-center justify-center text-sm text-slate-500"
          >
            {isActive ? "Call is hidden." : "Meeting is inactive or expired."}
          </div>
        )}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/70 px-4 py-2 text-sm ${
            immersiveActive ? "hidden" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Embedded call</span>
            <span className={isActive ? "text-emerald-600" : "text-slate-400"}>{statusLabel}</span>
            <span className="text-slate-700">
              {languageLabel} · {providerLabel}
            </span>
            <span className={bridgeReady ? "text-emerald-700" : "text-amber-700"}>
              {bridgeReady ? "Bridge ready" : "Bridge sync..."}
            </span>
            <span className="text-slate-700">{callConnected ? `Participants: ${participantCount}` : "Not connected"}</span>
            <span className={recordingActive ? "text-rose-700" : "text-slate-500"}>
              {recordingActive ? `Recording ${recordingMode === "audio" ? "audio" : "video+audio"}` : "Not recording"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => sendBridgeCommand("toggleMic")}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected}
            >
              {micEnabled ? "Mute mic" : "Unmute mic"}
            </button>
            <button
              type="button"
              onClick={() => sendBridgeCommand("toggleCam")}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected}
            >
              {camEnabled ? "Disable cam" : "Enable cam"}
            </button>
            <button
              type="button"
              onClick={() =>
                sendBridgeCommand("setView", {
                  mode: viewMode === "auto" ? "grid" : viewMode === "grid" ? "speaker" : "auto"
                })
              }
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected}
            >
              View: {viewMode}
            </button>
            <button
              type="button"
              onClick={() => sendBridgeCommand("startRecording", { mode: "av" })}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected || recordingActive}
            >
              Record video
            </button>
            <button
              type="button"
              onClick={() => sendBridgeCommand("startRecording", { mode: "audio" })}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected || recordingActive}
            >
              Record audio
            </button>
            <button
              type="button"
              onClick={() => sendBridgeCommand("stopRecording")}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || !callConnected || !recordingActive}
            >
              Stop recording
            </button>
            <button
              type="button"
              onClick={() => sendBridgeCommand("join", joinCommandData)}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed || callConnected}
            >
              Reconnect
            </button>
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center px-3 py-1 text-xs ${
                isActive ? "dr-button" : "rounded bg-slate-300 px-3 py-1 text-xs font-semibold text-white"
              }`}
              aria-disabled={!isActive}
            >
              Join call
            </a>
            {canManage ? (
              <button
                type="button"
                onClick={handleDeactivate}
                className="dr-button-outline px-3 py-1 text-xs"
                disabled={!isActive || deactivating}
              >
                {deactivating ? "Deactivating..." : "Deactivate"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowEmbed((prev) => !prev)}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive}
            >
              {showEmbed ? "Hide call" : "Show call here"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal((prev) => !prev)}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!isActive || !showEmbed}
            >
              {showModal ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
        </div>
      </div>
      {immersiveActive ? (
        <div className="pointer-events-none fixed right-3 top-3 z-[9100]">
          <button
            type="button"
            onClick={() => sendBridgeCommand("leave")}
            className="pointer-events-auto rounded-md bg-black/65 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Exit call
          </button>
          <button
            type="button"
            onClick={() => setImmersiveEnabled(false)}
            className="pointer-events-auto ml-2 rounded-md bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            Show page
          </button>
        </div>
      ) : callConnected && isActive ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setImmersiveEnabled(true)}
            className="dr-button-outline px-3 py-1 text-xs"
          >
            Immersive mode
          </button>
        </div>
      ) : null}
      {bridgeError ? <p className="mt-2 text-sm text-amber-700">{bridgeError}</p> : null}
      {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
    </div>
  );
}
