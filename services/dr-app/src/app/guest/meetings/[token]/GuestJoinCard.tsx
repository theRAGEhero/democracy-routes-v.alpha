"use client";

import { useMemo, useState } from "react";
import { buildCallJoinUrl } from "@/lib/callUrl";

type Props = {
  active: boolean;
  baseUrl: string;
  roomId: string;
  language: string;
  provider: string;
  inviteEmail: string;
};

export function GuestJoinCard({ active, baseUrl, roomId, language, provider, inviteEmail }: Props) {
  const defaultName = useMemo(() => inviteEmail, [inviteEmail]);
  const [name, setName] = useState(defaultName);

  const transcriptionLanguage = provider === "deepgramlive" || provider === "deepgram" ? language : "";
  const joinUrl = buildCallJoinUrl({
    baseUrl,
    roomId,
    name: name || defaultName,
    autojoin: true,
    transcriptionLanguage
  });

  return (
    <div className="dr-card p-6">
      {active ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Join the call without registration.</p>
          <div>
            <label className="text-sm font-medium">Display name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
              placeholder="Your name"
            />
          </div>
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dr-button inline-flex px-4 py-2 text-sm"
          >
            Join on Democracy Routes
          </a>
        </div>
      ) : (
        <p className="text-sm text-slate-600">This meeting is no longer active.</p>
      )}
    </div>
  );
}
