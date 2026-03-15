"use client";

import { useState } from "react";
import {
  DATASPACE_COLOR_OPTIONS,
  DEFAULT_DATASPACE_COLOR,
  normalizeHexColor
} from "@/lib/dataspaceColor";

type Props = {
  dataspaceId: string;
  initialName: string;
  initialDescription: string | null;
  initialColor: string | null;
  initialImageUrl: string | null;
  initialNotifyAllActivity: boolean;
  initialNotifyMeetings: boolean;
  initialNotifyPlans: boolean;
  initialNotifyTexts: boolean;
  initialRssEnabled: boolean;
  initialTelegramGroupChatId: string | null;
  initialTelegramGroupLinkCode: string | null;
};

export function DataspaceEditForm({
  dataspaceId,
  initialName,
  initialDescription,
  initialColor,
  initialImageUrl,
  initialNotifyAllActivity,
  initialNotifyMeetings,
  initialNotifyPlans,
  initialNotifyTexts,
  initialRssEnabled,
  initialTelegramGroupChatId,
  initialTelegramGroupLinkCode
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [color, setColor] = useState(
    normalizeHexColor(initialColor) ?? DEFAULT_DATASPACE_COLOR
  );
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [notifyAllActivity, setNotifyAllActivity] = useState(initialNotifyAllActivity);
  const [notifyMeetings, setNotifyMeetings] = useState(initialNotifyMeetings);
  const [notifyPlans, setNotifyPlans] = useState(initialNotifyPlans);
  const [notifyTexts, setNotifyTexts] = useState(initialNotifyTexts);
  const [rssEnabled, setRssEnabled] = useState(initialRssEnabled);
  const [telegramGroupChatId, setTelegramGroupChatId] = useState(
    initialTelegramGroupChatId
  );
  const [telegramGroupLinkCode, setTelegramGroupLinkCode] = useState(
    initialTelegramGroupLinkCode
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkingGroup, setLinkingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const response = await fetch(`/api/dataspaces/${dataspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        color,
        imageUrl,
        notifyAllActivity,
        notifyMeetings,
        notifyPlans,
        notifyTexts,
        rssEnabled
      })
    });

    const payload = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update dataspace";
      setError(message);
      return;
    }

    setSuccess(true);
    window.location.reload();
  }

  async function handleGenerateLinkCode() {
    setError(null);
    setLinkingGroup(true);
    try {
      const response = await fetch(`/api/dataspaces/${dataspaceId}/telegram-link`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error ?? "Unable to generate link code";
        setError(message);
        return;
      }
      setTelegramGroupChatId(null);
      setTelegramGroupLinkCode(payload?.code ?? null);
    } catch (err) {
      setError("Unable to generate link code");
    } finally {
      setLinkingGroup(false);
    }
  }

  async function handleImageUpload() {
    if (!imageFile || uploadingImage) return;
    setError(null);
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", imageFile);

    try {
      const response = await fetch("/api/uploads/dataspaces", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error ?? "Unable to upload image";
        setError(message);
        return;
      }
      setImageUrl(payload?.url ?? "");
    } catch (err) {
      setError("Unable to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="dr-card p-6">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Edit dataspace</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Profile image URL</label>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            placeholder="https://example.com/dataspace.png"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="text-xs text-slate-600"
            />
            <button
              type="button"
              onClick={handleImageUpload}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={!imageFile || uploadingImage}
            >
              {uploadingImage ? "Uploading..." : "Upload"}
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
        <div>
          <label className="text-sm font-medium">Color</label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {DATASPACE_COLOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setColor(option.value)}
                className={`h-8 w-8 rounded-full border ${color === option.value ? "border-slate-700" : "border-transparent"}`}
                style={{ backgroundColor: option.value }}
                aria-label={option.label}
                title={option.label}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white/70 p-1"
              aria-label="Custom color"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Notifications</label>
          <div className="mt-2 space-y-2 rounded border border-slate-200 bg-white/70 p-3 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyAllActivity}
                onChange={(event) => setNotifyAllActivity(event.target.checked)}
                className="h-4 w-4"
              />
              <span>Notify on all dataspace activity</span>
            </label>
            <div className="grid gap-2 pl-6 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyMeetings}
                  onChange={(event) => setNotifyMeetings(event.target.checked)}
                  className="h-3 w-3"
                />
                <span>New meetings created</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyPlans}
                  onChange={(event) => setNotifyPlans(event.target.checked)}
                  className="h-3 w-3"
                />
                <span>New templates created</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notifyTexts}
                  onChange={(event) => setNotifyTexts(event.target.checked)}
                  className="h-3 w-3"
                />
                <span>New text notes imported</span>
              </label>
            </div>
          </div>
        </div>
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Sharing</h3>
            <p className="mt-1 text-xs text-slate-500">
              Connect external channels where this dataspace can be shared or mirrored.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium">RSS feed</label>
                  <p className="mt-1 text-xs text-slate-500">
                    Publish dataspace activity as an RSS stream.
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold uppercase text-orange-700">
                  RSS
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Placeholder for feed publishing.</span>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rssEnabled}
                    onChange={(event) => setRssEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Enable</span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium">Telegram group</label>
                  <p className="mt-1 text-xs text-slate-500">
                    Link a Telegram group to receive updates from this dataspace.
                  </p>
                </div>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase text-sky-700">
                  Live
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {telegramGroupChatId ? (
                  <p className="text-xs text-emerald-700">Group linked and receiving updates.</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Add the Democracy Routes bot to your Telegram group, then send the code below in the group.
                  </p>
                )}
                {telegramGroupLinkCode ? (
                  <div className="flex items-center gap-3">
                    <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {telegramGroupLinkCode}
                    </span>
                    <span className="text-[11px] text-slate-500">Share this in the group</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleGenerateLinkCode}
                  className="dr-button-outline px-3 py-1 text-xs"
                  disabled={linkingGroup}
                >
                  {linkingGroup ? "Generating..." : telegramGroupChatId ? "Relink group" : "Generate link code"}
                </button>
              </div>
            </div>

            {[
              {
                label: "Discord",
                badge: "Placeholder",
                description: "Connect a Discord bot or channel mirror for dataspace updates."
              },
              {
                label: "Slack",
                badge: "Placeholder",
                description: "Post dataspace activity into a Slack workspace or channel."
              },
              {
                label: "Mail sharing",
                badge: "Placeholder",
                description: "Share updates by email digest or mailing-list style distribution."
              },
              {
                label: "Fediverse",
                badge: "Placeholder",
                description: "Publish selected dataspace activity to ActivityPub-compatible networks."
              }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{item.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                    {item.badge}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-700">Saved.</p> : null}
        <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
