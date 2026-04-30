import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/app/account/change-password/ChangePasswordForm";
import { ProfileSettingsForm } from "@/app/account/ProfileSettingsForm";
import { ChangeEmailForm } from "@/app/account/ChangeEmailForm";
import { normalizeAppTheme } from "@/lib/appTheme";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      telegramHandle: true,
      personalDescription: true,
      calComLink: true,
      websiteUrl: true,
      xUrl: true,
      blueskyUrl: true,
      linkedinUrl: true,
      fediverseUrl: true,
      email: true,
      avatarUrl: true,
      appTheme: true,
      notifyEmailMeetingInvites: true,
      notifyTelegramMeetingInvites: true,
      notifyEmailPlanInvites: true,
      notifyTelegramPlanInvites: true,
      notifyEmailDataspaceInvites: true,
      notifyTelegramDataspaceInvites: true,
      notifyEmailDataspaceActivity: true,
      notifyTelegramDataspaceActivity: true
    }
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-[color:var(--stroke)] bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] p-6 shadow-[0_28px_72px_rgba(15,23,42,0.1)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Account settings
              </p>
              <h1
                className="mt-2 text-3xl font-semibold text-[color:var(--ink)] sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Profile, identity, and account controls in one workspace.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
                Keep your public profile sharp, choose how the product feels, and manage security settings without digging through separate pages.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
              <span className="rounded-full border border-[color:var(--stroke)] bg-white/85 px-3 py-1">
                {user?.email ?? session.user.email}
              </span>
              {user?.telegramHandle ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                  Telegram connected
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-800">
                  Telegram not connected
                </span>
              )}
              <span className="rounded-full border border-[color:var(--stroke)] bg-white/85 px-3 py-1">
                Theme: {normalizeAppTheme(user?.appTheme)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            {user?.id ? (
              <Link href={`/users/${user.id}`} className="dr-button-outline rounded-2xl px-4 py-2 text-sm">
                View public profile
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProfileSettingsForm
            initialTelegramHandle={user?.telegramHandle ?? ""}
            initialPersonalDescription={user?.personalDescription ?? ""}
            initialCalComLink={user?.calComLink ?? ""}
            initialWebsiteUrl={user?.websiteUrl ?? ""}
            initialXUrl={user?.xUrl ?? ""}
            initialBlueskyUrl={user?.blueskyUrl ?? ""}
            initialLinkedinUrl={user?.linkedinUrl ?? ""}
            initialFediverseUrl={user?.fediverseUrl ?? ""}
            initialAvatarUrl={user?.avatarUrl ?? ""}
            initialAppTheme={normalizeAppTheme(user?.appTheme)}
            initialNotifyEmailMeetingInvites={user?.notifyEmailMeetingInvites ?? true}
            initialNotifyTelegramMeetingInvites={user?.notifyTelegramMeetingInvites ?? true}
            initialNotifyEmailPlanInvites={user?.notifyEmailPlanInvites ?? true}
            initialNotifyTelegramPlanInvites={user?.notifyTelegramPlanInvites ?? true}
            initialNotifyEmailDataspaceInvites={user?.notifyEmailDataspaceInvites ?? true}
            initialNotifyTelegramDataspaceInvites={user?.notifyTelegramDataspaceInvites ?? true}
            initialNotifyEmailDataspaceActivity={user?.notifyEmailDataspaceActivity ?? true}
            initialNotifyTelegramDataspaceActivity={user?.notifyTelegramDataspaceActivity ?? true}
            userEmail={user?.email ?? session.user.email}
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[30px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/94 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Security</p>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-serif)" }}>
              Password
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Rotate your password here. This changes the credentials for your current account immediately.
            </p>
            <div className="mt-5">
              <ChangePasswordForm />
            </div>
          </div>

          <div className="rounded-[30px] border border-[color:var(--stroke)] bg-[color:var(--surface)]/94 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Account</p>
            <h2 className="mt-2 text-xl font-semibold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-serif)" }}>
              Sign-in email
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Use your current password to replace the email attached to this account.
            </p>
            <div className="mt-5">
              <ChangeEmailForm currentEmail={user?.email ?? session.user.email} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
