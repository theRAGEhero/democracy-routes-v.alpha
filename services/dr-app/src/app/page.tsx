import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const ink = "var(--ink)";
  const muted = "var(--muted)";
  const stroke = "var(--stroke)";
  const accent = "var(--accent)";
  const mint = "var(--mint)";

  return (
    <div className="space-y-8">
      <section className="dr-card overflow-hidden">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10 lg:py-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white/80" style={{ border: `1px solid color-mix(in srgb, ${mint} 35%, white)` }}>
                <img
                  src="/logo-120.png"
                  alt="Democracy Routes logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <p
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{
                  border: `1px solid color-mix(in srgb, ${accent} 26%, white)`,
                  background: `color-mix(in srgb, ${accent} 12%, white)`,
                  color: accent
                }}
              >
                Democracy Routes
              </p>
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: ink }}>
              Your digital path to democracy.
            </h1>
            <p className="max-w-xl text-base leading-relaxed" style={{ color: muted }}>
              We create the future looking at the past. The present is now. Democracy Routes
              organizes participation in synchronous Round Tables and asynchronous Routes,
              guiding communities through problem-focused collaboration.
            </p>
            <div className="flex flex-wrap items-center gap-3">
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
              <Link href="/about" className="text-sm font-semibold transition hover:opacity-80" style={{ color: muted }}>
                Learn more →
              </Link>
            </div>
            <p className="text-xs" style={{ color: muted }}>
              Guest access is supported when you are invited to a meeting or plan.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)]" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: muted }}>
                What you can do
              </p>
              <h2 className="mt-2 text-2xl font-semibold" style={{ color: ink }}>
                From Round Tables to complete Routes
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/80 p-4" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
                  <p className="text-sm font-semibold" style={{ color: ink }}>Round Tables</p>
                  <p className="mt-2 text-xs" style={{ color: muted }}>
                    Host focused discussions with live transcription and signed summaries.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
                  <p className="text-sm font-semibold" style={{ color: ink }}>Routes</p>
                  <p className="mt-2 text-xs" style={{ color: muted }}>
                    Chain multiple Round Tables to solve complex problems step by step.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
                  <p className="text-sm font-semibold" style={{ color: ink }}>Participant matching</p>
                  <p className="mt-2 text-xs" style={{ color: muted }}>
                    Select participants by skills, reputation, or sensitivity to the topic.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
                  <p className="text-sm font-semibold" style={{ color: ink }}>Traceable outputs</p>
                  <p className="mt-2 text-xs" style={{ color: muted }}>
                    Keep inputs, transcripts, and decisions linked for accountability.
                  </p>
                </div>
              </div>
              <div
                className="mt-4 rounded-2xl p-4 text-xs"
                style={{
                  border: `1px solid color-mix(in srgb, ${mint} 26%, white)`,
                  background: `color-mix(in srgb, ${mint} 10%, white)`,
                  color: muted
                }}
              >
                The platform is designed to avoid black-box AI by keeping every step
                inspectable, with clear provenance for discussions and decisions.
              </div>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
                Resources
              </p>
              <p className="mt-2 text-sm" style={{ color: muted }}>
                Read the theory, explore the model, or join the beta community.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href="/api/resources/download/whitepaper"
                  target="_blank"
                  rel="noreferrer noopener"
                  download
                  className="dr-button-outline px-4 py-2 text-center text-sm"
                >
                  Whitepaper
                </a>
                <a
                  href="/api/resources/download/popp"
                  target="_blank"
                  rel="noreferrer noopener"
                  download
                  className="dr-button-outline px-4 py-2 text-center text-sm"
                >
                  PoPP
                </a>
              </div>
              <div className="mt-3">
                <a
                  href="https://github.com/theRAGEhero/democracy-routes-v.alpha"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center text-sm font-semibold transition hover:opacity-80"
                  style={{ color: muted }}
                >
                  GitHub repository →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
            Problem first
          </p>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: ink }}>
            Start from a real issue, then decompose it.
          </h3>
          <p className="mt-2 text-sm" style={{ color: muted }}>
            Routes break down problems into sub-problems and create focused discussions
            that keep momentum.
          </p>
        </div>
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
            Transparent by design
          </p>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: ink }}>
            AI assists without hiding the logic.
          </h3>
          <p className="mt-2 text-sm" style={{ color: muted }}>
            Every action is tracked, with transcripts, summaries, and inputs available for review.
          </p>
        </div>
        <div className="dr-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
            Built for many contexts
          </p>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: ink }}>
            Youth, citizens, institutions, and teams.
          </h3>
          <p className="mt-2 text-sm" style={{ color: muted }}>
            Support civic participation, policy design, and organizational problem-solving.
          </p>
        </div>
      </section>

      <section className="dr-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
              We explore possibilities
            </p>
            <h3 className="mt-2 text-2xl font-semibold" style={{ color: ink }}>
              Our software is made for...
            </h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: muted }}>
              <li>Institutions</li>
              <li>Schools and universities</li>
              <li>Associations</li>
            </ul>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/use-cases"
              className="dr-button px-5 py-2 text-sm"
            >
              Case study
            </Link>
          </div>
        </div>
      </section>

      <section className="dr-card p-6">
        <h3 className="text-2xl font-semibold" style={{ color: ink }}>FAQs</h3>
        <div className="mt-4 space-y-3 text-sm" style={{ color: muted }}>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              What is Democracy Routes?
            </summary>
            <p className="mt-2">
              Democracy Routes is software designed to make consultative and decision-making
              processes more inclusive and efficient, bridging citizens and institutions.
            </p>
          </details>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              Who can benefit from using Democracy Routes?
            </summary>
            <p className="mt-2">
              Youth, citizens, decision-makers, and researchers can use the platform to
              understand, participate in, and analyze democratic processes.
            </p>
          </details>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              What are the key features?
            </summary>
            <p className="mt-2">
              Structured decision pathways, AI-assisted guidance, and data integrity tools
              that keep deliberations transparent and traceable.
            </p>
          </details>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              How does it avoid the AI “black box” problem?
            </summary>
            <p className="mt-2">
              AI is used as a transparent, controlled tool. Each step is tracked and can be
              reviewed and analyzed.
            </p>
          </details>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              How does blockchain enhance integrity?
            </summary>
            <p className="mt-2">
              The roadmap includes blockchain-backed records to prevent tampering and preserve
              an immutable history of decisions.
            </p>
          </details>
          <details className="rounded-2xl bg-white/70 px-4 py-3" style={{ border: `1px solid color-mix(in srgb, ${stroke} 90%, white)` }}>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: ink }}>
              Can it be integrated into existing platforms?
            </summary>
            <p className="mt-2">
              Yes. Democracy Routes is designed to integrate with institutional and
              organizational websites and applications.
            </p>
          </details>
        </div>
      </section>

      <section className="dr-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: ink }}>
              Ready to start a new collaboration?
            </h3>
            <p className="mt-2 text-sm" style={{ color: muted }}>
              Sign in to launch meetings, design templates, and invite participants.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {session?.user ? (
              <Link href="/dashboard" className="dr-button px-5 py-2 text-sm">
                Open app
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
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4 border-t border-slate-200/70 pt-5 text-xs text-slate-500">
          <img
            src="/logo-idea.webp"
            alt="Democracy Routes tree illustration"
            className="h-14 w-14 rounded-2xl border border-slate-200/70 object-cover"
          />
          <p>
            A shared visual language for civic collaboration: roots, branches, and
            pathways for inclusive decision-making.
          </p>
        </div>
      </section>
    </div>
  );
}
