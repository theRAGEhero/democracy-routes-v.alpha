"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({
  onBeforeSignOut
}: {
  onBeforeSignOut?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onBeforeSignOut?.();
        signOut({ callbackUrl: "/login" });
      }}
      className="text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}
