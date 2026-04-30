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
  onToggleFullscreen: () => void | Promise<void>;
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
  onToggleFullscreen
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const infoDialogRef = useRef<HTMLDialogElement | null>(null);
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

  function openInfoModal() {
    infoDialogRef.current?.showModal();
  }

  function closeInfoModal() {
    infoDialogRef.current?.close();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-visible rounded-2xl border border-slate-200 bg-white/80"
        onClick={(event) => event.stopPropagation()}
      >
        {isActive ? (
          <div className="relative min-h-[48dvh] w-full flex-1 sm:min-h-[56dvh] lg:min-h-0">
            <CallFrame
              src={embedUrl}
              title="Call"
              className="w-full h-full min-h-0"
              frameClassName="h-full w-full"
              allow="camera; microphone; fullscreen"
              iframeRef={iframeRef}
            />
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-900"
              disabled={!isActive}
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
                <path d="M7 3H3v4" />
                <path d="M13 3h4v4" />
                <path d="M17 13v4h-4" />
                <path d="M3 13v4h4" />
              </svg>
              <span>Fullscreen</span>
            </button>
          </div>
        ) : (
          <div
            className="flex flex-1 items-center justify-center text-sm text-slate-500"
          >
            {isActive ? "Call is hidden." : "Meeting is inactive or expired."}
          </div>
        )}
        <div className="relative z-20 grid gap-1.5 overflow-visible border-t border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 lg:overflow-visible">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
              {statusLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
              {languageLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
              {providerLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
            <button
              type="button"
              onClick={openInfoModal}
              className="dr-button-outline inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] sm:px-2 sm:py-1"
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
                <circle cx="10" cy="10" r="7" />
                <path d="M10 8v4" />
                <circle cx="10" cy="6" r=".8" fill="currentColor" stroke="none" />
              </svg>
              <span>Info</span>
            </button>
            <MeetingActions meetingId={meetingId} canInvite={canInvite} isActive={isActive} variant="inline" />
            <Link
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="dr-button-outline inline-flex items-center justify-center px-2 py-1.5 text-[11px] sm:py-1"
            >
              Open Full Room
            </Link>
            {canManage ? (
              <button
                type="button"
                onClick={handleDeactivate}
                className={`inline-flex items-center justify-center px-2 py-1.5 text-[11px] sm:py-1 ${
                  isActive
                    ? "rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
                    : "rounded-full border border-rose-200 bg-rose-50 font-semibold text-rose-700"
                }`}
                disabled={!isActive || deactivating}
              >
                {deactivating ? "Deactivating..." : isActive ? "Deactivate" : "Deactivated"}
              </button>
            ) : null}
            <MeetingFilesModal meetingId={meetingId} />
          </div>
        </div>
      </div>
      <dialog
        ref={infoDialogRef}
        className="backdrop:bg-slate-950/55 m-auto w-[min(92vw,720px)] rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
      >
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Meeting info</h3>
              <p className="mt-1 text-sm text-slate-500">
                Core details, access path, and transcription setup for this meeting.
              </p>
            </div>
            <button
              type="button"
              onClick={closeInfoModal}
              className="dr-button-outline px-3 py-2 text-xs"
            >
              Close
            </button>
          </div>

          <div className="grid gap-5 px-5 py-5 md:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Session status
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{statusLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Language
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{languageLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Starts
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{startsLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Expires
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{expiresLabel}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Hosting and room
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Host
                    </p>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {hostHref ? (
                        <Link href={hostHref} className="hover:underline">
                          {hostLabel}
                        </Link>
                      ) : (
                        hostLabel
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Room
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-slate-900">{roomLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Transcription
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Provider
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{providerLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Meeting ID
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-slate-900">{meetingId}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Useful actions
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href={joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dr-button-outline px-3 py-2 text-xs"
                  >
                    Open full room
                  </Link>
                  <button
                    type="button"
                    onClick={closeInfoModal}
                    className="dr-button-outline px-3 py-2 text-xs"
                  >
                    Back to call
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </dialog>
      {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
    </div>
  );
}
