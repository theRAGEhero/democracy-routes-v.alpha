import Link from "next/link";

const quickLinks = [
  { label: "Create a dataspace", href: "/dataspace", tone: "primary" },
  { label: "Build a template", href: "/modular", tone: "outline" },
  { label: "Create a meeting", href: "/meetings/new", tone: "outline" },
  { label: "Go to dashboard", href: "/dashboard", tone: "outline" }
];

const journeySteps = [
  {
    title: "Define the purpose",
    description:
      "Clarify the outcome you want from the session: consensus, idea generation, conflict mediation, or community alignment."
  },
  {
    title: "Create a dataspace",
    description:
      "Dataspaces group related meetings, templates, and texts. They also carry a color identity and notification rules."
  },
  {
    title: "Design the template",
    description:
      "Templates are structured agendas. Use rounds, prompts, notes, embedded content, and matching when you want new pairings."
  },
  {
    title: "Launch the meeting",
    description:
      "Meetings are live calls tied to a dataspace. Invite members, guests, or schedule in advance."
  },
  {
    title: "Capture transcripts",
    description:
      "With Deepgram Live, transcription starts automatically. Use it in real time and for recap analysis."
  },
  {
    title: "Review the recap",
    description:
      "After the session, review transcripts, notes, and AI analysis to plan the next iteration."
  }
];

const templateBlocks = [
  {
    title: "Round",
    body: "Pairs or small groups talk live. The core of every session."
  },
  {
    title: "Matching",
    body: "Re-group participants using polarizing or anti-polarizing logic."
  },
  {
    title: "Prompt or Note",
    body: "Gather written responses, reflections, or decisions."
  },
  {
    title: "Embed",
    body: "Show a video, whiteboard, or shared resource inside the flow."
  },
  {
    title: "Meditation or Pause",
    body: "Create space for reflection before the next round."
  }
];

const roles = [
  {
    title: "Organizer",
    body: "Creates dataspaces, templates, and meetings. Controls the plan flow and matching."
  },
  {
    title: "Facilitator",
    body: "Guides the conversation, watches the live transcript, and keeps time."
  },
  {
    title: "Participant",
    body: "Joins calls, contributes text responses, and appears in recap summaries."
  }
];

const bestPractices = [
  "Keep rounds short, then increase duration only if energy is strong.",
  "Use matching after 1–2 rounds, not at the beginning.",
  "Keep prompts specific and outcome-oriented.",
  "Make a recap habit: review transcripts immediately after the session.",
  "Use a dataspace color to visually unify related work."
];

const troubleshooting = [
  {
    title: "Camera or mic not showing",
    body: "Check browser permissions for democracyroutes.com and refresh the meeting page."
  },
  {
    title: "Transcripts missing in recap",
    body: "Wait until the round ends and use Refresh recap. Live transcripts finalize after the meeting."
  },
  {
    title: "Participants not matched",
    body: "Confirm the Matching block is inside the template and the session is active."
  }
];

export default function TutorialPage() {
  return (
    <div className="space-y-10">
      <section className="dr-card relative overflow-hidden p-6 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.15),transparent_55%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Democracy Routes Tutorial
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Build civic conversations with clarity and momentum
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-600">
            This tutorial maps the complete lifecycle of a Democracy Routes session: from planning in a dataspace,
            to live collaboration in meetings, to transcript-driven insights. Use it as a playbook.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={link.tone === "primary" ? "dr-button px-4 py-2 text-sm" : "dr-button-outline px-4 py-2 text-sm"}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Your session journey</h2>
          <p className="mt-2 text-sm text-slate-600">
            Follow this sequence to design and run a complete session. Each step builds on the previous one.
          </p>
          <div className="mt-6 space-y-4">
            {journeySteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Quick start checklist</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use this when you only have a few minutes before a session.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Create the dataspace and set a color.</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Pick a template from the library.</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Enable Deepgram Live for transcripts.</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Invite participants and start the meeting.</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">After the round, refresh recap and export notes.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Template builder essentials</h2>
          <p className="mt-2 text-sm text-slate-600">
            Modular templates let you mix rounds, prompts, and content. Keep the flow simple on the first iteration.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {templateBlocks.map((block) => (
              <div key={block.title} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">{block.title}</p>
                <p className="mt-2 text-sm text-slate-600">{block.body}</p>
              </div>
            ))}
          </div>
          <Link href="/modular" className="mt-6 inline-flex text-sm font-semibold text-slate-900 hover:underline">
            Open modular builder
          </Link>
        </div>

        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Meeting operations</h2>
          <p className="mt-2 text-sm text-slate-600">
            Meetings are live video calls embedded inside the platform. They inherit dataspace color and settings.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              Use instant meetings for ad-hoc sessions.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              Invite members and guests from the meeting page footer.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              Fullscreen is available directly from the embedded call controls.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              Meeting transcripts are stored and surfaced in plan recap after the call ends.
            </div>
          </div>
          <Link href="/meetings/new" className="mt-6 inline-flex text-sm font-semibold text-slate-900 hover:underline">
            Create a meeting
          </Link>
        </div>
      </section>

      <section className="dr-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Roles and responsibilities</h2>
        <p className="mt-2 text-sm text-slate-600">
          Clarity on roles prevents confusion. Decide this before you invite participants.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {roles.map((role) => (
            <div key={role.title} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-900">{role.title}</p>
              <p className="mt-2 text-sm text-slate-600">{role.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Best practices</h2>
          <p className="mt-2 text-sm text-slate-600">
            These patterns come from running civic sessions at scale.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {bestPractices.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="dr-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Troubleshooting</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quick fixes for the most common issues.
          </p>
          <div className="mt-5 space-y-3">
            {troubleshooting.map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dr-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Next steps</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ready to go live? Start with a small pilot, capture the transcript, and iterate the template.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/dataspace" className="dr-button px-4 py-2 text-sm">
            Start a dataspace
          </Link>
          <Link href="/modular" className="dr-button-outline px-4 py-2 text-sm">
            Build your template
          </Link>
          <Link href="/dashboard" className="dr-button-outline px-4 py-2 text-sm">
            Review the dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
