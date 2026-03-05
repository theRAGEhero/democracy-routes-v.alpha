"use client";

import { useEffect, useState } from "react";
import { EmbedCall } from "@/app/meetings/[id]/EmbedCall";
import { LiveTranscriptPanel } from "@/app/meetings/[id]/LiveTranscriptPanel";

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
  roomLabel: string;
  meetingId: string;
  canManage: boolean;
  canInvite: boolean;
  liveTranscriptionEnabled: boolean;
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
  roomLabel,
  meetingId,
  canManage,
  canInvite,
  liveTranscriptionEnabled
}: Props) {
  const [transcriptVisible, setTranscriptVisible] = useState(true);

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

  return (
    <div className="flex h-full flex-1 flex-col gap-4 min-h-0 overflow-hidden lg:flex-row">
      <div className="order-1 flex-1 min-h-0 overflow-hidden">
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
          roomLabel={roomLabel}
          joinUrl={joinUrl}
          meetingId={meetingId}
          canManage={canManage}
          canInvite={canInvite}
          transcriptVisible={transcriptVisible}
          onToggleTranscript={() => setTranscriptVisible((prev) => !prev)}
        />
      </div>
      <div className="order-2 min-h-0 overflow-hidden lg:order-2 lg:w-80 xl:w-96">
        <LiveTranscriptPanel
          meetingId={meetingId}
          enabled={liveTranscriptionEnabled}
          visible={transcriptVisible}
        />
      </div>
    </div>
  );
}
