"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_THEME_OPTIONS, type AppTheme } from "@/lib/appTheme";

type Props = {
  initialTelegramHandle: string;
  initialPersonalDescription: string;
  initialCalComLink: string;
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

export function ProfileSettingsForm({
  initialTelegramHandle,
  initialPersonalDescription,
  initialCalComLink,
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
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [appTheme, setAppTheme] = useState<AppTheme>(initialAppTheme);
  const [notifyEmailMeetingInvites, setNotifyEmailMeetingInvites] = useState(
    initialNotifyEmailMeetingInvites
  );
  const [notifyTelegramMeetingInvites, setNotifyTelegramMeetingInvites] = useState(
    initialNotifyTelegramMeetingInvites
  );
  const [notifyEmailPlanInvites, setNotifyEmailPlanInvites] = useState(
    initialNotifyEmailPlanInvites
  );
  const [notifyTelegramPlanInvites, setNotifyTelegramPlanInvites] = useState(
    initialNotifyTelegramPlanInvites
  );
  const [notifyEmailDataspaceInvites, setNotifyEmailDataspaceInvites] = useState(
    initialNotifyEmailDataspaceInvites
  );
  const [notifyTelegramDataspaceInvites, setNotifyTelegramDataspaceInvites] = useState(
    initialNotifyTelegramDataspaceInvites
  );
  const [notifyEmailDataspaceActivity, setNotifyEmailDataspaceActivity] = useState(
    initialNotifyEmailDataspaceActivity
  );
  const [notifyTelegramDataspaceActivity, setNotifyTelegramDataspaceActivity] = useState(
    initialNotifyTelegramDataspaceActivity
  );
  const hasTelegram = telegramHandle.trim().length > 0;
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<"success" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);

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
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update profile";
      setError(message);
      return;
    }

    setTelegramCode(payload?.telegramVerificationCode ?? null);
    setMessage("success");
    router.refresh();
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return;
    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/uploads/avatars", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error ?? "Unable to upload image";
        setUploadError(message);
        return;
      }
      setAvatarUrl(payload?.url ?? "");
    } catch (err) {
      setUploadError("Unable to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium">Profile photo URL</label>
        <input
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="https://example.com/avatar.png"
        />
        <p className="mt-1 text-xs text-slate-500">Used across your profile and call pages.</p>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-slate-100 text-sm font-semibold text-slate-500 shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              "No photo"
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Profile photo preview</p>
            <p className="text-xs text-slate-500">
              This is how your avatar appears in the app menu and public profile.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="text-xs text-slate-600"
          />
          <button
            type="button"
            onClick={handleUpload}
            className="dr-button-outline px-3 py-1 text-xs"
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {uploadError ? <p className="mt-2 text-xs text-red-600">{uploadError}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium">App theme</label>
        <select
          value={appTheme}
          onChange={(event) => setAppTheme(event.target.value as AppTheme)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
        >
          {APP_THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {APP_THEME_OPTIONS.find((option) => option.value === appTheme)?.description}
        </p>
      </div>
      <div>
        <label className="text-sm font-medium">Telegram handle</label>
        <input
          value={telegramHandle}
          onChange={(event) => setTelegramHandle(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="@username"
        />
        <p className="mt-1 text-xs text-slate-500">We store it without the @ symbol.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Personal description</label>
        <textarea
          value={personalDescription}
          onChange={(event) => setPersonalDescription(event.target.value)}
          className="dr-input mt-1 min-h-[120px] w-full rounded px-3 py-2 text-sm"
          placeholder="Tell others who you are, what you work on, or what perspective you bring."
          maxLength={1200}
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Shown on your profile when user profiles are opened.</span>
          <span>{personalDescription.length}/1200</span>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Cal.com link</label>
        <input
          value={calComLink}
          onChange={(event) => setCalComLink(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          placeholder="https://cal.com/yourname"
        />
        <p className="mt-1 text-xs text-slate-500">Optional scheduling link.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Notification preferences
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Choose what you receive by email or Telegram.
        </p>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Invites</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyEmailMeetingInvites}
                  onChange={(event) => setNotifyEmailMeetingInvites(event.target.checked)}
                />
                Meeting invites by email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyTelegramMeetingInvites}
                  onChange={(event) => setNotifyTelegramMeetingInvites(event.target.checked)}
                  disabled={!hasTelegram}
                />
                Meeting invites by Telegram
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyEmailPlanInvites}
                  onChange={(event) => setNotifyEmailPlanInvites(event.target.checked)}
                />
                Template invites by email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyTelegramPlanInvites}
                  onChange={(event) => setNotifyTelegramPlanInvites(event.target.checked)}
                  disabled={!hasTelegram}
                />
                Template invites by Telegram
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyEmailDataspaceInvites}
                  onChange={(event) => setNotifyEmailDataspaceInvites(event.target.checked)}
                />
                Dataspace invites by email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyTelegramDataspaceInvites}
                  onChange={(event) => setNotifyTelegramDataspaceInvites(event.target.checked)}
                  disabled={!hasTelegram}
                />
                Dataspace invites by Telegram
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Dataspace activity</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyEmailDataspaceActivity}
                  onChange={(event) => setNotifyEmailDataspaceActivity(event.target.checked)}
                />
                New calls/templates by email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyTelegramDataspaceActivity}
                  onChange={(event) => setNotifyTelegramDataspaceActivity(event.target.checked)}
                  disabled={!hasTelegram}
                />
                New calls/templates by Telegram
              </label>
            </div>
            {!hasTelegram ? (
              <p className="mt-2 text-xs text-slate-500">
                Add your Telegram handle above to enable Telegram delivery.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {message ? (
        <p className="text-sm text-emerald-600">
          Settings updated.
          {telegramCode ? (
            <>
              <br />
              Send this code to{" "}
              <a
                href="https://t.me/democracyRoutes_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                @democracyRoutes_bot
              </a>{" "}
              to verify your Telegram account:
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {telegramCode}
              </span>
            </>
          ) : (
            <>
              <br />
              Please message{" "}
              <a
                href="https://t.me/democracyRoutes_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline"
              >
                @democracyRoutes_bot
              </a>{" "}
              to connect notifications.
            </>
          )}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
