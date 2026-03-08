export const metadata = {
  title: "Cookie Policy - Democracy Routes"
};

export default function CookiePolicyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Cookie Policy
        </h1>
        <p className="text-sm text-slate-600">Last updated: February 28, 2026</p>
      </div>

      <div className="dr-card p-6 space-y-4 text-sm text-slate-700">
        <p>
          This Cookie Policy explains how Democracy Routes uses cookies and similar technologies.
        </p>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">1. What are cookies?</h2>
          <p className="mt-2">
            Cookies are small text files stored on your device that help websites function and
            remember preferences.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">2. Cookie categories</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Strictly necessary: required for login and security.</li>
            <li>Preferences: remember your settings (e.g., language, layout).</li>
            <li>Analytics: help us understand usage patterns.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">3. Cookie list</h2>
          <p className="mt-2">
            Below is a representative list of cookies currently used by the Service.
          </p>
          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
            <p>
              <strong>Auth session</strong>: <code>next-auth.session-token</code> or
              <code>__Secure-next-auth.session-token</code> (strictly necessary).
            </p>
            <p>
              <strong>CSRF protection</strong>: <code>next-auth.csrf-token</code> (strictly necessary).
            </p>
            <p>
              <strong>Callback URL</strong>: <code>next-auth.callback-url</code> (strictly necessary).
            </p>
            <p>
              <strong>Analytics</strong>: Matomo cookies (only if enabled and consented).
            </p>
            <p>
              <strong>dr_analytics_consent</strong>: stores your analytics choice (accept/reject).
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">4. Managing cookies</h2>
          <p className="mt-2">
            You can control cookies in your browser settings. Disabling some cookies may impact the
            Service’s functionality.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">5. Changes</h2>
          <p className="mt-2">
            We may update this policy from time to time. Updates will be posted on this page.
          </p>
        </div>
      </div>
    </div>
  );
}
