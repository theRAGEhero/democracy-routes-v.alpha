"use client";

import Link from "next/link";
import { useState } from "react";

type Member = {
  id: string;
  email: string;
};

type Dataspace = {
  id: string;
  name: string;
  description: string | null;
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
      body: JSON.stringify({ name, description })
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
      createdByEmail: "You",
      members: [],
      isPrivate: false,
      meetingsCount: 0,
      plansCount: 0,
      textsCount: 0,
      isSubscribed: false
    };

    setDataspaces((prev) => [newSpace, ...prev]);
    setName("");
    setDescription("");
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
                : [...space.members, { id: currentUserId, email: "You" }]
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Dataspaces
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="dr-button-outline px-4 py-2 text-sm"
        >
          {showCreate ? "Close" : "New dataspace"}
        </button>
      </div>

      {showCreate ? (
        <div className="dr-card p-6">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            Create dataspace
          </h3>
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
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
              {loading ? "Creating..." : "Create dataspace"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="dr-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
              My Data Space
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {personalDataspace.isPrivate
                ? "Private by default. You can share it when you are ready."
                : "Shared with all platform members. Anyone in the platform can join."}
            </p>
          </div>
          {personalDataspace.isPrivate ? (
            <button
              type="button"
              onClick={handleShare}
              className="dr-button-outline px-4 py-2 text-sm"
              disabled={sharing}
            >
              {sharing ? "Sharing..." : "Share dataspace"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUnshare}
              className="dr-button-outline px-4 py-2 text-sm"
              disabled={unsharing}
            >
              {unsharing ? "Unsharing..." : "Unshare dataspace"}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                <Link href={`/dataspace/${personalDataspace.id}`} className="hover:underline">
                  {personalDataspace.name}
                </Link>
              </h3>
              <p className="text-sm text-slate-600">
                {personalDataspace.description || "No description"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Created by {personalDataspace.createdByEmail}
              </p>
            </div>
            <span className="text-xs font-semibold uppercase text-slate-500">
              {personalDataspace.isPrivate ? "Private" : "Shared"}
            </span>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase text-slate-500">
            Meetings: {personalDataspace.meetingsCount} · Plans: {personalDataspace.plansCount} · Texts: {personalDataspace.textsCount}
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Members</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              {personalDataspace.members.length === 0 ? (
                <span className="text-slate-500">No members yet.</span>
              ) : (
                personalDataspace.members.map((member) => (
                  <span key={member.id} className="rounded-full bg-white px-3 py-1">
                    {member.email}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
      </div>

      <div className="dr-card p-6">
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Shared dataspaces
        </h2>
        <p className="mt-2 text-sm text-slate-600">Join an existing dataspace.</p>

        <div className="mt-4 space-y-4">
          {dataspaces.length === 0 ? (
            <p className="text-sm text-slate-500">No dataspaces yet.</p>
          ) : (
            dataspaces.map((space) => {
              const isMember = space.members.some((member) => member.id === currentUserId);
              return (
                <div key={space.id} className="rounded-lg border border-slate-200 bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      <Link href={`/dataspace/${space.id}`} className="hover:underline">
                        {space.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-600">{space.description || "No description"}</p>
                    <p className="mt-1 text-xs text-slate-500">Created by {space.createdByEmail}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                      Meetings: {space.meetingsCount} · Plans: {space.plansCount} · Texts: {space.textsCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isMember ? (
                      <button
                        type="button"
                        onClick={() => handleLeave(space.id)}
                        className="dr-button-outline px-4 py-2 text-sm"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoin(space.id)}
                        className="dr-button-outline px-4 py-2 text-sm"
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
                        className="dr-button-outline px-4 py-2 text-sm"
                        disabled={subscribingId === space.id}
                      >
                        {subscribingId === space.id
                          ? "Updating..."
                          : space.isSubscribed
                            ? "Unsubscribe notifications"
                            : "Subscribe notifications"}
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(space.id)}
                        className="dr-button-outline px-4 py-2 text-sm text-red-600 hover:text-red-700"
                        disabled={deletingId === space.id}
                      >
                        {deletingId === space.id ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Members</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
                      {space.members.length === 0 ? (
                        <span className="text-slate-500">No members yet.</span>
                      ) : (
                        space.members.map((member) => (
                          <span key={member.id} className="rounded-full bg-white px-3 py-1">
                            {member.email}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
