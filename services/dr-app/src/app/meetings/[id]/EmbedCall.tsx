"use client";

import { useEffect, useState } from "react";
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
  const [showEmbed, setShowEmbed] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [showModal]);

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
          showModal ? "fixed inset-0 z-[10000] m-4 flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {showEmbed && isActive ? (
          <iframe
            title="Call"
            src={embedUrl}
            className={`w-full ${showModal ? "flex-1" : "h-[360px] sm:h-[520px]"}`}
            allow="camera; microphone; fullscreen"
          />
        ) : (
          <div
            className={`flex items-center justify-center text-sm text-slate-500 ${
              showModal ? "flex-1" : "h-[360px] sm:h-[520px]"
            }`}
          >
            {isActive ? "Call is hidden." : "Meeting is inactive or expired."}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/70 px-4 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Embedded call</span>
            <span className={isActive ? "text-emerald-600" : "text-slate-400"}>{statusLabel}</span>
            <span className="text-slate-700">
              {languageLabel} · {providerLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
      {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
    </div>
  );
}
