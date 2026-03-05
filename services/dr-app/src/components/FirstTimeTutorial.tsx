"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "drapp_tutorial_seen_v1";

function buildStorageKey(userId: string | null | undefined, email: string | null | undefined) {
  const id = String(userId || "").trim();
  if (id) return `${STORAGE_PREFIX}:${id}`;
  const mail = String(email || "").trim().toLowerCase();
  if (mail) return `${STORAGE_PREFIX}:email:${mail}`;
  return STORAGE_PREFIX;
}

export function FirstTimeTutorial() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const storageKey = useMemo(
    () => buildStorageKey(session?.user?.id ?? null, session?.user?.email ?? null),
    [session?.user?.id, session?.user?.email]
  );

  useEffect(() => {
    if (!session?.user) return;
    if (!pathname || pathname.startsWith("/tutorial")) return;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) {
      setVisible(true);
    }
  }, [pathname, session?.user, storageKey]);

  function markSeen() {
    window.localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Welcome to Democracy Routes
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Your first session starts here
            </h2>
          </div>
          <button
            type="button"
            onClick={markSeen}
            className="dr-button-outline px-3 py-2 text-xs"
          >
            Skip for now
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Dataspaces",
              text: "Create thematic spaces for communities, projects, or civic coalitions."
            },
            {
              title: "Templates",
              text: "Build repeatable agendas with timed rounds, prompts, and matching."
            },
            {
              title: "Meetings",
              text: "Launch live calls with transcription and shareable links."
            },
            {
              title: "Transcripts",
              text: "Capture dialogue in real time and keep a durable record."
            }
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/tutorial" className="dr-button px-4 py-2 text-sm" onClick={markSeen}>
            Open the full tutorial
          </Link>
          <Link href="/dataspace" className="dr-button-outline px-4 py-2 text-sm" onClick={markSeen}>
            Create a dataspace
          </Link>
          <Link href="/modular" className="dr-button-outline px-4 py-2 text-sm" onClick={markSeen}>
            Build a template
          </Link>
        </div>
      </div>
    </div>
  );
}

