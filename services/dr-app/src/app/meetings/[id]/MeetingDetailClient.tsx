"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbedCall } from "@/app/meetings/[id]/EmbedCall";
import { LiveTranscriptPanel } from "@/app/meetings/[id]/LiveTranscriptPanel";
import { TranscriptionPanel } from "@/app/meetings/[id]/TranscriptionPanel";

type Props = {
  embedUrl: string;
  joinUrl: string;
  isActive: boolean;
  hasBaseUrl: boolean;
  statusLabel: string;
  languageLabel: string;
  transcriptionProvider: string;
  providerLabel: string;
  startsLabel: string;
  expiresLabel: string;
  hostLabel: string;
  hostHref?: string | null;
  roomLabel: string;
  meetingId: string;
  canManage: boolean;
  canInvite: boolean;
  liveTranscriptionEnabled: boolean;
  postCallTranscriptEnabled: boolean;
  initialRoundId?: string | null;
};

export function MeetingDetailClient({
  embedUrl,
  joinUrl,
  isActive,
  hasBaseUrl,
  statusLabel,
  languageLabel,
  transcriptionProvider,
  providerLabel,
  startsLabel,
  expiresLabel,
  hostLabel,
  hostHref,
  roomLabel,
  meetingId,
  canManage,
  canInvite,
  liveTranscriptionEnabled,
  postCallTranscriptEnabled,
  initialRoundId
}: Props) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [liveTranscriptVisible, setLiveTranscriptVisible] = useState(true);
  const [transcriptRefreshKey, setTranscriptRefreshKey] = useState(0);
  const [postCallPanelAvailable, setPostCallPanelAvailable] = useState(false);
  const [postCallPanelExpanded, setPostCallPanelExpanded] = useState(false);
  const [postCallPanelTouched, setPostCallPanelTouched] = useState(false);
  const router = useRouter();
  const livePanelAvailable = liveTranscriptionEnabled && isActive;
  const finalizedPanelAvailable =
    (liveTranscriptionEnabled && !isActive) ||
    (postCallTranscriptEnabled && postCallPanelAvailable);
  const transcriptPrimaryMode = !isActive && finalizedPanelAvailable;
  const transcriptSurfaceAvailable = liveTranscriptionEnabled
    ? livePanelAvailable || finalizedPanelAvailable
    : finalizedPanelAvailable;
  const transcriptPanelOpen = liveTranscriptionEnabled
    ? transcriptPrimaryMode || finalizedPanelAvailable || livePanelAvailable
      ? liveTranscriptVisible
      : false
    : transcriptPrimaryMode || (finalizedPanelAvailable && postCallPanelExpanded);

  useEffect(() => {
    const header = document.querySelector("header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--app-header-h", `${headerHeight}px`);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; meetingId?: string };
      if (data?.type === "dr-video:exit-fullscreen" && data.meetingId === meetingId) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void> | void;
          webkitFullscreenElement?: Element | null;
        };
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          }
        }
        return;
      }
      if (data?.type === "dr-video:leave" && data.meetingId === meetingId) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void> | void;
          webkitFullscreenElement?: Element | null;
        };
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          }
        }
        setTranscriptRefreshKey((prev) => prev + 1);
        router.replace(`/meetings/${meetingId}`);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [meetingId, router]);

  useEffect(() => {
    if (!postCallTranscriptEnabled || liveTranscriptionEnabled || postCallPanelAvailable) return;

    let cancelled = false;

    async function checkPostCallState() {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/transcription?auto=1`, {
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        const stage = payload?.status?.stage;
        if (stage && stage !== "waiting_for_call_end" && stage !== "idle") {
          setPostCallPanelAvailable(true);
        }
      } catch {
        // ignore transient polling errors
      }
    }

    checkPostCallState().catch(() => null);
    const interval = window.setInterval(() => {
      checkPostCallState().catch(() => null);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [meetingId, postCallPanelAvailable, postCallTranscriptEnabled, liveTranscriptionEnabled]);

  useEffect(() => {
    if (liveTranscriptionEnabled || !postCallTranscriptEnabled) return;
    if (!postCallPanelTouched) {
      setPostCallPanelExpanded(false);
    }
  }, [liveTranscriptionEnabled, postCallPanelAvailable, postCallPanelTouched, postCallTranscriptEnabled]);

  function handleToggleSidePanel() {
    if (liveTranscriptionEnabled) {
      setLiveTranscriptVisible((prev) => !prev);
      return;
    }
    if (!postCallPanelAvailable) return;
    setPostCallPanelTouched(true);
    setPostCallPanelExpanded((prev) => !prev);
  }

  async function handleToggleFullscreen() {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      return;
    }

    const target = workspaceRef.current;
    if (!target) return;

    const requestFullscreen =
      target.requestFullscreen?.bind(target) ??
      (target as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
        .webkitRequestFullscreen?.bind(target);

    if (requestFullscreen) {
      await requestFullscreen();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={workspaceRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          transcriptPrimaryMode
            ? "flex flex-col"
            : transcriptPanelOpen
              ? "flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-2 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]"
              : "flex flex-col gap-2"
        }`}
      >
        {!transcriptPrimaryMode ? (
          <div className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden">
            <EmbedCall
              embedUrl={embedUrl}
              isActive={isActive}
              hasBaseUrl={hasBaseUrl}
              statusLabel={statusLabel}
              languageLabel={languageLabel}
              providerLabel={providerLabel}
              startsLabel={startsLabel}
              expiresLabel={expiresLabel}
              hostLabel={hostLabel}
              hostHref={hostHref}
              roomLabel={roomLabel}
              joinUrl={joinUrl}
              meetingId={meetingId}
              canManage={canManage}
              canInvite={canInvite}
              onToggleFullscreen={handleToggleFullscreen}
            />
          </div>
        ) : null}

        {transcriptPanelOpen ? (
          transcriptPrimaryMode ? (
            <div className="order-1 min-h-0 flex-1 overflow-hidden">
              <TranscriptionPanel
                key={`full-${transcriptRefreshKey}`}
                meetingId={meetingId}
                canManage={canManage}
                initialRoundId={initialRoundId ?? null}
                variant="sidebar"
                autoRefresh
                title={liveTranscriptionEnabled ? "Meeting transcription" : "Post-call transcription"}
                subtitle={
                  liveTranscriptionEnabled ? `${providerLabel} · Finalized transcript` : `${providerLabel} · After call`
                }
                className="h-full"
                onActivityChange={liveTranscriptionEnabled ? undefined : setPostCallPanelAvailable}
                expanded
              />
            </div>
          ) : (
          <>
            <div className="order-2 hidden min-h-0 overflow-hidden lg:block">
              {livePanelAvailable ? (
                <LiveTranscriptPanel
                  meetingId={meetingId}
                  provider={transcriptionProvider}
                  enabled={liveTranscriptionEnabled}
                  visible={liveTranscriptVisible}
                  expanded={liveTranscriptVisible}
                  onToggleExpanded={handleToggleSidePanel}
                  className="h-full"
                />
              ) : (
                <TranscriptionPanel
                  key={`sidebar-${transcriptRefreshKey}`}
                  meetingId={meetingId}
                  canManage={canManage}
                  initialRoundId={initialRoundId ?? null}
                  variant="sidebar"
                  autoRefresh
                  title={liveTranscriptionEnabled ? "Meeting transcription" : "Post-call transcription"}
                  subtitle={
                    liveTranscriptionEnabled ? `${providerLabel} · Finalized transcript` : `${providerLabel} · After call`
                  }
                  className="h-full"
                  onActivityChange={liveTranscriptionEnabled ? undefined : setPostCallPanelAvailable}
                  expanded={postCallPanelExpanded}
                  onToggleExpanded={handleToggleSidePanel}
                />
              )}
            </div>
            <div className="order-3 min-h-0 shrink-0 lg:hidden">
              {livePanelAvailable ? (
                <LiveTranscriptPanel
                  meetingId={meetingId}
                  provider={transcriptionProvider}
                  enabled={liveTranscriptionEnabled}
                  visible={liveTranscriptVisible}
                  expanded={liveTranscriptVisible}
                  onToggleExpanded={handleToggleSidePanel}
                  className="min-h-[280px] max-h-[48dvh] rounded-t-[24px] shadow-[0_-18px_40px_rgba(15,23,42,0.08)]"
                />
              ) : (
                <TranscriptionPanel
                  key={`mobile-sidebar-${transcriptRefreshKey}`}
                  meetingId={meetingId}
                  canManage={canManage}
                  initialRoundId={initialRoundId ?? null}
                  variant="sidebar"
                  autoRefresh
                  title={liveTranscriptionEnabled ? "Meeting transcription" : "Post-call transcription"}
                  subtitle={
                    liveTranscriptionEnabled ? `${providerLabel} · Finalized transcript` : `${providerLabel} · After call`
                  }
                  className="min-h-[280px] max-h-[48dvh] rounded-t-[24px] shadow-[0_-18px_40px_rgba(15,23,42,0.08)]"
                  onActivityChange={liveTranscriptionEnabled ? undefined : setPostCallPanelAvailable}
                  expanded={postCallPanelExpanded}
                  onToggleExpanded={handleToggleSidePanel}
                />
              )}
            </div>
          </>
          )
        ) : transcriptSurfaceAvailable && !transcriptPrimaryMode ? (
          <>
            <div className="pointer-events-none absolute right-0 top-0 z-20 hidden lg:block">
              <button
                type="button"
                onClick={handleToggleSidePanel}
                className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                <div className="text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {liveTranscriptionEnabled ? "Transcript" : "Transcription"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Open the side panel
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                  Open
                </span>
              </button>
            </div>
            <div className="order-2 shrink-0 lg:hidden">
              <button
                type="button"
                onClick={handleToggleSidePanel}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left shadow-sm"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {liveTranscriptionEnabled ? "Transcript" : "Transcription"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Open the right-side panel to follow the transcript and AI activity.
                  </p>
                </div>
                <span className="dr-button-outline px-3 py-1.5 text-[11px]">Open</span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
