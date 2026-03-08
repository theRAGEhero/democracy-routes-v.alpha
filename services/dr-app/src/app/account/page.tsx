import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/app/account/change-password/ChangePasswordForm";
import { ProfileSettingsForm } from "@/app/account/ProfileSettingsForm";
import { ChangeEmailForm } from "@/app/account/ChangeEmailForm";

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
      email: true,
      avatarUrl: true,
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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Profile settings
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-600">Update your password for this account.</p>
          {user?.id ? (
            <Link href={`/users/${user.id}`} className="dr-button-outline px-3 py-1.5 text-xs">
              View your public profile
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Notifications</h2>
          <ProfileSettingsForm
            initialTelegramHandle={user?.telegramHandle ?? ""}
            initialPersonalDescription={user?.personalDescription ?? ""}
            initialCalComLink={user?.calComLink ?? ""}
            initialAvatarUrl={user?.avatarUrl ?? ""}
            initialNotifyEmailMeetingInvites={user?.notifyEmailMeetingInvites ?? true}
            initialNotifyTelegramMeetingInvites={user?.notifyTelegramMeetingInvites ?? true}
            initialNotifyEmailPlanInvites={user?.notifyEmailPlanInvites ?? true}
            initialNotifyTelegramPlanInvites={user?.notifyTelegramPlanInvites ?? true}
            initialNotifyEmailDataspaceInvites={user?.notifyEmailDataspaceInvites ?? true}
            initialNotifyTelegramDataspaceInvites={user?.notifyTelegramDataspaceInvites ?? true}
            initialNotifyEmailDataspaceActivity={user?.notifyEmailDataspaceActivity ?? true}
            initialNotifyTelegramDataspaceActivity={user?.notifyTelegramDataspaceActivity ?? true}
          />
        </div>
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Security</h2>
          <ChangePasswordForm />
        </div>
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Email</h2>
          <ChangeEmailForm currentEmail={user?.email ?? session.user.email} />
        </div>
      </div>
    </div>
  );
}
