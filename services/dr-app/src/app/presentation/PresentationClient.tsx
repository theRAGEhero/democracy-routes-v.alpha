"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SlideId =
  | "hero"
  | "problem"
  | "workspace"
  | "meetings"
  | "templates"
  | "openProblems"
  | "ai"
  | "useCases"
  | "stack"
  | "close";

type SlideMeta = {
  id: SlideId;
  kicker: string;
  label: string;
  title: string;
  summary: string;
};

const slides: SlideMeta[] = [
  {
    id: "hero",
    kicker: "Democracy Routes",
    label: "Overview",
    title: "A platform for structured collaboration around real problems.",
    summary:
      "Democracy Routes helps people move from an issue to an organized process: dataspaces, meetings, templates, transcripts, summaries, and follow-up work connected in one product."
  },
  {
    id: "problem",
    kicker: "Why it exists",
    label: "Problem",
    title: "Most collective discussions are useful in the moment and lost afterward.",
    summary:
      "Calls end, notes disappear, context fragments, and the next meeting starts from zero. Democracy Routes is built to preserve continuity, structure, and accountability across the whole collaboration lifecycle."
  },
  {
    id: "workspace",
    kicker: "Core workspace",
    label: "Dataspaces",
    title: "Dataspaces keep people, meetings, templates, texts, and analysis in one durable context.",
    summary:
      "Instead of treating each meeting as a standalone event, the app keeps related activity inside a shared space where collaboration can accumulate over time."
  },
  {
    id: "meetings",
    kicker: "Meeting lifecycle",
    label: "Meetings",
    title: "Meetings are designed to produce more than a call recording.",
    summary:
      "Live rooms, post-call transcription, summaries, speaking-time traces, participation context, and follow-up actions all become part of the same meeting record."
  },
  {
    id: "templates",
    kicker: "Reusable structure",
    label: "Templates",
    title: "Templates let facilitators define how a meeting should work before it starts.",
    summary:
      "With modular and structured builders, teams can define rounds, prompts, timing, matching, participation logic, and reusable discussion flows instead of improvising every session."
  },
  {
    id: "openProblems",
    kicker: "Entry point",
    label: "Open Problems",
    title: "A problem can enter the platform before the meeting even exists.",
    summary:
      "Users can publish an open problem, connect it to a dataspace, find similar issues, gather interest, and later turn that issue into a meeting or a broader route."
  },
  {
    id: "ai",
    kicker: "AI support",
    label: "AI",
    title: "AI is used as support infrastructure, not as an invisible decider.",
    summary:
      "The product uses AI for transcription support, summaries, analysis, drafting help, assistants, and workflow support, while keeping those outputs tied back to meeting evidence and user-controlled process."
  },
  {
    id: "useCases",
    kicker: "Where it fits",
    label: "Use cases",
    title: "The same product can support civic groups, institutions, research, and organizational coordination.",
    summary:
      "The workflow is consistent across contexts: identify a problem, structure the discussion, keep the output, and continue with better context rather than starting over."
  },
  {
    id: "stack",
    kicker: "Full stack",
    label: "Architecture",
    title: "Democracy Routes already runs as a coordinated multi-service application stack.",
    summary:
      "The live product combines the main app, embedded video rooms, transcription services, remote workers, event tracing, matching, and post-call analysis into one operational system."
  },
  {
    id: "close",
    kicker: "Outcome",
    label: "Closing",
    title: "The goal is durable collective reasoning, not disposable conversation.",
    summary:
      "Democracy Routes is designed so every serious discussion can leave behind structure: memory, evidence, next steps, and a stronger basis for the next collaboration round."
  }
];

const workspaceCards = [
  ["Members", "People connected to the same dataspace with shared visibility and collaboration rights."],
  ["Meetings", "Live or post-call discussion spaces tied to the same ongoing context."],
  ["Templates", "Reusable deliberation structures that can be reopened, edited, and launched again."],
  ["Texts", "Asynchronous written material that complements meetings and preserves evolving thought."],
  ["Analytics", "Dataspace-level summaries and recurring analysis across meetings and templates."]
];

const meetingCards = [
  ["Embedded live room", "Run the call inside the app with participant context and meeting controls."],
  ["Transcription", "Use live or post-call transcription providers depending on the meeting mode."],
  ["AI summary", "Turn transcripts into readable recaps, titles, descriptions, and follow-up artifacts."],
  ["Participation balance", "Track speaking time and intervention balance as a post-call reflection aid."]
];

const templateCards = [
  "Structured builder",
  "Modular builder",
  "Discussion rounds",
  "Prompts and notes",
  "Matching settings",
  "AI-ready module descriptions",
  "Reusable timing rules",
  "Meeting inheritance"
];

const routeFlow = [
  "A problem is opened inside the platform.",
  "The issue is connected to a dataspace or left in no-dataspace mode.",
  "A meeting or template is created around that issue.",
  "Discussion rounds happen and produce transcripts and notes.",
  "AI summaries and analysis make the output easier to reuse.",
  "The work continues through a new meeting, a new text, or a deeper route."
];

const aiCards = [
  ["Transcription support", "Deepgram Live, post-call providers, and remote-worker flows extend meeting capture."],
  ["Summaries", "Generate post-call recaps, better titles, descriptions, and readable outputs from meeting evidence."],
  ["Analysis", "Run meeting- and dataspace-level analysis across templates, meetings, and texts."],
  ["Assistants", "Support drafting, open problems, and configurable AI agents without replacing human facilitation."]
];

const useCaseCards = [
  ["Civic groups", "Organize recurring discussion around local issues, campaigns, and collaborative texts."],
  ["Institutions", "Collect better structured input than generic social media and keep the process inspectable."],
  ["Research labs", "Study discussion formats, participation balance, and route evolution over time."],
  ["Organizations", "Use the same workflow for team problem solving, design sessions, and cross-functional coordination."]
];

const stackRows = [
  ["dr-app", "Control plane", "Users, dataspaces, meetings, templates, texts, open problems, and admin tools."],
  ["dr-video", "Live room", "Embedded WebRTC room with recording, Deepgram Live, voice activity, and media tracing."],
  ["transcription-hub", "Transcript store", "Normalized transcript sessions and deliberation artifacts."],
  ["dr-event-hub", "Event layer", "Structured runtime events for debugging and operational visibility."],
  ["dr-remote-worker", "Worker runtime", "Post-call remote transcription execution and job claiming."],
  ["audio-api/deepgram", "Speech-to-text", "Post-call Deepgram transcription and diarization path."],
  ["audio-api/vosk", "Speech-to-text", "Alternative post-call STT path for offline-style transcription flows."],
  ["dr-matching / dr-thinker", "Support services", "Matching logic and AI analysis surfaces used by the main app."]
];

function clamp(next: number) {
  return Math.max(0, Math.min(slides.length - 1, next));
}

function SlideShell({
  kicker,
  title,
  summary,
  children
}: {
  kicker: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex h-[calc(100vh-98px)] max-h-[calc(100vh-98px)] w-full max-w-[1500px] flex-col overflow-hidden px-4 pb-14 pt-1 sm:px-6 lg:px-8 xl:px-10">
      <div className="max-w-4xl shrink-0">
        <div className="inline-flex rounded-full border border-[var(--stroke)] bg-white/70 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-deep)]">
          {kicker}
        </div>
        <h1 className="mt-1.5 max-w-5xl text-xl font-semibold leading-[1.03] text-[var(--ink)] sm:text-[1.75rem] xl:text-[2.2rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-[13px]">
          {summary}
        </p>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function RouteAnimation() {
  return (
    <div className="relative h-full min-h-[190px] overflow-hidden rounded-[1.6rem] border border-[var(--stroke)] bg-[rgba(255,255,255,0.72)] p-3">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:rgba(21,21,21,0.42)]">
        Route generation
      </div>
      <div className="relative mt-2.5 h-[152px]">
        <div className="absolute left-[11%] top-[48%] h-[3px] w-[26%] rounded-full bg-[rgba(249,115,22,0.28)]" />
        <div className="absolute left-[37%] top-[48%] h-[3px] w-[23%] rounded-full bg-[rgba(29,78,216,0.24)]" />
        <div className="absolute left-[60%] top-[33%] h-[3px] w-[20%] rotate-[23deg] rounded-full bg-[rgba(20,184,166,0.24)]" />
        <div className="absolute left-[60%] top-[63%] h-[3px] w-[20%] -rotate-[21deg] rounded-full bg-[rgba(20,184,166,0.24)]" />

        <div className="route-dot absolute left-[15%] top-[45%] h-3 w-3 rounded-full bg-[var(--accent)]" />
        <div className="route-dot route-dot-delay-1 absolute left-[43%] top-[45%] h-3 w-3 rounded-full bg-[var(--sky)]" />
        <div className="route-dot route-dot-delay-2 absolute left-[69%] top-[28%] h-3 w-3 rounded-full bg-[var(--mint)]" />
        <div className="route-dot route-dot-delay-3 absolute left-[69%] top-[61%] h-3 w-3 rounded-full bg-[var(--mint)]" />

        <div className="route-node absolute left-[4%] top-[34%] w-[24%] rounded-[1.1rem] border border-[var(--stroke)] bg-white px-2.5 py-2 shadow-[0_12px_28px_rgba(18,18,18,0.08)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-deep)]">Open problem</div>
          <div className="mt-1 text-xs font-semibold text-[var(--ink)] sm:text-sm">Housing pressure</div>
        </div>

        <div className="route-node route-node-delay-1 absolute left-[31%] top-[34%] w-[26%] rounded-[1.1rem] border border-[var(--stroke)] bg-white px-2.5 py-2 shadow-[0_12px_28px_rgba(18,18,18,0.08)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--sky)]">Meeting</div>
          <div className="mt-1 text-xs font-semibold text-[var(--ink)] sm:text-sm">Identify causes</div>
        </div>

        <div className="route-node route-node-delay-2 absolute left-[61%] top-[10%] w-[24%] rounded-[1.1rem] border border-[var(--stroke)] bg-white px-2.5 py-2 shadow-[0_12px_28px_rgba(18,18,18,0.08)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--mint)]">Route A</div>
          <div className="mt-1 text-xs font-semibold text-[var(--ink)] sm:text-sm">Rent policy</div>
        </div>

        <div className="route-node route-node-delay-3 absolute left-[61%] top-[56%] w-[24%] rounded-[1.1rem] border border-[var(--stroke)] bg-white px-2.5 py-2 shadow-[0_12px_28px_rgba(18,18,18,0.08)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--mint)]">Route B</div>
          <div className="mt-1 text-xs font-semibold text-[var(--ink)] sm:text-sm">Community support</div>
        </div>

        <div className="route-node route-node-delay-4 absolute right-[2%] top-[34%] w-[12%] rounded-[1.1rem] border border-[var(--stroke)] bg-[rgba(249,115,22,0.10)] px-2 py-2 text-center shadow-[0_12px_28px_rgba(18,18,18,0.08)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-deep)]">Next</div>
          <div className="mt-1 text-[10px] font-semibold text-[var(--ink)]">meeting</div>
        </div>
      </div>
    </div>
  );
}

function renderSlide(id: SlideId, goTo: (index: number) => void, goNext: () => void) {
  switch (id) {
    case "hero":
      return (
        <SlideShell
          kicker="Democracy Routes"
          title="A platform for structured collaboration around real problems."
          summary="Democracy Routes turns a concrete issue into a collaborative path: dataspaces, meetings, templates, transcripts, summaries, and follow-up work tied together instead of scattered across tools."
        >
          <div className="grid h-full gap-2.5 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="slide-hero-panel rounded-[2rem] border border-[var(--stroke)] bg-white/84 p-3 shadow-[0_26px_70px_rgba(18,18,18,0.08)] backdrop-blur">
              <div className="grid h-full grid-rows-[1fr_auto] gap-2.5">
                <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-[1.7rem] border border-[var(--stroke)] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.14),rgba(255,255,255,0.96)_58%)] p-3">
                  <img
                    src="/dr-tree-512.png"
                    alt="Democracy Routes tree logo"
                    className="slide-hero-logo h-full max-h-[35vh] w-auto max-w-full object-contain drop-shadow-[0_30px_50px_rgba(18,18,18,0.10)]"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {[
                    ["Shared roots", "Dataspaces keep people, meetings, texts, and templates in one context."],
                    ["Growing branches", "Each meeting can open the next route instead of ending as an isolated call."],
                    ["Living memory", "Transcripts, summaries, and analysis accumulate instead of disappearing."]
                  ].map(([name, text]) => (
                    <div key={name} className="slide-hero-card rounded-[1.5rem] border border-[var(--stroke)] bg-[rgba(255,255,255,0.72)] px-3 py-2">
                      <div className="text-xs font-semibold text-[var(--ink)] sm:text-sm">{name}</div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.7)]">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="slide-hero-copy rounded-[1.8rem] border border-[var(--stroke)] bg-[rgba(29,78,216,0.08)] p-3 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:rgba(21,21,21,0.46)]">Platform logic</div>
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-[color:rgba(21,21,21,0.78)] sm:text-sm">
                  <p>
                    Democracy Routes turns one issue into a durable collaboration path: open problems, dataspaces, meetings, templates, transcripts, summaries, and follow-up work.
                  </p>
                  <p>
                    The point is not only to host discussion. The point is to keep collective reasoning structured over time.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={goNext} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_40px_rgba(249,115,22,0.22)] sm:text-sm">
                    Start presentation
                  </button>
                  <button type="button" onClick={() => goTo(8)} className="rounded-full border border-[var(--stroke)] bg-white/70 px-4 py-2 text-xs font-semibold text-[var(--ink)] sm:text-sm">
                    See architecture
                  </button>
                </div>
              </div>
              {[
                "Start from a problem, not from a blank meeting.",
                "Reuse structures with templates instead of improvising every round.",
                "Keep transcripts and summaries attached to the process that produced them."
              ].map((item, index) => (
                <div key={item} className="slide-hero-note rounded-[1.6rem] border border-[var(--stroke)] bg-white/76 p-2.5 backdrop-blur">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:rgba(21,21,21,0.42)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-[var(--ink)]">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </SlideShell>
      );
    case "problem":
      return (
        <SlideShell
          kicker="Why this app"
          title="Most collaborative discussions produce energy, but not enough continuity."
          summary="People meet, talk, decide something, and then lose the process: no durable context, no structured follow-up, no reusable format, and weak memory across sessions."
        >
          <div className="grid h-full gap-2.5 md:grid-cols-3">
            {[
              ["Weak continuity", "Each new meeting often starts from zero because the previous one is poorly connected to the next."],
              ["Weak memory", "Transcripts, notes, and decisions are scattered across tools or never captured at all."],
              ["Weak structure", "Without reusable formats, facilitation quality varies and participation becomes inconsistent."]
            ].map(([name, text], index) => (
              <article key={name} className={`slide-problem-card slide-problem-${index + 1} rounded-[1.7rem] border border-[var(--stroke)] bg-white/76 p-3 backdrop-blur`}>
                <h3 className="text-base font-semibold text-[var(--ink)]">{name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "workspace":
      return (
        <SlideShell
          kicker="Core workspace"
          title="Dataspaces are the long-term container for collaboration."
          summary="A dataspace keeps related people, meetings, templates, texts, and analytics together, so a group can build a shared working memory instead of scattering the process across isolated pages."
        >
          <div className="grid h-full gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {workspaceCards.map(([name, text], index) => (
              <article key={name} className={`slide-workspace-card slide-workspace-${index + 1} rounded-[1.6rem] border border-[var(--stroke)] bg-white/76 p-3 backdrop-blur`}>
                <h3 className="text-base font-semibold text-[var(--ink)]">{name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "meetings":
      return (
        <SlideShell
          kicker="Meeting lifecycle"
          title="Meetings produce transcripts, summaries, participation context, and follow-up artifacts."
          summary="The app supports live and post-call meeting flows, making the session useful both during the call and after it ends."
        >
          <div className="grid h-full gap-2.5 xl:grid-cols-2">
            {meetingCards.map(([name, text], index) => (
              <article key={name} className={`slide-meeting-card slide-meeting-${index + 1} rounded-[1.7rem] border border-[var(--stroke)] bg-white/78 p-3 backdrop-blur`}>
                <h3 className="text-base font-semibold text-[var(--ink)]">{name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "templates":
      return (
        <SlideShell
          kicker="Reusable structure"
          title="Templates make collaboration repeatable."
          summary="Instead of rebuilding the meeting logic every time, facilitators can design and reuse structured flows through the modular builder and the structured builder."
        >
          <div className="grid h-full gap-3 xl:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:rgba(21,21,21,0.42)]">Template capabilities</div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {templateCards.map((name, index) => (
                  <div key={name} className={`slide-template-chip slide-template-${(index % 8) + 1} rounded-2xl border border-[var(--stroke)] bg-white/72 px-3 py-2 text-xs font-medium text-[var(--ink)] sm:text-sm`}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:rgba(21,21,21,0.42)]">Why this matters</div>
              <div className="slide-template-panel mt-2.5 rounded-[1.7rem] border border-[var(--stroke)] bg-[rgba(29,78,216,0.08)] p-3 backdrop-blur">
                <p className="text-xs leading-relaxed text-[color:rgba(21,21,21,0.76)] sm:text-sm">
                  Templates improve comparability, facilitation quality, and continuity. Once a format works, teams can reuse it across meetings and still adapt it when the route evolves.
                </p>
                <p className="mt-2.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.76)] sm:text-sm">
                  That is why the app includes both modular and structured editing surfaces: one for visual composition, one for direct configuration.
                </p>
              </div>
            </div>
          </div>
        </SlideShell>
      );
    case "openProblems":
      return (
        <SlideShell
          kicker="Entry point"
          title="Open Problems let the issue appear in the system before the meeting exists."
          summary="A user can publish a problem, connect it to a dataspace, discover similar issues, and let other people join before the group decides how to structure the discussion."
        >
          <div className="grid h-full gap-2.5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="slide-hero-note rounded-[1.7rem] border border-[var(--stroke)] bg-white/76 p-3 backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:rgba(21,21,21,0.42)]">Flow</div>
              <div className="mt-2.5 space-y-1.5">
                {routeFlow.map((item, index) => (
                  <div key={item} className={`slide-open-step slide-open-step-${index + 1} flex gap-2.5 rounded-2xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.58)] px-2.5 py-1.5`}>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="text-xs leading-relaxed text-[color:rgba(21,21,21,0.78)] sm:text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2.5">
              <RouteAnimation />
              {[
                ["Similar problems", "Before creating a new issue, users can see if a related problem already exists in the platform."],
                ["Dataspace connection", "An open problem can belong to a dataspace or remain in no-dataspace mode until the right context appears."],
                ["Join before meeting", "People can join the issue first, then decide together what meeting or route should come next."]
              ].map(([name, text], index) => (
                <article key={name} className={`slide-open-card slide-open-card-${index + 1} rounded-[1.6rem] border border-[var(--stroke)] bg-white/76 p-2.5 backdrop-blur`}>
                  <h3 className="text-sm font-semibold text-[var(--ink)] sm:text-base">{name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </SlideShell>
      );
    case "ai":
      return (
        <SlideShell
          kicker="AI support"
          title="AI is embedded in the workflow as support infrastructure."
          summary="The product uses AI where it improves clarity and continuity: transcription help, summaries, analysis, assistants, and later AI participants, while keeping human control over the process."
        >
          <div className="grid h-full gap-3 xl:grid-cols-[1fr_1fr]">
            <div className="grid gap-2.5">
              {aiCards.map(([name, text], index) => (
                <article key={name} className={`slide-ai-card slide-ai-${index + 1} rounded-[1.7rem] border border-[var(--stroke)] bg-white/78 p-3 backdrop-blur`}>
                  <h3 className="text-sm font-semibold text-[var(--ink)] sm:text-base">{name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
                </article>
              ))}
            </div>
            <div className="slide-ai-panel rounded-[1.7rem] border border-[var(--stroke)] bg-[rgba(20,184,166,0.08)] p-3 backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:rgba(21,21,21,0.42)]">Design principle</div>
              <p className="mt-2.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.76)] sm:text-sm">
                The app is strongest when AI remains accountable to the collaboration itself. Outputs should stay connected to transcripts, meetings, and structured context instead of becoming detached black-box decisions.
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.76)] sm:text-sm">
                That is why transcription, summaries, analysis, and event traces matter: they make the assistance layer inspectable and reusable.
              </p>
            </div>
          </div>
        </SlideShell>
      );
    case "useCases":
      return (
        <SlideShell
          kicker="Where it fits"
          title="The same platform can support civic, institutional, research, and organizational collaboration."
          summary="Different groups enter the app for different reasons, but they share the same need: stronger continuity from one discussion to the next."
        >
          <div className="grid h-full gap-2.5 md:grid-cols-2 xl:grid-cols-2">
            {useCaseCards.map(([name, text], index) => (
              <article key={name} className={`slide-usecase-card slide-usecase-${index + 1} rounded-[1.6rem] border border-[var(--stroke)] bg-white/76 p-3 backdrop-blur`}>
                <h3 className="text-base font-semibold text-[var(--ink)]">{name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[color:rgba(21,21,21,0.72)] sm:text-sm">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "stack":
      return (
        <SlideShell
          kicker="Full stack"
          title="The app already runs as a coordinated multi-service product stack."
          summary="Democracy Routes is not a mockup. The current deployment already combines UI, live rooms, transcripts, workers, event traces, and analysis services."
        >
          <div className="h-full overflow-hidden rounded-[1.8rem] border border-[var(--stroke)] bg-white/78 backdrop-blur">
            <div className="grid grid-cols-[1.1fr_0.8fr_1.45fr] border-b border-[var(--stroke)] px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(21,21,21,0.48)]">
              <div>Service</div>
              <div>Role</div>
              <div>Function</div>
            </div>
            <div className="divide-y divide-[var(--stroke)]">
              {stackRows.map(([service, role, functionText], index) => (
                <div key={service} className={`slide-stack-row slide-stack-${index + 1} grid grid-cols-1 gap-1 px-2.5 py-1.5 text-[10px] leading-snug text-[color:rgba(21,21,21,0.76)] md:grid-cols-[1.1fr_0.8fr_1.45fr]`}>
                  <div className="font-semibold text-[var(--ink)]">{service}</div>
                  <div>{role}</div>
                  <div>{functionText}</div>
                </div>
              ))}
            </div>
          </div>
        </SlideShell>
      );
    case "close":
      return (
        <SlideShell
          kicker="Outcome"
          title="The app is built to make collaboration durable and reusable."
          summary="The point is not to host one good call. The point is to leave behind a stronger structure for the next one: context, evidence, process memory, and a route that can keep growing."
        >
          <div className="slide-close-panel mx-auto max-w-4xl rounded-[1.8rem] border border-[var(--stroke)] bg-white/78 p-4 text-center backdrop-blur">
            <p className="text-xs leading-relaxed text-[color:rgba(21,21,21,0.78)] sm:text-sm">
              Democracy Routes is a product for groups that need more than chat, more than video, and more than notes. It is built for sustained collaborative work around real issues.
            </p>
            <div className="mt-3.5 flex flex-wrap justify-center gap-2">
              <a
                href="/"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_40px_rgba(249,115,22,0.22)] sm:text-sm"
              >
                Go to app
              </a>
              <button type="button" onClick={() => goTo(0)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white sm:text-sm">
                Restart
              </button>
              <button type="button" onClick={() => goTo(8)} className="rounded-full border border-[var(--stroke)] bg-white/70 px-4 py-2 text-xs font-semibold text-[var(--ink)] sm:text-sm">
                Back to architecture
              </button>
            </div>
          </div>
        </SlideShell>
      );
  }
}

export function PresentationClient() {
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelLockRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  const activeSlide = useMemo(() => slides[activeIndex] ?? slides[0], [activeIndex]);

  const goTo = useCallback((index: number) => setActiveIndex(clamp(index)), []);
  const goNext = useCallback(() => setActiveIndex((current) => clamp(current + 1)), []);
  const goPrev = useCallback(() => setActiveIndex((current) => clamp(current - 1)), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goTo(slides.length - 1);
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const now = Date.now();
      if (now - wheelLockRef.current < 800) return;
      if (Math.abs(event.deltaY) < 26) return;
      wheelLockRef.current = now;
      if (event.deltaY > 0) goNext();
      else goPrev();
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [goNext, goPrev, goTo]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]"
      onTouchStart={(event) => {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        const startY = touchStartYRef.current;
        const endY = event.changedTouches[0]?.clientY ?? null;
        touchStartYRef.current = null;
        if (startY == null || endY == null) return;
        const delta = startY - endY;
        if (Math.abs(delta) < 48) return;
        if (delta > 0) goNext();
        else goPrev();
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,#ffe9cf,transparent_42%),radial-gradient(circle_at_80%_0%,#d8f4ff,transparent_50%),radial-gradient(circle_at_75%_78%,rgba(20,184,166,0.10),transparent_24%),linear-gradient(180deg,#fffdf8_0%,#f2f0e8_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-[9%] top-[10%] h-40 w-40 rounded-full border border-[rgba(21,21,21,0.08)]" />
        <div className="absolute right-[12%] top-[18%] h-28 w-28 rounded-full border border-[rgba(21,21,21,0.08)]" />
        <div className="absolute bottom-[18%] left-[24%] h-52 w-52 rounded-full border border-[rgba(21,21,21,0.08)]" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-4 pb-2 pt-4 sm:px-6 lg:px-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:rgba(21,21,21,0.52)]">
            Product presentation
          </div>
          <div className="mt-1 text-base font-semibold text-[var(--ink)] sm:text-lg">Democracy Routes</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[color:rgba(21,21,21,0.58)]">
          <span>
            {String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <div className="hidden md:block">{activeSlide.label}</div>
        </div>
      </header>

      <div className="relative z-10 flex h-[calc(100vh-78px)] overflow-hidden">
        <aside className="hidden w-[88px] shrink-0 flex-col items-center justify-center gap-4 lg:flex">
          {slides.map((slide, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                className="group flex w-full justify-center"
                aria-label={`Go to ${slide.label}`}
              >
                <div className={`h-12 w-[3px] rounded-full transition-all ${active ? "bg-[var(--accent)]" : "bg-[rgba(21,21,21,0.14)] group-hover:bg-[rgba(21,21,21,0.32)]"}`} />
              </button>
            );
          })}
        </aside>

        <div key={activeSlide.id} className="flex-1">{renderSlide(activeSlide.id, goTo, goNext)}</div>

        <aside className="hidden w-[110px] shrink-0 flex-col items-center justify-center gap-3 pr-5 xl:flex">
          {slides.map((slide, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                className={`flex h-14 w-14 items-center justify-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_18px_40px_rgba(249,115,22,0.22)]"
                    : "border-[var(--stroke)] bg-white/72 text-[color:rgba(21,21,21,0.58)] hover:border-[rgba(21,21,21,0.18)] hover:text-[var(--ink)]"
                }`}
                aria-label={`Go to ${slide.label}`}
              >
                {index + 1}
              </button>
            );
          })}
        </aside>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white/76 px-3 py-1.5 backdrop-blur">
          <button
            type="button"
            onClick={goPrev}
            disabled={activeIndex === 0}
            className="rounded-full border border-[var(--stroke)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--ink)] disabled:opacity-35"
          >
            Previous
          </button>
          <div className="min-w-[180px] px-2 text-center text-[10px] uppercase tracking-[0.14em] text-[color:rgba(21,21,21,0.52)] sm:min-w-[220px] sm:text-xs">
            {activeSlide.label}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={activeIndex === slides.length - 1}
            className="rounded-full border border-[var(--stroke)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--ink)] disabled:opacity-35"
          >
            Next
          </button>
        </div>
      </div>

      <style jsx global>{`
        .slide-hero-panel,
        .slide-hero-copy,
        .slide-hero-card,
        .slide-hero-note,
        .slide-problem-card,
        .slide-workspace-card,
        .slide-meeting-card,
        .slide-open-step,
        .slide-open-card,
        .slide-ai-card,
        .slide-ai-panel,
        .slide-usecase-card,
        .slide-stack-row,
        .slide-template-panel,
        .slide-close-panel {
          position: relative;
          overflow: hidden;
          opacity: 0;
          transform: translateY(14px) scale(0.985);
          animation: dr-route-panel-in 860ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .slide-hero-panel::before,
        .slide-hero-copy::before,
        .slide-hero-card::before,
        .slide-hero-note::before,
        .slide-problem-card::before,
        .slide-workspace-card::before,
        .slide-meeting-card::before,
        .slide-open-step::before,
        .slide-open-card::before,
        .slide-ai-card::before,
        .slide-ai-panel::before,
        .slide-usecase-card::before,
        .slide-stack-row::before,
        .slide-template-panel::before,
        .slide-close-panel::before {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          top: 0;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(249,115,22,0.32), rgba(59,130,246,0.22), rgba(20,184,166,0.28));
          transform: scaleX(0.12);
          transform-origin: left center;
          opacity: 0;
          animation: dr-route-trace 860ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .slide-hero-logo {
          transform-origin: center;
          animation: dr-hero-logo 1400ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .slide-template-chip {
          position: relative;
          overflow: hidden;
          opacity: 0;
          transform: translateY(10px) scale(0.97);
          animation: dr-route-chip-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .slide-template-chip::before {
          content: "";
          position: absolute;
          left: 10px;
          right: 10px;
          top: 0;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(249,115,22,0.28), rgba(20,184,166,0.24));
          transform: scaleX(0.12);
          transform-origin: left center;
          opacity: 0;
          animation: dr-route-trace 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .slide-problem-1, .slide-workspace-1, .slide-meeting-1, .slide-open-step-1, .slide-open-card-1, .slide-ai-1, .slide-usecase-1, .slide-stack-1 { animation-delay: 80ms; }
        .slide-problem-2, .slide-workspace-2, .slide-meeting-2, .slide-open-step-2, .slide-open-card-2, .slide-ai-2, .slide-usecase-2, .slide-stack-2 { animation-delay: 170ms; }
        .slide-problem-3, .slide-workspace-3, .slide-meeting-3, .slide-open-step-3, .slide-open-card-3, .slide-ai-3, .slide-usecase-3, .slide-stack-3 { animation-delay: 260ms; }
        .slide-workspace-4, .slide-meeting-4, .slide-open-step-4, .slide-ai-4, .slide-usecase-4, .slide-stack-4 { animation-delay: 350ms; }
        .slide-workspace-5, .slide-open-step-5, .slide-stack-5 { animation-delay: 440ms; }
        .slide-open-step-6, .slide-stack-6 { animation-delay: 530ms; }
        .slide-stack-7 { animation-delay: 620ms; }
        .slide-stack-8 { animation-delay: 710ms; }

        .slide-template-1 { animation-delay: 60ms; }
        .slide-template-2 { animation-delay: 120ms; }
        .slide-template-3 { animation-delay: 180ms; }
        .slide-template-4 { animation-delay: 240ms; }
        .slide-template-5 { animation-delay: 300ms; }
        .slide-template-6 { animation-delay: 360ms; }
        .slide-template-7 { animation-delay: 420ms; }
        .slide-template-8 { animation-delay: 480ms; }

        .slide-hero-card:nth-child(1) { animation-delay: 180ms; }
        .slide-hero-card:nth-child(2) { animation-delay: 280ms; }
        .slide-hero-card:nth-child(3) { animation-delay: 380ms; }
        .slide-hero-note:nth-of-type(2) { animation-delay: 260ms; }
        .slide-hero-note:nth-of-type(3) { animation-delay: 360ms; }
        .slide-hero-note:nth-of-type(4) { animation-delay: 460ms; }

        @keyframes dr-route-panel-in {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
            box-shadow: 0 0 0 rgba(18,18,18,0);
          }
          68% {
            opacity: 1;
            transform: translateY(0) scale(1.006);
            box-shadow: 0 18px 42px rgba(18,18,18,0.06);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            box-shadow: 0 10px 24px rgba(18,18,18,0.04);
          }
        }

        @keyframes dr-route-chip-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.97);
          }
          72% {
            opacity: 1;
            transform: translateY(0) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dr-route-trace {
          0% {
            opacity: 0;
            transform: scaleX(0.12);
          }
          55% {
            opacity: 1;
            transform: scaleX(1);
          }
          100% {
            opacity: 0.88;
            transform: scaleX(1);
          }
        }

        @keyframes dr-hero-logo {
          0% { opacity: 0; transform: scale(0.86) translateY(16px); }
          55% { opacity: 1; transform: scale(1.03) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        .route-node {
          opacity: 0;
          transform: translateY(14px) scale(0.98);
          animation: dr-route-node-in 8s ease-in-out infinite;
        }

        .route-node-delay-1 {
          animation-delay: 0.8s;
        }

        .route-node-delay-2 {
          animation-delay: 1.6s;
        }

        .route-node-delay-3 {
          animation-delay: 2.4s;
        }

        .route-node-delay-4 {
          animation-delay: 3.2s;
        }

        .route-dot {
          opacity: 0;
          animation: dr-route-dot 8s ease-in-out infinite;
        }

        .route-dot-delay-1 {
          animation-delay: 0.8s;
        }

        .route-dot-delay-2 {
          animation-delay: 1.6s;
        }

        .route-dot-delay-3 {
          animation-delay: 2.4s;
        }

        @keyframes dr-route-node-in {
          0%,
          8% {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          14%,
          76% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scale(0.99);
          }
        }

        @keyframes dr-route-dot {
          0%,
          8% {
            opacity: 0;
            transform: scale(0.7);
          }
          14%,
          72% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.18);
          }
          42% {
            box-shadow: 0 0 0 10px rgba(249, 115, 22, 0);
          }
          100% {
            opacity: 0;
            transform: scale(0.7);
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
          }
        }
      `}</style>
    </div>
  );
}
