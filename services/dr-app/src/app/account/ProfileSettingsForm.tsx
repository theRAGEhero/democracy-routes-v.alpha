"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_THEME_OPTIONS, type AppTheme } from "@/lib/appTheme";

type Props = {
  userEmail: string;
  initialTelegramHandle: string;
  initialPersonalDescription: string;
  initialCalComLink: string;
  initialWebsiteUrl: string;
  initialXUrl: string;
  initialBlueskyUrl: string;
  initialLinkedinUrl: string;
  initialFediverseUrl: string;
  initialAvatarUrl: string;
  initialAppTheme: AppTheme;
  initialNotifyEmailMeetingInvites: boolean;
  initialNotifyTelegramMeetingInvites: boolean;
  initialNotifyEmailPlanInvites: boolean;
  initialNotifyTelegramPlanInvites: boolean;
  initialNotifyEmailDataspaceInvites: boolean;
  initialNotifyTelegramDataspaceInvites: boolean;
  initialNotifyEmailDataspaceActivity: boolean;
  initialNotifyTelegramDataspaceActivity: boolean;
};

function Section({
  id,
  badge,
  title,
  description,
  children
}: {
  id: string;
  badge: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-[32px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/95 p-6 shadow-[0_20px_56px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div className="mb-6">
        <span className="inline-flex rounded-full border border-[color:var(--stroke)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
          {badge}
        </span>
        <h2
          className="mt-3 text-2xl font-semibold text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[color:var(--ink)]">{label}</span>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">{hint}</p> : null}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`dr-input w-full rounded-2xl border border-[color:var(--stroke)] bg-white/90 px-4 py-3 text-sm shadow-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/15 ${props.className ?? ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`dr-input w-full rounded-2xl border border-[color:var(--stroke)] bg-white/90 px-4 py-3 text-sm shadow-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/15 ${props.className ?? ""}`}
    />
  );
}

function ToggleCard({
  title,
  hint,
  checked,
  onChange,
  disabled = false
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-[24px] border px-4 py-4 transition ${
        disabled
          ? "border-slate-200 bg-slate-50 text-slate-400"
          : "border-[color:var(--stroke)] bg-white/90 hover:border-[color:var(--accent)]/35"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[color:var(--ink)]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[color:var(--muted)]">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0"
      />
    </label>
  );
}

function PreviewPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[color:var(--stroke)] bg-white/90 px-3 py-1 text-[11px] font-medium text-[color:var(--muted)]">
      {label}
    </span>
  );
}

export function ProfileSettingsForm({
  userEmail,
  initialTelegramHandle,
  initialPersonalDescription,
  initialCalComLink,
  initialWebsiteUrl,
  initialXUrl,
  initialBlueskyUrl,
  initialLinkedinUrl,
  initialFediverseUrl,
  initialAvatarUrl,
  initialAppTheme,
  initialNotifyEmailMeetingInvites,
  initialNotifyTelegramMeetingInvites,
  initialNotifyEmailPlanInvites,
  initialNotifyTelegramPlanInvites,
  initialNotifyEmailDataspaceInvites,
  initialNotifyTelegramDataspaceInvites,
  initialNotifyEmailDataspaceActivity,
  initialNotifyTelegramDataspaceActivity
}: Props) {
  const router = useRouter();
  const [telegramHandle, setTelegramHandle] = useState(initialTelegramHandle);
  const [personalDescription, setPersonalDescription] = useState(initialPersonalDescription);
  const [calComLink, setCalComLink] = useState(initialCalComLink);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [xUrl, setXUrl] = useState(initialXUrl);
  const [blueskyUrl, setBlueskyUrl] = useState(initialBlueskyUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl);
  const [fediverseUrl, setFediverseUrl] = useState(initialFediverseUrl);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [appTheme, setAppTheme] = useState<AppTheme>(initialAppTheme);
  const [notifyEmailMeetingInvites, setNotifyEmailMeetingInvites] = useState(initialNotifyEmailMeetingInvites);
  const [notifyTelegramMeetingInvites, setNotifyTelegramMeetingInvites] = useState(initialNotifyTelegramMeetingInvites);
  const [notifyEmailPlanInvites, setNotifyEmailPlanInvites] = useState(initialNotifyEmailPlanInvites);
  const [notifyTelegramPlanInvites, setNotifyTelegramPlanInvites] = useState(initialNotifyTelegramPlanInvites);
  const [notifyEmailDataspaceInvites, setNotifyEmailDataspaceInvites] = useState(initialNotifyEmailDataspaceInvites);
  const [notifyTelegramDataspaceInvites, setNotifyTelegramDataspaceInvites] = useState(initialNotifyTelegramDataspaceInvites);
  const [notifyEmailDataspaceActivity, setNotifyEmailDataspaceActivity] = useState(initialNotifyEmailDataspaceActivity);
  const [notifyTelegramDataspaceActivity, setNotifyTelegramDataspaceActivity] = useState(initialNotifyTelegramDataspaceActivity);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);

  const themeOption = APP_THEME_OPTIONS.find((option) => option.value === appTheme);
  const visibleLinks = [
    websiteUrl ? "Website" : null,
    xUrl ? "X" : null,
    blueskyUrl ? "Bluesky" : null,
    linkedinUrl ? "LinkedIn" : null,
    fediverseUrl ? "Fediverse" : null,
    calComLink ? "Cal.com" : null
  ].filter(Boolean) as string[];
  const publicName = telegramHandle.trim() ? `@${telegramHandle.trim()}` : userEmail;

  const profileScore = useMemo(() => {
    const checks = [
      Boolean(avatarUrl.trim()),
      Boolean(personalDescription.trim()),
      Boolean(telegramHandle.trim()),
      Boolean(visibleLinks.length),
      Boolean(themeOption)
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [avatarUrl, personalDescription, telegramHandle, visibleLinks.length, themeOption]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramHandle,
        personalDescription,
        calComLink,
        websiteUrl,
        xUrl,
        blueskyUrl,
        linkedinUrl,
        fediverseUrl,
        avatarUrl,
        appTheme,
        notifyEmailMeetingInvites,
        notifyTelegramMeetingInvites,
        notifyEmailPlanInvites,
        notifyTelegramPlanInvites,
        notifyEmailDataspaceInvites,
        notifyTelegramDataspaceInvites,
        notifyEmailDataspaceActivity,
        notifyTelegramDataspaceActivity
      })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update profile");
      return;
    }

    setTelegramCode(payload?.telegramVerificationCode ?? null);
    setMessage("Profile updated");
    router.refresh();
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return;

    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/uploads/avatars", {
        method: "POST",
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadError(payload?.error ?? "Unable to upload image");
        return;
      }

      setAvatarUrl(payload?.url ?? "");
      setSelectedFile(null);
    } catch {
      setUploadError("Unable to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-[34px] border border-[color:var(--stroke)] bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(250,250,250,0.92))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-slate-100 shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">No photo</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Public profile
              </p>
              <h2 className="mt-2 truncate text-lg font-semibold text-[color:var(--ink)]">{publicName}</h2>
              <p className="mt-1 truncate text-sm text-[color:var(--muted)]">{userEmail}</p>
            </div>
          </div>
          <div className="mt-5 rounded-[24px] border border-[color:var(--stroke)] bg-white/85 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Profile readiness
              </span>
              <span className="text-sm font-semibold text-[color:var(--ink)]">{profileScore}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--mint),#f59e0b)]"
                style={{ width: `${profileScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
              Add a photo, description, Telegram handle, and a few links so your profile is useful across the app.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <PreviewPill label={themeOption?.label ?? "Theme"} />
            <PreviewPill label={telegramHandle.trim() ? "Telegram ready" : "Telegram missing"} />
            {visibleLinks.slice(0, 3).map((label) => (
              <PreviewPill key={label} label={label} />
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
            {personalDescription.trim() || "Add a short public description so collaborators understand who you are."}
          </p>
        </div>

        <div className="rounded-[30px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Jump to</p>
          <nav className="mt-4 space-y-2">
            <a href="#public-profile" className="block rounded-2xl border border-[color:var(--stroke)] bg-white/80 px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              Public profile
            </a>
            <a href="#links" className="block rounded-2xl border border-[color:var(--stroke)] bg-white/80 px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              Links and contact
            </a>
            <a href="#appearance" className="block rounded-2xl border border-[color:var(--stroke)] bg-white/80 px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              App appearance
            </a>
            <a href="#notifications" className="block rounded-2xl border border-[color:var(--stroke)] bg-white/80 px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
              Notifications
            </a>
          </nav>
        </div>

        <div className="rounded-[30px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Save</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Profile, links, theme, and delivery preferences.</p>
            </div>
            {message ? <span className="text-xs font-medium text-emerald-700">Saved</span> : null}
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          {telegramCode ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Telegram verification code: <span className="font-semibold">{telegramCode}</span>
            </div>
          ) : null}
          <button
            type="submit"
            className="dr-button mt-4 w-full rounded-2xl px-4 py-3 text-sm"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </aside>

      <div className="space-y-6">
        <Section
          id="public-profile"
          badge="Public profile"
          title="How you appear across Democracy Routes"
          description="This is the identity other people see in meetings, profiles, and shared workspaces."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]">
            <div className="space-y-5">
              <Field label="Personal description" hint="Shown on your public profile and in places where people inspect your profile.">
                <TextArea
                  rows={6}
                  value={personalDescription}
                  onChange={(event) => setPersonalDescription(event.target.value)}
                  maxLength={1200}
                  placeholder="Describe what you work on, what you care about, or how you want to be understood."
                />
                <div className="mt-2 text-right text-xs text-[color:var(--muted)]">
                  {personalDescription.length}/1200
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Telegram handle" hint="Stored without the @ symbol and used for Telegram notifications.">
                  <TextInput
                    value={telegramHandle}
                    onChange={(event) => setTelegramHandle(event.target.value)}
                    placeholder="username"
                  />
                </Field>
                <Field label="Cal.com link" hint="Optional scheduling link for people who want to book time with you.">
                  <TextInput
                    value={calComLink}
                    onChange={(event) => setCalComLink(event.target.value)}
                    placeholder="https://cal.com/your-name"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-[28px] border border-[color:var(--stroke)] bg-white/85 p-5">
              <p className="text-sm font-semibold text-[color:var(--ink)]">Photo and preview</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Your avatar appears in the app menu, public profile, and call surfaces.
              </p>
              <div className="mt-5 flex items-start gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[color:var(--stroke)] bg-slate-100">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Profile photo URL" hint="You can paste a URL or upload a file below.">
                    <TextInput
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-5 rounded-[24px] border border-dashed border-[color:var(--stroke)] bg-[color:var(--surface)]/70 p-4">
                <p className="text-sm font-medium text-[color:var(--ink)]">Upload image</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                  <button
                    type="button"
                    className="dr-button-outline rounded-2xl px-4 py-2 text-sm"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? "Uploading..." : "Upload photo"}
                  </button>
                </div>
                {selectedFile ? <p className="mt-2 text-xs text-[color:var(--muted)]">Selected: {selectedFile.name}</p> : null}
                {uploadError ? <p className="mt-2 text-sm text-red-600">{uploadError}</p> : null}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="links"
          badge="Links and contact"
          title="Where people can find or reach you"
          description="Collect the links that make your public profile genuinely useful after a meeting, flow, or shared project."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Website" hint="Your personal site, organization page, or portfolio.">
              <TextInput
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://your-site.com"
              />
            </Field>
            <Field label="X account" hint="Paste the full profile URL.">
              <TextInput
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
                placeholder="https://x.com/your-name"
              />
            </Field>
            <Field label="Bluesky" hint="Paste the full Bluesky profile URL.">
              <TextInput
                value={blueskyUrl}
                onChange={(event) => setBlueskyUrl(event.target.value)}
                placeholder="https://bsky.app/profile/your-handle"
              />
            </Field>
            <Field label="LinkedIn" hint="Paste the full LinkedIn profile URL.">
              <TextInput
                value={linkedinUrl}
                onChange={(event) => setLinkedinUrl(event.target.value)}
                placeholder="https://linkedin.com/in/your-name"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Fediverse" hint="Profile URL for Mastodon or another fediverse account.">
                <TextInput
                  value={fediverseUrl}
                  onChange={(event) => setFediverseUrl(event.target.value)}
                  placeholder="https://mastodon.social/@your-handle"
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          id="appearance"
          badge="App experience"
          title="Choose how the product feels when you open it"
          description="Theme selection affects the app shell, dashboard, and internal work surfaces."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {APP_THEME_OPTIONS.map((option) => {
              const isSelected = appTheme === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col rounded-[28px] border p-5 transition ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:var(--surface)] shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                      : "border-[color:var(--stroke)] bg-white/85 hover:border-[color:var(--accent)]/35"
                  }`}
                >
                  <input
                    type="radio"
                    name="appTheme"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setAppTheme(option.value)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[color:var(--ink)]">{option.label}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{option.description}</p>
                    </div>
                    {isSelected ? (
                      <span className="rounded-full bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        Active
                      </span>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
        </Section>

        <Section
          id="notifications"
          badge="Notifications"
          title="Control how updates reach you"
          description="Choose email or Telegram delivery for invitations and dataspace activity. Telegram options remain disabled until a handle is set."
        >
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">Invitations</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <ToggleCard
                  title="Meeting invites by email"
                  hint="Receive direct meeting invitations in your inbox."
                  checked={notifyEmailMeetingInvites}
                  onChange={setNotifyEmailMeetingInvites}
                />
                <ToggleCard
                  title="Meeting invites by Telegram"
                  hint="Send meeting invitations to your Telegram account."
                  checked={notifyTelegramMeetingInvites}
                  onChange={setNotifyTelegramMeetingInvites}
                  disabled={!telegramHandle.trim()}
                />
                <ToggleCard
                  title="Template invites by email"
                  hint="Receive flow and template participation invites by email."
                  checked={notifyEmailPlanInvites}
                  onChange={setNotifyEmailPlanInvites}
                />
                <ToggleCard
                  title="Template invites by Telegram"
                  hint="Send flow and template participation invites to Telegram."
                  checked={notifyTelegramPlanInvites}
                  onChange={setNotifyTelegramPlanInvites}
                  disabled={!telegramHandle.trim()}
                />
                <ToggleCard
                  title="Dataspace invites by email"
                  hint="Receive dataspace invitations in email."
                  checked={notifyEmailDataspaceInvites}
                  onChange={setNotifyEmailDataspaceInvites}
                />
                <ToggleCard
                  title="Dataspace invites by Telegram"
                  hint="Send dataspace invitations to Telegram."
                  checked={notifyTelegramDataspaceInvites}
                  onChange={setNotifyTelegramDataspaceInvites}
                  disabled={!telegramHandle.trim()}
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">Dataspace activity</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <ToggleCard
                  title="New calls and templates by email"
                  hint="Get notified about fresh activity across your dataspaces by email."
                  checked={notifyEmailDataspaceActivity}
                  onChange={setNotifyEmailDataspaceActivity}
                />
                <ToggleCard
                  title="New calls and templates by Telegram"
                  hint="Receive dataspace activity on Telegram."
                  checked={notifyTelegramDataspaceActivity}
                  onChange={setNotifyTelegramDataspaceActivity}
                  disabled={!telegramHandle.trim()}
                />
              </div>
            </div>
          </div>
        </Section>

        <div className="rounded-[30px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] xl:hidden">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {telegramCode ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Telegram verification code: <span className="font-semibold">{telegramCode}</span>
            </div>
          ) : null}
          <button type="submit" className="dr-button w-full rounded-2xl px-4 py-3 text-sm" disabled={loading}>
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
