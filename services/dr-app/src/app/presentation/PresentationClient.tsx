"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SlideId =
  | "hero"
  | "context"
  | "users"
  | "software"
  | "routes"
  | "modules"
  | "gamification"
  | "popp"
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
    label: "Premise",
    title: "A structured system for turning real problems into organized deliberation.",
    summary:
      "The whitepaper defines Democracy Routes as software that starts from a real problem, organizes people both synchronously and asynchronously, and continues arranging deliberative steps until the problem is considered resolved."
  },
  {
    id: "context",
    kicker: "Social-Historical Context",
    label: "Why now",
    title: "The project is framed as a response to democratic distrust and political powerlessness.",
    summary:
      "The whitepaper links the platform to declining participation, rising abstention, and a widespread feeling that citizens cannot meaningfully affect institutions."
  },
  {
    id: "users",
    kicker: "Target users",
    label: "Who it is for",
    title: "The platform is designed for different publics with different entry points into politics.",
    summary:
      "The whitepaper breaks the product into specific use cases: youth, citizens, policymakers, political philosophers, and entrepreneurs. The core idea is that the same platform can help each group engage in structured problem solving from its own position."
  },
  {
    id: "software",
    kicker: "Software logic",
    label: "What the software does",
    title: "Democracy Routes is presented as a no-code language for consultative and decision-making systems.",
    summary:
      "The system is not described as just a meeting tool. It is described as a transparent, modular environment for designing routes, organizing round tables, integrating AI without a black box, and preserving decisions in a traceable way."
  },
  {
    id: "routes",
    kicker: "Routes and Round Tables",
    label: "Operational model",
    title: "Problems are segmented, discussed in round tables, and linked into routes and virtual routes.",
    summary:
      "The whitepaper emphasizes decomposition: one problem becomes sub-problems, each discussed in dedicated round tables. Outputs become signed records, and related secondary themes can branch into virtual routes."
  },
  {
    id: "modules",
    kicker: "Modules and Properties",
    label: "Selection and extension",
    title: "The platform is meant to be modular, parametric, and skill-sensitive.",
    summary:
      "Modules cover consultation, deliberation, legal drafting, transparency, information, polarization reduction, and external integrations. Participant selection can depend on ideology, skills, scientific field, experience, gender, proximity, political power, and sensitivity."
  },
  {
    id: "gamification",
    kicker: "Gamification and Feed",
    label: "Motivation layer",
    title: "Participation is meant to be visible, rewarded, and socially legible.",
    summary:
      "The whitepaper gives gamification a structural role: community pillars, consensus ambassadors, mediation champions, opinion explorers, sponsorships, feeds, and discovery layers are all intended to keep participation active and directional."
  },
  {
    id: "popp",
    kicker: "Proof of Political Power",
    label: "Political theory extension",
    title: "The second PDF extends the idea from deliberation software to a new proof system based on political participation.",
    summary:
      "Proof of Political Power proposes using time spent in recorded deliberative systems as a non-accumulable source of validation authority, separating political power from wealth-based power."
  },
  {
    id: "stack",
    kicker: "Current stack",
    label: "What exists now",
    title: "The repository implements the software layer of that vision as a coordinated multi-service stack.",
    summary:
      "The current codebase operationalizes the whitepaper through dr-app, dr-video, transcription services, event tracing, matching, post-call workers, and AI support surfaces."
  },
  {
    id: "close",
    kicker: "Closing",
    label: "Direction",
    title: "The project’s through-line is durable, transparent, reusable collective reasoning.",
    summary:
      "Across both documents, the constant claim is that discussion should not disappear after a call. It should become a chain of documented process, analyzable output, and organized next steps."
  }
];

const userCards = [
  ["Youth", "A practical guide into politics and democratic problem solving without requiring prior political theory."],
  ["Citizens", "A bridge between institutions and people, with AI-assisted routes that reduce the cultural gap around political participation."],
  ["Policymakers", "A way to channel the citizens' desire for change into specific routes and more effective consultation."],
  ["Political philosophers", "A simulation environment for testing new decision-making systems, from top-down to horizontal ones."],
  ["Entrepreneurs", "Company problem solving through recurring round tables, automatic summaries, and skill-oriented collaboration."]
];

const routeFlow = [
  "A user starts from a concrete problem close to them.",
  "The system helps articulate the issue and identify relevant people.",
  "One or more round tables are organized around the topic.",
  "Multiple round tables in succession form a route.",
  "Texts, summaries, and records feed an LLM layer attached to that route.",
  "The system keeps organizing further round tables until the problem is considered resolved."
];

const moduleCards = [
  "Civic Participation",
  "Consultative",
  "Deliberative",
  "Gamification",
  "Legal",
  "Transparency",
  "Information",
  "Social Polarization",
  "External modules",
  "Graphical interface"
];

const propertyCards = [
  "Ideology",
  "Skills",
  "Scientific Field",
  "Experience",
  "Sex / Gender",
  "Proximity",
  "Political Power",
  "Sensitivity"
];

const gamificationCards = [
  "Community Pillars",
  "Consensus Ambassadors",
  "Mediation Champions",
  "Opinion Explorers"
];

const poppPoints = [
  "Current proof systems decentralize physically but often remain logically tied to wealth.",
  "PoPP proposes using political actions inside deliberative systems as the basis for validation lotteries.",
  "Time is treated as the key scarce resource because it cannot be accumulated indefinitely like money.",
  "Round Table participation would generate Political Power Tokens tied to visible, recorded participation.",
  "The paper argues that governance power should be earned through political time rather than stake accumulation."
];

const stackRows = [
  ["dr-app", "Control plane", "Users, dataspaces, meetings, templates, open problems, admin settings, AI surfaces."],
  ["dr-video", "Live room", "WebRTC room, recording, Deepgram Live, voice activity, client/server media logging."],
  ["transcription-hub", "Transcript store", "Normalized transcript sessions and deliberation artifacts."],
  ["dr-event-hub", "Event layer", "Structured runtime events for debugging and system traces."],
  ["dr-remote-worker", "Worker runtime", "Post-call remote transcription jobs and checkpoints."],
  ["audio-api/deepgram", "Post-call STT", "Deepgram prerecorded transcription and diarization."],
  ["audio-api/vosk", "Post-call STT", "Offline-style post-call transcription path."],
  ["dr-matching / dr-thinker", "Support services", "Matching logic and AI analysis surfaces."]
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
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[1500px] flex-col justify-center px-5 pb-24 pt-6 sm:px-8 lg:px-10 xl:px-14">
      <div className="max-w-5xl">
        <div className="inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
          {kicker}
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-[1.02] text-white sm:text-6xl xl:text-7xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/72 sm:text-lg">
          {summary}
        </p>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function renderSlide(id: SlideId, goTo: (index: number) => void, goNext: () => void) {
  switch (id) {
    case "hero":
      return (
        <SlideShell
          kicker="Democracy Routes"
          title="A structured system for turning real problems into organized deliberation."
          summary="The whitepaper defines Democracy Routes as software that begins from a real problem, organizes participation both synchronously and asynchronously, and keeps working until the problem is no longer left alone as an isolated complaint."
        >
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4">
              {[
                "Problem first, interface second.",
                "Routes instead of isolated meetings.",
                "Transparency instead of black-box automation.",
                "Recorded discussion instead of disposable conversation.",
                "Next steps instead of dead-end talk."
              ].map((item, index) => (
                <div key={item} className="rounded-[1.8rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">{item}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[2rem] border border-white/12 bg-black/15 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">What the documents insist on</div>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/80">
                <p>
                  Democracy Routes is not framed as a generic civic forum. It is framed as a system for organizing people participation around concrete issues.
                </p>
                <p>
                  The software is meant to select people, organize round tables, preserve records, integrate AI transparently, and keep branching a problem into further structured work.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={goNext} className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(251,191,36,0.28)]">
                  Start
                </button>
                <button type="button" onClick={() => goTo(7)} className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white">
                  Jump to PoPP
                </button>
              </div>
            </div>
          </div>
        </SlideShell>
      );
    case "context":
      return (
        <SlideShell
          kicker="Social-Historical Context"
          title="The project starts from distrust, abstention, and a sense that political action changes nothing."
          summary="The whitepaper places Democracy Routes inside a broader democratic crisis: lower voter turnout, distrust toward institutions, and a widespread feeling of powerlessness among citizens."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Distrust", "Liberal democracies are described as facing growing distrust, especially visible since the 1990s."],
              ["Abstention", "The document treats rising abstention as a concrete symptom that participation channels are failing."],
              ["Powerlessness", "The platform is positioned against the feeling that engagement does not lead to meaningful change."]
            ].map(([name, text]) => (
              <article key={name} className="rounded-[1.8rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <h3 className="text-xl font-semibold text-white">{name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/76">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "users":
      return (
        <SlideShell
          kicker="Target users"
          title="The same platform is meant to serve different publics with different political entry points."
          summary="The whitepaper is explicit about user segmentation. It is not only for institutions or only for grassroots groups. It is meant to adapt to several kinds of actors."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {userCards.map(([name, text]) => (
              <article key={name} className="rounded-[1.7rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <h3 className="text-xl font-semibold text-white">{name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/76">{text}</p>
              </article>
            ))}
          </div>
        </SlideShell>
      );
    case "software":
      return (
        <SlideShell
          kicker="The Democracy Routes Software"
          title="The software is described as a transparent no-code language for consultative and decision-making systems."
          summary="The whitepaper emphasizes no-code logic, transparency, modularity, AI without a black box, and even blockchain-backed integrity for decision records."
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Main software claims</div>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/78">
                <li>The platform introduces decision-making models through a flowchart-like language.</li>
                <li>It is intended to be usable without advanced IT skills.</li>
                <li>AI is framed as a transparent and controllable tool rather than an opaque decider.</li>
                <li>Blockchain is described as a way to protect integrity and trace changes in decision processes.</li>
              </ul>
            </div>
            <div className="rounded-[1.8rem] border border-white/12 bg-black/15 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Why transparency matters here</div>
              <p className="mt-4 text-sm leading-relaxed text-white/78">
                The whitepaper explicitly rejects AI as a black box. It argues that each decision taken by AI should be tracked, reviewable, and analyzable, with human creativity still treated as indispensable.
              </p>
            </div>
          </div>
        </SlideShell>
      );
    case "routes":
      return (
        <SlideShell
          kicker="Routes and Round Tables"
          title="The operational unit is not one call. It is a route made of many round tables and related texts."
          summary="This is one of the strongest ideas in the documents: a problem is decomposed, multiple round tables are organized, outputs are signed, and related side-topics can become virtual routes."
        >
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Flow</div>
              <div className="mt-4 space-y-3">
                {routeFlow.map((item, index) => (
                  <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-white/80">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              {[
                ["Document output", "Minutes of the round table, prepared by STT systems, refined by AI, and signed by participants."],
                ["Document input", "Asynchronous comments, documents, theses, or scientific articles feeding a route."],
                ["Virtual routes", "Secondary themes discovered inside round tables and linked into new paths."]
              ].map(([name, text]) => (
                <article key={name} className="rounded-[1.7rem] border border-white/12 bg-white/8 p-5 backdrop-blur">
                  <h3 className="text-lg font-semibold text-white">{name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/76">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </SlideShell>
      );
    case "modules":
      return (
        <SlideShell
          kicker="Modules and Properties"
          title="The platform is intended as a host for many deliberation-related modules and many participant properties."
          summary="The whitepaper imagines a semi-universal platform where new modules can be installed and configured, while participant selection remains sensitive to skill, ideology, experience, and context."
        >
          <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Module families</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {moduleCards.map((name) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white/82">
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Selection properties</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {propertyCards.map((name) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-sm font-medium text-white/78">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SlideShell>
      );
    case "gamification":
      return (
        <SlideShell
          kicker="Gamification and Feed"
          title="The documents treat civic participation as something that should be visible, legible, and worth sustaining."
          summary="Gamification is not framed as decoration. It is framed as a way to push people toward mediation, consensus-building, difficult routes, and ongoing participation."
        >
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Core categories</div>
              <div className="mt-4 grid gap-3">
                {gamificationCards.map((name) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-sm font-medium text-white/82">
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.8rem] border border-white/12 bg-black/15 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Feed logic</div>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/78">
                <li>New Routes</li>
                <li>New Round Tables</li>
                <li>Successful Routes</li>
                <li>Never Ending Routes</li>
                <li>Round Tables Near You</li>
                <li>Inflamed Round Tables</li>
                <li>Round Tables for You</li>
              </ul>
            </div>
          </div>
        </SlideShell>
      );
    case "popp":
      return (
        <SlideShell
          kicker="Proof of Political Power"
          title="The second document pushes the core idea further: deliberative participation itself becomes a source of validation authority."
          summary="The PoPP paper argues that proof systems tied to money preserve logical centralization. It proposes recorded political participation as an alternative basis for authority."
        >
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">PoPP claims</div>
              <div className="mt-4 space-y-3">
                {poppPoints.map((point) => (
                  <div key={point} className="rounded-2xl border border-white/10 bg-black/12 px-4 py-4 text-sm leading-relaxed text-white/80">
                    {point}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.8rem] border border-white/12 bg-black/15 p-6 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Why it matters to the platform</div>
              <p className="mt-4 text-sm leading-relaxed text-white/78">
                Even if PoPP is not implemented in this repository, it clarifies the deeper political direction of Democracy Routes: deliberative participation is not only a social activity, but a way of producing legitimate public power.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/78">
                In that sense, the recording, transcription, and structured routing of discussion are not side features. They are the evidence layer of the whole political model.
              </p>
            </div>
          </div>
        </SlideShell>
      );
    case "stack":
      return (
        <SlideShell
          kicker="Current stack"
          title="The repository implements the software layer of the whitepaper through a coordinated multi-service stack."
          summary="The current system operationalizes the vision as a control plane, a live room engine, transcript services, event tracing, matching, remote workers, and AI support surfaces."
        >
          <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/8 backdrop-blur">
            <div className="grid grid-cols-[1.2fr_1fr_1.5fr] border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              <div>Service</div>
              <div>Role</div>
              <div>Function</div>
            </div>
            <div className="divide-y divide-white/8">
              {stackRows.map(([service, role, functionText]) => (
                <div key={service} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-white/76 md:grid-cols-[1.2fr_1fr_1.5fr]">
                  <div className="font-semibold text-white">{service}</div>
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
          kicker="Closing"
          title="The strongest common thread across both PDFs is durable collective reasoning."
          summary="The documents argue that real problems should trigger organized routes, recorded discussion, transparent assistance, and repeated collective work instead of disappearing after one conversation."
        >
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/12 bg-white/8 p-8 text-center backdrop-blur">
            <p className="text-lg leading-relaxed text-white/80">
              The software in this repository is the first operational layer of that claim. It is the part that already exists: dataspaces, meetings, templates, transcripts, summaries, open problems, and the multi-service stack needed to keep them connected.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => goTo(0)} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                Restart
              </button>
              <button type="button" onClick={() => goTo(8)} className="rounded-full border border-white/12 bg-black/12 px-5 py-3 text-sm font-semibold text-white">
                Back to stack
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
      const now = Date.now();
      if (now - wheelLockRef.current < 800) return;
      if (Math.abs(event.deltaY) < 26) return;
      wheelLockRef.current = now;
      if (event.deltaY > 0) goNext();
      else goPrev();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [goNext, goPrev, goTo]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#08111d] text-white"
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(72,187,255,0.20),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(251,191,36,0.18),transparent_22%),radial-gradient(circle_at_50%_82%,rgba(56,189,138,0.14),transparent_25%),linear-gradient(180deg,#08111d_0%,#0c1726_45%,#0f1c2a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <div className="absolute left-[9%] top-[10%] h-40 w-40 rounded-full border border-white/10" />
        <div className="absolute right-[12%] top-[18%] h-28 w-28 rounded-full border border-white/10" />
        <div className="absolute bottom-[18%] left-[24%] h-52 w-52 rounded-full border border-white/10" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-5 pb-2 pt-5 sm:px-8 lg:px-10">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
            Interactive whitepaper
          </div>
          <div className="mt-1 text-lg font-semibold text-white">Democracy Routes</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span>
            {String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <div className="hidden md:block">{activeSlide.label}</div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-86px)]">
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
                <div className={`h-12 w-[3px] rounded-full transition-all ${active ? "bg-white" : "bg-white/18 group-hover:bg-white/35"}`} />
              </button>
            );
          })}
        </aside>

        <div className="flex-1">
          {renderSlide(activeSlide.id, goTo, goNext)}
        </div>

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
                    ? "border-white bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)]"
                    : "border-white/12 bg-white/6 text-white/60 hover:border-white/30 hover:text-white"
                }`}
                aria-label={`Go to ${slide.label}`}
              >
                {index + 1}
              </button>
            );
          })}
        </aside>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center px-5">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-2 backdrop-blur">
          <button
            type="button"
            onClick={goPrev}
            disabled={activeIndex === 0}
            className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-35"
          >
            Previous
          </button>
          <div className="min-w-[220px] px-2 text-center text-xs uppercase tracking-[0.18em] text-white/55">
            {activeSlide.label}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={activeIndex === slides.length - 1}
            className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-35"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
