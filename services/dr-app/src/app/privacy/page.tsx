export const metadata = {
  title: "Privacy Policy - Democracy Routes"
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-600">Last updated: February 28, 2026</p>
      </div>

      <div className="dr-card p-6 space-y-4 text-sm text-slate-700">
        <p>
          This Privacy Policy explains how Democracy Routes ("we", "us", "our") collects, uses, and
          shares personal data when you use our website and services (the "Service").
        </p>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">1. Controller</h2>
          <p className="mt-2">
            Democracy Routes, [registered address]. Contact: privacy@democracyroutes.com.
          </p>
          <p className="mt-1">
            If you have appointed a Data Protection Officer, include DPO contact details here.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">2. Data we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account data: email, password hash, role, profile settings, authentication tokens.</li>
            <li>Participation data: meeting and template participation, invites, room assignments.</li>
            <li>Content data: transcripts, notes, prompts, uploaded files, and text imports.</li>
            <li>Technical data: IP address, device and browser metadata, logs, usage analytics.</li>
            <li>Analytics data (if enabled and consented): page views, referrer, device/browser, anonymized usage patterns.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">3. Purposes and legal bases</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Provide and operate the Service (contract).</li>
            <li>Account administration, security, and fraud prevention (legitimate interests).</li>
            <li>Communications such as invitations and notifications (legitimate interests or consent).</li>
            <li>Compliance with legal obligations (legal obligation).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">4. Sharing and processors</h2>
          <p className="mt-2">
            We may share data with service providers who process data on our behalf (hosting,
            email delivery, transcription services, analytics). We only share what is necessary and
            require appropriate safeguards in our contracts with processors.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">5. International transfers</h2>
          <p className="mt-2">
            If data is transferred outside your jurisdiction, we use appropriate safeguards such as
            Standard Contractual Clauses or other lawful mechanisms.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">6. Retention</h2>
          <p className="mt-2">
            We retain data for as long as necessary to provide the Service, comply with legal
            obligations, and resolve disputes. Specific retention periods may vary by data type.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">7. Your rights</h2>
          <p className="mt-2">
            Depending on your location, you may have rights to access, correct, delete, or port your
            data, and to object or restrict processing. You may also withdraw consent where processing
            is based on consent.
          </p>
          <p className="mt-1">
            To exercise your rights, contact privacy@democracyroutes.com. We may need to verify your identity.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">8. Security</h2>
          <p className="mt-2">
            We implement technical and organizational measures to protect personal data. No method of
            transmission or storage is 100% secure.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">9. Cookies</h2>
          <p className="mt-2">
            We use cookies and similar technologies. See the{" "}
            <a href="/cookies" className="font-semibold underline">Cookie Policy</a>{" "}
            for details.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">10. Changes</h2>
          <p className="mt-2">
            We may update this policy periodically. We will post updates on this page and revise the
            "Last updated" date.
          </p>
        </div>
      </div>
    </div>
  );
}
