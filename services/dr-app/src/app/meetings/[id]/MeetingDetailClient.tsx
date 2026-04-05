"use client";

import { useEffect, useState } from "react";
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
  const sidePanelVisible = liveTranscriptionEnabled ? liveTranscriptVisible : postCallPanelExpanded;
  const transcriptPanelOpen = liveTranscriptionEnabled
    ? finalizedPanelAvailable || livePanelAvailable
      ? liveTranscriptVisible
      : false
    : finalizedPanelAvailable && postCallPanelExpanded;
  const sidePanelLabel = livePanelAvailable ? "transcript" : "transcription";
  const sidePanelToggleDisabled = liveTranscriptionEnabled
    ? !livePanelAvailable && !finalizedPanelAvailable
    : !finalizedPanelAvailable;

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setLiveTranscriptVisible(false);
    }
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

  return (
    <div className="flex h-full flex-1 min-h-0 flex-col gap-2 overflow-hidden">
      <div
        className={`relative flex min-h-0 flex-1 overflow-hidden ${
          transcriptPanelOpen ? "lg:flex-row" : "flex-col"
        }`}
      >
        <div
          className={`order-1 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden ${
            transcriptPanelOpen ? "lg:pr-4" : ""
          }`}
        >
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
          sidePanelVisible={sidePanelVisible}
          sidePanelLabel={sidePanelLabel}
          sidePanelToggleDisabled={sidePanelToggleDisabled}
          onToggleSidePanel={handleToggleSidePanel}
        />
        </div>

        {transcriptPanelOpen ? (
          <>
            <div className="order-2 hidden min-h-0 lg:block lg:w-[360px] xl:w-[400px] 2xl:w-[440px]">
              {livePanelAvailable ? (
                <LiveTranscriptPanel
                  meetingId={meetingId}
                  enabled={liveTranscriptionEnabled}
                  visible={liveTranscriptVisible}
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
                  onActivityChange={liveTranscriptionEnabled ? undefined : setPostCallPanelAvailable}
                />
              )}
            </div>
            <div className="order-3 min-h-0 lg:hidden">
              {livePanelAvailable ? (
                <LiveTranscriptPanel
                  meetingId={meetingId}
                  enabled={liveTranscriptionEnabled}
                  visible={liveTranscriptVisible}
                  className="max-h-[36dvh]"
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
                  className="max-h-[36dvh]"
                  onActivityChange={liveTranscriptionEnabled ? undefined : setPostCallPanelAvailable}
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
