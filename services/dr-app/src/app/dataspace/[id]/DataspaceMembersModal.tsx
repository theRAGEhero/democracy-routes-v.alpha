"use client";

import { useMemo, useState } from "react";
import { DataspaceInviteForm } from "@/app/dataspace/[id]/DataspaceInviteForm";
import { UserProfileLink } from "@/components/UserProfileLink";

type Member = {
  id: string;
  user: {
    id: string;
    email: string;
  };
};

type Props = {
  dataspaceId: string;
  members: Member[];
  canInvite: boolean;
};

export function DataspaceMembersModal({ dataspaceId, members, canInvite }: Props) {
  const [open, setOpen] = useState(false);
  const existingEmails = useMemo(() => members.map((member) => member.user.email), [members]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
      >
        Members
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-3 py-4 sm:px-4 sm:py-6">
          <button
            type="button"
            aria-label="Close members modal"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_35px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Members
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold text-slate-900"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {members.length} member{members.length === 1 ? "" : "s"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {canInvite
                    ? "Review membership and invite registered users without leaving the dataspace."
                    : "Review the people currently connected to this dataspace."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
              <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Current members
                  </h3>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">No members yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm shadow-sm"
                      >
                        <UserProfileLink
                          userId={member.user.id}
                          email={member.user.email}
                          className="text-slate-700 hover:text-slate-900 hover:underline"
                        />
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Member
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canInvite ? (
                <div className="min-h-0 overflow-y-auto border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Invite member
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Add a registered user directly to this dataspace.
                  </p>
                  <div className="mt-4">
                    <DataspaceInviteForm
                      dataspaceId={dataspaceId}
                      existingEmails={existingEmails}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
