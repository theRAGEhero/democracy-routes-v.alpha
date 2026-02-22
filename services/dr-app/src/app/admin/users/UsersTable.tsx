"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  isDeleted: boolean;
  deletedAtLabel: string | null;
  createdAtLabel: string;
  meetingsCount: number;
};

type Props = {
  initialUsers: UserRow[];
};

export function UsersTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  async function handleDelete(userId: string) {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setDeletingId(userId);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE"
    });

    const data = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      setError(data?.error ?? "Unable to delete user");
      return;
    }

    const deletedAtLabel = data?.deletedAt
      ? new Date(data.deletedAt).toLocaleString()
      : new Date().toLocaleString();
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? { ...user, isDeleted: true, deletedAtLabel }
          : user
      )
    );
    setMessage("User deleted");
  }

  async function handleRoleChange(userId: string, role: string) {
    setError(null);
    setMessage(null);
    setUpdatingRoleId(userId);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });

    const data = await response.json().catch(() => null);
    setUpdatingRoleId(null);

    if (!response.ok) {
      const message = data?.error ?? "Unable to update role";
      setError(message);
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, role: data?.role ?? role } : user
      )
    );
    setMessage("Role updated");
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resettingId) return;

    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/users/${resettingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmPassword })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to reset password";
      setError(message);
      return;
    }

    setMessage("Password reset. User must change it on next login.");
    setResettingId(null);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleResendInvite(userId: string) {
    setMessage(null);
    setError(null);
    setResendingId(userId);

    const response = await fetch(`/api/admin/users/${userId}/resend`, {
      method: "POST"
    });

    const data = await response.json().catch(() => null);
    setResendingId(null);

    if (!response.ok) {
      setError(data?.error ?? "Unable to resend invite");
      return;
    }

    if (data?.emailSent) {
      setMessage("Invite sent again.");
    } else {
      setMessage("User updated, but email was not sent.");
    }
  }

  return (
    <div className="dr-card">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[2fr,0.8fr,0.9fr,0.8fr,0.7fr,1fr,1.4fr] gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Must change</span>
            <span>Meetings</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No users yet.</div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="grid grid-cols-[2fr,0.8fr,0.9fr,0.8fr,0.7fr,1fr,1.4fr] gap-4 px-4 py-3 text-sm">
                  <div className="text-slate-900">{user.email}</div>
                  <div className="text-slate-700">
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      className="dr-input w-full rounded px-2 py-1 text-xs"
                      disabled={updatingRoleId === user.id || user.isDeleted}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div className="text-slate-600">
                    {user.isDeleted ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Deleted {user.deletedAtLabel ? `· ${user.deletedAtLabel}` : ""}
                      </span>
                    ) : (
                      "Active"
                    )}
                  </div>
                  <div className="text-slate-500">{user.mustChangePassword ? "Yes" : "No"}</div>
                  <div className="text-slate-500">{user.meetingsCount}</div>
                  <div className="text-slate-500">{user.createdAtLabel}</div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <button
                      type="button"
                      onClick={() => setResettingId(user.id)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                      disabled={user.isDeleted}
                    >
                      Change password
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResendInvite(user.id)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                      disabled={resendingId === user.id || user.isDeleted}
                    >
                      {resendingId === user.id ? "Resending..." : "Resend invite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                      disabled={deletingId === user.id || user.isDeleted}
                    >
                      {user.isDeleted
                        ? "Deleted"
                        : deletingId === user.id
                          ? "Deleting..."
                          : "Delete"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {resettingId ? (
        <form onSubmit={handleResetPassword} className="border-t border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Reset password</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="dr-input w-full rounded px-3 py-2 text-sm"
              placeholder="New password"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="dr-input w-full rounded px-3 py-2 text-sm"
              placeholder="Confirm password"
              required
            />
            <div className="flex items-center gap-2">
              <button type="submit" className="dr-button px-4 py-2 text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setResettingId(null);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="dr-button-outline px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}
      {message ? <p className="px-4 py-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
