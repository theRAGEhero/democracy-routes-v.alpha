import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const participants = [
  "Ale (Original Poster)",
  "Professor Mario (Urban Planning Expert)",
  "Carlo (Philosophy Student)",
  "Giulia (Environment and Public Green Spaces Activist)",
  "Maria (PhD Student in Psychology, focusing on environment and mental health)"
];

const conversation = [
  {
    speaker: "System",
    text: "Hello Ale, what are your thoughts?"
  },
  {
    speaker: "Ale",
    text: "I feel like there aren’t enough public parks in Bologna, the city where I live."
  },
  {
    speaker: "System",
    text: "How does that make you feel? Do you feel angry or anxious about it?"
  },
  {
    speaker: "Ale",
    text: "I feel sad because I’d really like to walk in a park in the evenings, but it's too far away."
  },
  {
    speaker: "System",
    text: "I want to help, but it won’t be easy. I will organize a Round Table with Professor Mario, Carlo, and Giulia. Are you available on September 15 at 2:00 PM?"
  },
  {
    speaker: "Ale",
    text: "The 15th works for me. Could you also include someone who studied psychology? I think many people might fall into depression without access to natural areas."
  },
  {
    speaker: "System",
    text: "That makes sense. I’ll invite Maria, who is doing her PhD in psychology, focusing on the relationship between environment and mental health."
  },
  {
    speaker: "Ale",
    text: "Sure. Let's proceed."
  }
];

const roundTableHighlights = [
  "Ale describes frustration and sadness because green areas are too far away for regular evening walks.",
  "Giulia frames the issue as a real public concern already visible in environmental activism.",
  "Maria brings research linking access to green areas with lower stress and better mental health.",
  "Mario explains that Bologna’s urban plan is outdated and that new parks are constrained by budgets and planning complexity.",
  "Carlo questions whether the economic cost of depression may be higher than the cost of creating more green areas."
];

const summaryPoints = [
  "Ale feels sad due to the lack of public parks in Bologna.",
  "Maria confirms that poor environments can contribute to depression.",
  "Carlo suggests the social cost of depression may exceed the cost of creating new parks.",
  "Mario explains the outdated urban plan and the high costs of creating new parks."
];

const subProblems = [
  "Ale’s personal problem: feeling sad due to lack of green areas.",
  "Depression in Bologna: is it related to the absence of green areas?",
  "Public funding: why isn’t there enough money?",
  "New urban planning: propose a plan with more green zones to be sent to the Mayor."
];

export default async function UseCasesPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      <section className="dr-card overflow-hidden">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Use Case
            </p>
            <h1
              className="mt-3 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Public Green Areas in Bologna
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              A resident raises a concrete civic problem: public green areas are too far away
              to support everyday wellbeing. Democracy Routes turns that frustration into a
              structured Route, invites relevant participants, records the conversation, and
              extracts sub-problems for further action.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {session?.user ? (
                <Link href="/dashboard" className="dr-button px-5 py-2 text-sm">
                  Go to app
                </Link>
              ) : (
                <>
                  <Link href="/login" className="dr-button px-5 py-2 text-sm">
                    Log in
                  </Link>
                  <Link href="/register" className="dr-button-outline px-5 py-2 text-sm">
                    Create account
                  </Link>
                </>
              )}
              <Link href="/about" className="dr-button-outline px-5 py-2 text-sm">
                About Democracy Routes
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Scenario
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Ale previously lived in a hilly area with abundant nature. In Bologna, the
              nearest park is around 25 minutes away. The lack of nearby public green areas
              affects the ability to relax, walk, and exercise, and raises a wider civic
              question about public health and urban design.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Route</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Public Green Areas in Bologna
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Round Table 1</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  September 15, 2024 at 2:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Participants
          </p>
          <div className="mt-4 space-y-3">
            {participants.map((participant) => (
              <div
                key={participant}
                className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-700"
              >
                {participant}
              </div>
            ))}
          </div>
        </div>

        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Initial conversation
          </p>
          <div className="mt-4 space-y-3">
            {conversation.map((item, index) => (
              <div
                key={`${item.speaker}-${index}`}
                className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.speaker}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Route generated by the system
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              From complaint to organized deliberation
            </h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            Example output
          </span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5">
            <p className="text-sm font-semibold text-slate-900">Description</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The user believes that Bologna lacks sufficient public parks, which could
              contribute to depression and reduced wellbeing among residents.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5">
            <p className="text-sm font-semibold text-slate-900">System note</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              If invited members are unavailable, other participants can be selected until
              all seats are filled.
            </p>
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Invitation email
        </p>
        <div className="mt-4 rounded-3xl border border-slate-200/70 bg-[#faf8f2] p-5 text-sm leading-relaxed text-slate-700">
          <p>Dear [Recipient],</p>
          <p className="mt-3">
            Due to your expertise and interest, you have been selected to participate in the
            following event:
          </p>
          <p className="mt-3 font-semibold text-slate-900">
            Route: Public Green Areas in Bologna
          </p>
          <p className="mt-2">
            Description: The user believes that Bologna lacks sufficient public parks, which
            could lead to depression among residents.
          </p>
          <p className="mt-3">Participants:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {participants.map((participant) => (
              <li key={participant}>{participant}</li>
            ))}
          </ul>
          <p className="mt-3">Round Table 1: 15th of September 2024 at THIS link.</p>
          <p className="mt-3">
            If you want to participate, click CONFIRM HERE. If you cannot participate but
            want to follow the Route, click SUBSCRIBE HERE.
          </p>
          <p className="mt-3">Best Regards,</p>
          <p>Democracy Route</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Round Table 1
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Main discussion points
          </h2>
          <div className="mt-4 space-y-3">
            {roundTableHighlights.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm leading-relaxed text-slate-700"
              >
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Post-meeting outcome
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Summary and validation loop
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            After the meeting, recording, transcription, and summary are shared back with
            participants. They can confirm the summary or ask for corrections before the
            Round Table is published.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Final summary</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {summaryPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Next round suggestions</p>
            <p className="mt-2">
              Maria suggests involving psychologists to define the cost of depression.
              Carlo suggests involving an economist to clarify the cost structure.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Everything is saved and published with a final integrity hash.
            </p>
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Problem segmentation
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Sub-problems generated for the next Route steps
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {subProblems.map((problem) => (
            <div
              key={problem}
              className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm leading-relaxed text-slate-700"
            >
              {problem}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
