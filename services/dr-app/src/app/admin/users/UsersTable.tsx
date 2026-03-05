"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  emailVerifiedAtLabel: string | null;
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
  const [validatingId, setValidatingId] = useState<string | null>(null);
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

  async function handleResetPassword(userId: string, email: string) {
    const confirmed = window.confirm(`Reset password for ${email}? A new password will be emailed.`);
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setResettingId(userId);

    const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST"
    });

    const data = await response.json().catch(() => null);
    setResettingId(null);

    if (!response.ok) {
      const message = data?.error ?? "Unable to reset password";
      setError(message);
      return;
    }

    if (data?.emailSent === false) {
      setMessage("Password reset, but email was not sent.");
    } else {
      setMessage("Password reset email sent.");
    }
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

  async function handleValidate(userId: string, email: string) {
    const confirmed = window.confirm(`Validate ${email} and send welcome email?`);
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setValidatingId(userId);

    const response = await fetch(`/api/admin/users/${userId}/validate`, {
      method: "POST"
    });

    const data = await response.json().catch(() => null);
    setValidatingId(null);

    if (!response.ok) {
      setError(data?.error ?? "Unable to validate user");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? { ...user, emailVerifiedAtLabel: data?.verifiedAt ? new Date(data.verifiedAt).toLocaleString() : user.emailVerifiedAtLabel }
          : user
      )
    );

    if (data?.emailSent === false) {
      setMessage("User validated, but email was not sent.");
    } else {
      setMessage("User validated and welcome email sent.");
    }
  }

  return (
    <div className="dr-card">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[2fr,0.8fr,1.1fr,0.9fr,0.8fr,0.7fr,1fr,1.6fr] gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Email</span>
            <span>Role</span>
            <span>Verified</span>
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
                <div key={user.id} className="grid grid-cols-[2fr,0.8fr,1.1fr,0.9fr,0.8fr,0.7fr,1fr,1.6fr] gap-4 px-4 py-3 text-sm">
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
                    {user.emailVerifiedAtLabel ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Verified · {user.emailVerifiedAtLabel}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Pending
                      </span>
                    )}
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
                    {!user.emailVerifiedAtLabel ? (
                      <button
                        type="button"
                        onClick={() => handleValidate(user.id, user.email)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                        disabled={user.isDeleted || validatingId === user.id}
                      >
                        {validatingId === user.id ? "Validating..." : "Validate + welcome"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleResetPassword(user.id, user.email)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                      disabled={user.isDeleted || resettingId === user.id}
                    >
                      {resettingId === user.id ? "Resetting..." : "Reset password"}
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
      {message ? <p className="px-4 py-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
