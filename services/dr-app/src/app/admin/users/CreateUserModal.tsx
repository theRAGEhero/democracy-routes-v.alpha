"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CreateUserForm } from "@/app/admin/users/CreateUserForm";

export function CreateUserModal() {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  if (!portalReady && typeof window !== "undefined") {
    setPortalReady(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dr-button px-4 py-2 text-sm"
      >
        Create user
      </button>
      {open && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Create user</h2>
                    <p className="text-sm text-slate-500">Invite a new account.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4">
                  <CreateUserForm />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
