"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DATASPACE_COLOR_OPTIONS,
  DEFAULT_DATASPACE_COLOR,
  normalizeHexColor
} from "@/lib/dataspaceColor";

type Member = {
  id: string;
  email: string;
};

type Dataspace = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  imageUrl?: string | null;
  createdByEmail: string;
  members: Member[];
  isPrivate: boolean;
  meetingsCount: number;
  plansCount: number;
  textsCount: number;
  isSubscribed: boolean;
};

type Props = {
  initialDataspaces: Dataspace[];
  currentUserId: string;
  personalDataspace: Dataspace;
  isAdmin: boolean;
  hasTelegramHandle: boolean;
};

export function DataspaceClient({
  initialDataspaces,
  currentUserId,
  personalDataspace,
  isAdmin,
  hasTelegramHandle
}: Props) {
  const [dataspaces, setDataspaces] = useState(initialDataspaces);
  const [personalSubscribed, setPersonalSubscribed] = useState(
    personalDataspace.isSubscribed
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_DATASPACE_COLOR);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/dataspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, color, imageUrl })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to create dataspace";
      setError(message);
      return;
    }

    const newSpace: Dataspace = {
      id: payload.id,
      name,
      description: description || null,
      color: payload?.color ?? normalizeHexColor(color) ?? DEFAULT_DATASPACE_COLOR,
      imageUrl: payload?.imageUrl ?? (imageUrl.trim() || null),
      createdByEmail: "You",
      members: [{ id: currentUserId, email: "You" }],
      isPrivate: false,
      meetingsCount: 0,
      plansCount: 0,
      textsCount: 0,
      isSubscribed: true
    };

    setDataspaces((prev) => [newSpace, ...prev]);
    setName("");
    setDescription("");
    setColor(DEFAULT_DATASPACE_COLOR);
    setImageUrl("");
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

  async function handleJoin(id: string) {
    setError(null);
    const response = await fetch(`/api/dataspaces/${id}/join`, { method: "POST" });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to join dataspace";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id
          ? {
              ...space,
              members: space.members.some((member) => member.id === currentUserId)
                ? space.members
                : [...space.members, { id: currentUserId, email: "You" }],
              isSubscribed: true
            }
          : space
      )
    );
  }

  async function handleLeave(id: string) {
    setError(null);
    const response = await fetch(`/api/dataspaces/${id}/leave`, { method: "POST" });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to leave dataspace";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id
          ? {
              ...space,
              members: space.members.filter((member) => member.id !== currentUserId),
              isSubscribed: false
            }
          : space
      )
    );
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this dataspace?");
    if (!confirmed) return;

    setError(null);
    setDeletingId(id);

    const response = await fetch(`/api/dataspaces/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    setDeletingId(null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to delete dataspace";
      setError(message);
      return;
    }

    setDataspaces((prev) => prev.filter((space) => space.id !== id));
  }

  async function handleSubscribe(id: string) {
    setError(null);
    setSubscribingId(id);
    const response = await fetch(`/api/dataspaces/${id}/subscribe`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setSubscribingId(null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to subscribe";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id ? { ...space, isSubscribed: true } : space
      )
    );
  }

  async function handleUnsubscribe(id: string) {
    setError(null);
    setSubscribingId(id);
    const response = await fetch(`/api/dataspaces/${id}/unsubscribe`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setSubscribingId(null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to unsubscribe";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id ? { ...space, isSubscribed: false } : space
      )
    );
  }

  async function handlePersonalSubscribe(subscribe: boolean) {
    setError(null);
    setSubscribingId(personalDataspace.id);
    const response = await fetch(
      `/api/dataspaces/${personalDataspace.id}/${subscribe ? "subscribe" : "unsubscribe"}`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => null);
    setSubscribingId(null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to update subscription";
      setError(message);
      return;
    }

    setPersonalSubscribed(subscribe);
  }

  async function handleShare() {
    setError(null);
    setSharing(true);
    const response = await fetch(`/api/dataspaces/${personalDataspace.id}/share`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setSharing(false);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to share dataspace";
      setError(message);
      return;
    }

    window.location.reload();
  }

  async function handleUnshare() {
    const confirmed = window.confirm(
      "Unshare this dataspace? Members will be removed and it will become private again."
    );
    if (!confirmed) return;

    setError(null);
    setUnsharing(true);
    const response = await fetch(`/api/dataspaces/${personalDataspace.id}/unshare`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setUnsharing(false);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to unshare dataspace";
      setError(message);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Dataspaces
            </h2>
            <p className="text-sm text-slate-600">Your collaborative spaces, all in one view.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-xs text-slate-500 sm:block">
              {dataspaces.length + 1} spaces · {personalDataspace.members.length} members in yours
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="dr-button px-4 py-2 text-sm"
            >
              {showCreate ? "Close" : "New dataspace"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  My Data Space
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {personalDataspace.isPrivate
                    ? "Private by default. You can share it when you are ready."
                    : "Shared with all platform members. Anyone can join."}
                </p>
              </div>
              {personalDataspace.isPrivate ? (
                <button
                  type="button"
                  onClick={handleShare}
                  className="dr-button-outline px-4 py-2 text-sm"
                  disabled={sharing}
                >
                  {sharing ? "Sharing..." : "Share"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnshare}
                  className="dr-button-outline px-4 py-2 text-sm"
                  disabled={unsharing}
                >
                  {unsharing ? "Unsharing..." : "Unshare"}
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white text-sm font-semibold text-slate-600">
                {personalDataspace.imageUrl ? (
                  <img
                    src={personalDataspace.imageUrl}
                    alt={`${personalDataspace.name} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  personalDataspace.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/70 shadow-sm"
                    style={{ backgroundColor: personalDataspace.color ?? DEFAULT_DATASPACE_COLOR }}
                  />
                  <Link href={`/dataspace/${personalDataspace.id}`} className="text-lg font-semibold text-slate-900 hover:underline">
                    {personalDataspace.name}
                  </Link>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                    {personalDataspace.isPrivate ? "Private" : "Shared"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {personalDataspace.description || "No description"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Created by {personalDataspace.createdByEmail}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {personalDataspace.meetingsCount} meetings · {personalDataspace.plansCount} templates · {personalDataspace.textsCount} texts
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handlePersonalSubscribe(!personalSubscribed)}
                className="dr-button-outline px-4 py-2 text-sm"
                disabled={subscribingId === personalDataspace.id}
              >
                {subscribingId === personalDataspace.id
                  ? "Updating..."
                  : personalSubscribed
                    ? "Unsubscribe notifications"
                    : "Subscribe to notifications"}
              </button>
              {!hasTelegramHandle ? (
                <span className="text-xs text-slate-500">
                  Add a Telegram handle in Profile settings to receive alerts.
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Shared dataspaces
                </h3>
                <p className="text-sm text-slate-600">Join or manage shared spaces.</p>
              </div>
              <span className="text-xs text-slate-500">{dataspaces.length} spaces</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {dataspaces.length === 0 ? (
                <p className="text-sm text-slate-500">No dataspaces yet.</p>
              ) : (
                dataspaces.map((space) => {
                  const isMember = space.members.some((member) => member.id === currentUserId);
                  return (
                    <div key={space.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white text-xs font-semibold text-slate-600">
                              {space.imageUrl ? (
                                <img
                                  src={space.imageUrl}
                                  alt={`${space.name} avatar`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                space.name.slice(0, 2).toUpperCase()
                              )}
                            </span>
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-white/70 shadow-sm"
                              style={{ backgroundColor: space.color ?? DEFAULT_DATASPACE_COLOR }}
                            />
                            <Link href={`/dataspace/${space.id}`} className="text-base font-semibold text-slate-900 hover:underline">
                              {space.name}
                            </Link>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{space.description || "No description"}</p>
                          <p className="mt-1 text-xs text-slate-500">Created by {space.createdByEmail}</p>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {space.meetingsCount} · {space.plansCount} · {space.textsCount}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {isMember ? (
                          <button
                            type="button"
                            onClick={() => handleLeave(space.id)}
                            className="dr-button-outline px-3 py-1 text-xs"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleJoin(space.id)}
                            className="dr-button-outline px-3 py-1 text-xs"
                          >
                            Join
                          </button>
                        )}
                        {isMember ? (
                          <button
                            type="button"
                            onClick={() =>
                              space.isSubscribed
                                ? handleUnsubscribe(space.id)
                                : handleSubscribe(space.id)
                            }
                            className="dr-button-outline px-3 py-1 text-xs"
                            disabled={subscribingId === space.id}
                          >
                            {subscribingId === space.id
                              ? "Updating..."
                              : space.isSubscribed
                                ? "Unsubscribe"
                                : "Subscribe"}
                          </button>
                        ) : null}
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(space.id)}
                            className="dr-button-outline px-3 py-1 text-xs text-red-600 hover:text-red-700"
                            disabled={deletingId === space.id}
                          >
                            {deletingId === space.id ? "Deleting..." : "Delete"}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {space.members.length === 0 ? (
                          <span>No members yet.</span>
                        ) : (
                          space.members.slice(0, 6).map((member) => (
                            <span key={member.id} className="rounded-full bg-white px-2 py-1">
                              {member.email}
                            </span>
                          ))
                        )}
                        {space.members.length > 6 ? (
                          <span className="rounded-full bg-white px-2 py-1">
                            +{space.members.length - 6} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Create dataspace
                </h3>
                <p className="text-sm text-slate-600">Start a new shared space.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate((prev) => !prev)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showCreate ? "Hide" : "Show"}
              </button>
            </div>
            {showCreate ? (
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
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
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
                  {loading ? "Creating..." : "Create dataspace"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
