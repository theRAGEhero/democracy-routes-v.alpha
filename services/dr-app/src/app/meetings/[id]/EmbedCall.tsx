"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CallFrame } from "@/components/CallFrame";
import { MeetingActions } from "@/app/meetings/[id]/MeetingActions";
import { MeetingFilesModal } from "@/app/meetings/[id]/MeetingFilesModal";

type Props = {
  embedUrl: string;
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
  joinUrl: string;
  meetingId: string;
  canManage: boolean;
  canInvite: boolean;
  sidePanelVisible: boolean;
  sidePanelLabel: string;
  sidePanelToggleDisabled?: boolean;
  onToggleSidePanel: () => void;
};

export function EmbedCall({
  embedUrl,
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
  joinUrl,
  meetingId,
  canManage,
  canInvite,
  sidePanelVisible,
  sidePanelLabel,
  sidePanelToggleDisabled = false,
  onToggleSidePanel
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

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

  async function handleFullscreen() {
    const container = containerRef.current;
    const iframe = iframeRef.current;
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

    const target = iframe ?? container;
    if (!target) return;

    const requestFullscreen =
      (target as HTMLElement).requestFullscreen?.bind(target) ??
      (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void })
        .webkitRequestFullscreen?.bind(target);

    if (requestFullscreen) {
      await requestFullscreen();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className="flex h-full min-h-0 flex-1 flex-col overflow-visible rounded-2xl border border-slate-200 bg-white/80"
        onClick={(event) => event.stopPropagation()}
      >
        {isActive ? (
          <CallFrame
            src={embedUrl}
            title="Call"
            className="w-full flex-1 min-h-0"
            frameClassName="h-full w-full"
            allow="camera; microphone; fullscreen"
            iframeRef={iframeRef}
          />
        ) : (
          <div
            className="flex flex-1 items-center justify-center text-sm text-slate-500"
          >
            {isActive ? "Call is hidden." : "Meeting is inactive or expired."}
          </div>
        )}
        <div className="relative z-20 flex flex-wrap items-center gap-2 overflow-visible border-t border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-slate-500">Expires</span>
              <span className="text-slate-700">{expiresLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-slate-500">Starts</span>
              <span className="text-slate-700">{startsLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-slate-500">Host</span>
              {hostHref ? (
                <Link href={hostHref} className="text-slate-700 hover:underline">
                  {hostLabel}
                </Link>
              ) : (
                <span className="text-slate-700">{hostLabel}</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-slate-500">Room</span>
              <span className="text-slate-700">{roomLabel}</span>
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <MeetingActions meetingId={meetingId} canInvite={canInvite} isActive={isActive} variant="inline" />
            {canManage ? (
              <button
                type="button"
                onClick={handleDeactivate}
                className="dr-button-outline px-2 py-1 text-[11px]"
                disabled={!isActive || deactivating}
              >
                {deactivating ? "Deactivating..." : "Deactivate"}
              </button>
            ) : null}
            <MeetingFilesModal meetingId={meetingId} />
            <button
              type="button"
              onClick={onToggleSidePanel}
              className="dr-button-outline px-2 py-1 text-[11px]"
              disabled={sidePanelToggleDisabled}
            >
              {sidePanelVisible ? `Hide ${sidePanelLabel}` : `Show ${sidePanelLabel}`}
            </button>
            <button
              type="button"
              onClick={handleFullscreen}
              className="dr-button-outline px-2 py-1 text-[11px]"
              disabled={!isActive}
            >
              Fullscreen
            </button>
          </div>
        </div>
      </div>
      {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
    </div>
  );
}
