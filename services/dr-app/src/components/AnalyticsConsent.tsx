"use client";

import { useEffect, useState } from "react";

type Props = {
  enabled: boolean;
  snippet: string;
};

const CONSENT_COOKIE = "dr_analytics_consent";
const MAX_AGE = 60 * 60 * 24 * 180;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`;
}

function injectSnippet(snippet: string) {
  if (typeof document === "undefined") return;
  if (!snippet.trim()) return;
  if (document.getElementById("dr-analytics-snippet")) return;
  const script = document.createElement("script");
  script.id = "dr-analytics-snippet";
  script.type = "text/javascript";
  script.text = snippet;
  document.head.appendChild(script);
}

export function AnalyticsConsent({ enabled, snippet }: Props) {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const value = getCookie(CONSENT_COOKIE);
    setConsent(value);
    if (value === "1") {
      injectSnippet(snippet);
    }
  }, [enabled, snippet]);

  if (!enabled) return null;
  if (consent === "1" || consent === "0") return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          We use analytics cookies to understand usage. You can accept or reject.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="dr-button-outline px-3 py-1 text-xs"
            onClick={() => {
              setCookie(CONSENT_COOKIE, "0");
              setConsent("0");
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className="dr-button px-3 py-1 text-xs"
            onClick={() => {
              setCookie(CONSENT_COOKIE, "1");
              setConsent("1");
              injectSnippet(snippet);
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
