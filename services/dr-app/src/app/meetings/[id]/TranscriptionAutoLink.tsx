"use client";

import { useEffect, useState } from "react";
import { TranscriptionPanel } from "@/app/meetings/[id]/TranscriptionPanel";

type Props = {
  meetingId: string;
  canManage: boolean;
  initialRoundId?: string | null;
};

export function TranscriptionAutoLink({ meetingId, canManage, initialRoundId }: Props) {
  const [roundId, setRoundId] = useState(initialRoundId ?? "");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (roundId || attempted) return;
    setAttempted(true);

    const run = async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/transcription?auto=1`);
        if (!response.ok) return;
        const payload = await response.json();
        if (payload?.roundId) {
          setRoundId(payload.roundId);
        }
      } catch (error) {
        // silently ignore
      }
    };

    run();
  }, [attempted, meetingId, roundId]);

  if (!roundId) {
    return null;
  }

  return <TranscriptionPanel meetingId={meetingId} canManage={canManage} initialRoundId={roundId} />;
}
