import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AboutPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      <section className="dr-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/80">
              <img
                src="/logo-120.png"
                alt="Democracy Routes logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                About
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">Democracy Routes</h1>
            </div>
          </div>
          {!session?.user ? (
            <Link href="/login" className="dr-button px-4 py-2 text-sm">
              Log in
            </Link>
          ) : null}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          Democracy Routes was created to make consultative and decision-making
          processes more inclusive and efficient. It organizes participation in
          synchronous Round Tables and asynchronous Routes, starting from a real
          problem and guiding people through structured collaboration.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Core idea
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            A problem becomes an opportunity.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            The platform decomposes complex issues into sub-problems, then organizes
            the right people to address each one.
          </p>
        </div>
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            How it works
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Round Tables feed Routes.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Every Round Table generates transcripts and documents that are linked to
            the broader Route, keeping the entire deliberation traceable.
          </p>
        </div>
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Talent alignment
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Match skills to problems.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Participants can be selected by skill, reputation, or sensitivity to a
            topic, improving focus and outcomes.
          </p>
        </div>
      </section>

      <section className="dr-card p-6">
        <h3 className="text-xl font-semibold text-slate-900">Who it serves</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Citizens & youth</p>
            <p className="mt-2 text-sm text-slate-600">
              A guided path for political participation, without requiring prior theory
              or institutional knowledge.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Institutions & policymakers</p>
            <p className="mt-2 text-sm text-slate-600">
              Structured routes channel public sentiment into actionable, transparent
              policy discussions.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Organizations & companies</p>
            <p className="mt-2 text-sm text-slate-600">
              Round Tables drive focused problem-solving with searchable transcripts
              and signed summaries.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Researchers & philosophers</p>
            <p className="mt-2 text-sm text-slate-600">
              Simulate decision-making systems and test new governance models.
            </p>
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <h3 className="text-xl font-semibold text-slate-900">Resources</h3>
        <p className="mt-2 text-sm text-slate-600">
          Read the full research documents behind Democracy Routes.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/resources/democracy-routes-whitepaper-2.0.pdf"
            target="_blank"
            rel="noreferrer noopener"
            download
            className="dr-button-outline px-4 py-2 text-sm"
          >
            Whitepaper
          </a>
          <a
            href="/resources/proof-of-political-power-2.pdf"
            target="_blank"
            rel="noreferrer noopener"
            download
            className="dr-button-outline px-4 py-2 text-sm"
          >
            PoPP
          </a>
        </div>
      </section>

      <section className="dr-card p-6">
        <h3 className="text-xl font-semibold text-slate-900">Principles</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Transparency over black boxes</p>
            <p className="mt-2 text-sm text-slate-600">
              AI supports the process, but every step is inspectable and traceable.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Security and integrity</p>
            <p className="mt-2 text-sm text-slate-600">
              The roadmap includes blockchain-backed integrity to prevent tampering.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Human creativity first</p>
            <p className="mt-2 text-sm text-slate-600">
              AI augments human judgment while preserving human sensitivity.
            </p>
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Join the next session
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to create a meeting or explore public templates in your dataspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/login" className="dr-button px-4 py-2 text-sm">
              Log in
            </Link>
            <Link href="/register" className="dr-button-outline px-4 py-2 text-sm">
              Create account
            </Link>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-200/70 pt-4 text-xs text-slate-500">
          Done by Alessandro Oppo ·{" "}
          <a
            href="https://alexoppo.com"
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-slate-700 hover:text-slate-900"
          >
            alexoppo.com
          </a>
        </div>
      </section>
    </div>
  );
}
