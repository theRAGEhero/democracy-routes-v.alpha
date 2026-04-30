"use client";

import { useEffect, useState } from "react";

type Props = {
  enabled: boolean;
  snippet: string;
};

const CONSENT_COOKIE = "dr_analytics_consent";
const CONSENT_STORAGE_KEY = "dr_analytics_consent";
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

function getStoredConsent() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === "1" || stored === "0") return stored;
  } catch {}
  return null;
}

function setStoredConsent(value: "1" | "0") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {}
}

function injectSnippet(snippet: string) {
  if (typeof document === "undefined") return;
  if (!snippet.trim()) return;
  if (document.getElementById("dr-analytics-snippet")) return;

  const marker = document.createElement("meta");
  marker.id = "dr-analytics-snippet";
  marker.setAttribute("data-injected", "true");
  document.head.appendChild(marker);

  const hasScriptTags = /<script[\s>]/i.test(snippet);
  if (!hasScriptTags) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = snippet;
    document.head.appendChild(script);
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = snippet;
  const scripts = Array.from(template.content.querySelectorAll("script"));
  if (scripts.length === 0) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = snippet;
    document.head.appendChild(script);
    return;
  }

  scripts.forEach((sourceScript, index) => {
    const script = document.createElement("script");
    script.type = sourceScript.type || "text/javascript";
    if (sourceScript.src) {
      script.src = sourceScript.src;
      script.async = sourceScript.async;
      script.defer = sourceScript.defer;
      script.crossOrigin = sourceScript.crossOrigin || "";
      if (sourceScript.referrerPolicy) {
        script.referrerPolicy = sourceScript.referrerPolicy;
      }
    } else {
      script.text = sourceScript.textContent || "";
    }
    script.id = `dr-analytics-snippet-script-${index}`;
    document.head.appendChild(script);
  });
}

export function AnalyticsConsent({ enabled, snippet }: Props) {
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!enabled) {
      setConsent(null);
      return;
    }

    const value = getCookie(CONSENT_COOKIE) ?? getStoredConsent();
    setConsent(value);
    if (value === "1") {
      injectSnippet(snippet);
    }
  }, [enabled, snippet]);

  if (!enabled) return null;
  if (!mounted) return null;
  if (consent === "1" || consent === "0") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100000] px-3 pb-3 sm:px-4 sm:pb-4">
      <div
        className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-[24px] border border-slate-300 bg-white p-4 text-sm text-slate-700 shadow-[0_28px_70px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
        role="dialog"
        aria-label="Analytics consent"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Analytics cookies
          </p>
          <p>
            We use analytics cookies to understand usage. Read our{" "}
            <a href="/privacy" className="font-semibold underline">
              privacy policy
            </a>{" "}
            and{" "}
            <a href="/cookies" className="font-semibold underline">
              cookie policy
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="dr-button-outline px-4 py-2 text-xs"
            onClick={() => {
              setCookie(CONSENT_COOKIE, "0");
              setStoredConsent("0");
              setConsent("0");
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className="dr-button px-4 py-2 text-xs"
            onClick={() => {
              setCookie(CONSENT_COOKIE, "1");
              setStoredConsent("1");
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
