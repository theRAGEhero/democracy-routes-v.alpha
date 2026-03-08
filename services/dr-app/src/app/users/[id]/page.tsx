import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

type PageProps = {
  params: { id: string };
};

export default async function UserProfilePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      avatarUrl: true,
      personalDescription: true,
      telegramHandle: true,
      calComLink: true,
      createdAt: true,
      role: true,
      _count: {
        select: {
          meetingsCreated: true,
          plansCreated: true,
          dataspacesCreated: true,
          texts: true,
          memberships: true,
          dataspaceMemberships: true
        }
      }
    }
  });

  if (!user || user.id === "" || user.email === "") {
    notFound();
  }

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">User profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {user.email}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Member since {formatDateTime(user.createdAt, null)}
          </p>
        </div>
        <Link href="/dashboard" className="dr-button-outline px-4 py-2 text-sm">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.25fr]">
        <section className="dr-card p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/80 bg-white text-2xl font-semibold text-slate-600 shadow-[0_18px_34px_rgba(15,23,42,0.1)]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.email} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {user.role}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Democracy Routes
                </span>
              </div>
              <p className="mt-3 break-all text-sm font-semibold text-slate-900">{user.email}</p>
              {user.telegramHandle ? (
                <p className="mt-2 text-sm text-slate-600">Telegram: @{user.telegramHandle}</p>
              ) : null}
              {user.calComLink ? (
                <a
                  href={user.calComLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                >
                  Booking link
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Personal description
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {user.personalDescription?.trim() || "No personal description yet."}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meetings created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.meetingsCreated}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Templates created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.plansCreated}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dataspaces created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.dataspacesCreated}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Texts</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.texts}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meeting memberships</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.memberships}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dataspace memberships</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.dataspaceMemberships}</p>
            </div>
          </div>

          <div className="dr-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Profile visibility</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              This page is visible to signed-in Democracy Routes users. It is intended as a lightweight participant profile for meetings, templates, and dataspaces.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
