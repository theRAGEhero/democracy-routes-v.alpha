"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";

type ReelProblem = {
  id: string;
  title: string;
  description: string;
  status: string;
  dataspaceName: string | null;
  dataspaceColor: string | null;
  creatorEmail: string;
};

type ReelItem = {
  id: string;
  type: "summary" | "placeholder";
  problemId: string;
  problem: ReelProblem;
  headline: string;
  subheadline: string | null;
  body: string;
  meetingId: string | null;
  language: string | null;
  transcriptionProviderLabel: string | null;
  scheduledLabel: string | null;
  updatedLabel: string | null;
  statusLabel: string;
  statusTone: "live" | "ready" | "waiting";
};

function toneClasses(tone: ReelItem["statusTone"]) {
  if (tone === "live") return "bg-emerald-100 text-emerald-800";
  if (tone === "waiting") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function BoxFeedClient({ items }: { items: ReelItem[] }) {
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const problemJumpMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (!map.has(item.problemId)) {
        map.set(item.problemId, item.id);
      }
    }
    return map;
  }, [items]);

  const uniqueProblems = useMemo(() => {
    const seen = new Set<string>();
    return items
      .map((item) => item.problem)
      .filter((problem) => {
        if (seen.has(problem.id)) return false;
        seen.add(problem.id);
        return true;
      });
  }, [items]);

  const scrollToProblem = (problemId: string) => {
    const targetId = problemJumpMap.get(problemId);
    if (!targetId) return;
    cardRefs.current[targetId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (items.length === 0) {
    return (
      <div className="space-y-5">
        <section className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/96 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Box
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            Scan open-problem updates like a reel feed.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
            Follow or create open problems first. Finished meeting summaries and problem cards will then appear here as a vertical feed.
          </p>
        </section>

        <section className="rounded-[32px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/94 p-8 text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-serif)" }}>
            No open-problem feed yet
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
            Join an open problem or publish one. Once discussions start and summaries are generated, the reel feed will populate automatically.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/open-problems" className="dr-button rounded-2xl px-4 py-2 text-sm">
              Browse open problems
            </Link>
            <Link href="/dashboard" className="dr-button-outline rounded-2xl px-4 py-2 text-sm">
              Dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/96 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Box
            </p>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
              Scan open-problem updates like a reel feed.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
              Scroll up and down through finished meeting summaries and waiting problem cards. Jump between the open problems you follow and catch up on what other participants discussed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
            <span className="rounded-full border border-[color:var(--stroke)] bg-white px-3 py-1">{uniqueProblems.length} followed problems</span>
            <span className="rounded-full border border-[color:var(--stroke)] bg-white px-3 py-1">{items.length} reel cards</span>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {uniqueProblems.map((problem) => (
            <button
              key={problem.id}
              type="button"
              onClick={() => scrollToProblem(problem.id)}
              className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-white px-3 py-2 text-left text-xs font-medium text-[color:var(--ink)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {problem.title}
            </button>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-5xl">
        <div className="max-h-[calc(100vh-12rem)] snap-y snap-mandatory overflow-y-auto pr-1">
          <div className="space-y-5">
            {items.map((item, index) => (
              <article
                key={item.id}
                ref={(node) => {
                  cardRefs.current[item.id] = node;
                }}
                className="snap-start overflow-hidden rounded-[34px] border border-[color:var(--stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-[0_24px_70px_rgba(15,23,42,0.12)]"
              >
                <div
                  className="h-2 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${item.problem.dataspaceColor ?? "#f59e0b"}, rgba(255,255,255,0.96))`
                  }}
                />
                <div className="grid min-h-[calc(100vh-14rem)] gap-0 lg:grid-cols-[minmax(0,0.68fr)_minmax(300px,0.32fr)]">
                  <div className="flex flex-col justify-between p-6 sm:p-8">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[color:var(--stroke)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                          {item.problem.title}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClasses(item.statusTone)}`}>
                          {item.statusLabel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                          Card {index + 1}
                        </span>
                      </div>

                      <h2 className="mt-5 text-3xl font-semibold leading-tight text-[color:var(--ink)] sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                        {item.headline}
                      </h2>

                      {item.subheadline ? (
                        <p className="mt-4 text-base font-medium leading-7 text-slate-800 sm:text-lg">{item.subheadline}</p>
                      ) : null}

                      <p className="mt-6 max-w-3xl text-sm leading-8 text-[color:var(--muted)] sm:text-[15px]">{item.body}</p>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
                      {item.transcriptionProviderLabel ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.transcriptionProviderLabel}</span>
                      ) : null}
                      {item.language ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.language}</span> : null}
                      {item.scheduledLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.scheduledLabel}</span> : null}
                      {item.updatedLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.updatedLabel}</span> : null}
                    </div>
                  </div>

                  <aside className="flex flex-col justify-between border-t border-[color:var(--stroke)] bg-[color:var(--surface)]/88 p-6 lg:border-l lg:border-t-0">
                    <div className="space-y-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Open problem</p>
                        <h3 className="mt-2 text-xl font-semibold text-[color:var(--ink)]">{item.problem.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{item.problem.description}</p>
                      </div>

                      <div className="space-y-2 text-xs leading-6 text-[color:var(--muted)]">
                        <p>Status: {item.problem.status}</p>
                        <p>Dataspace: {item.problem.dataspaceName ?? "No dataspace"}</p>
                        <p>Created by: {item.problem.creatorEmail}</p>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                      {item.meetingId ? (
                        <Link href={`/meetings/${item.meetingId}`} className="dr-button rounded-2xl px-4 py-2 text-sm">
                          Open meeting
                        </Link>
                      ) : null}
                      <Link href={`/open-problems/${item.problem.id}`} className="dr-button-outline rounded-2xl px-4 py-2 text-sm">
                        Open problem
                      </Link>
                      <Link href="/open-problems" className="rounded-2xl border border-[color:var(--stroke)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--ink)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]">
                        All open problems
                      </Link>
                    </div>
                  </aside>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
