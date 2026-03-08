import { getServerSession } from "next-auth";
import type { CSSProperties } from "react";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { DataspaceJoinLeave } from "@/app/dataspace/[id]/DataspaceJoinLeave";
import { DataspaceInviteForm } from "@/app/dataspace/[id]/DataspaceInviteForm";
import { DataspaceAnalysisPanel } from "@/app/dataspace/[id]/DataspaceAnalysisPanel";
import { JoinButton } from "@/components/JoinButton";
import { DataspaceSettingsModal } from "@/app/dataspace/[id]/DataspaceSettingsModal";
import { DataspaceImportSources } from "@/app/dataspace/[id]/DataspaceImportSources";
import { DEFAULT_DATASPACE_COLOR, getDataspaceTheme } from "@/lib/dataspaceColor";
import { UserProfileLink } from "@/components/UserProfileLink";

export default async function DataspaceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [dataspace, currentUser, subscription, meetingMembers, meetingInvites, planParticipants, planPairs] =
    await Promise.all([
    prisma.dataspace.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, email: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
        meetings: { where: { isHidden: false }, orderBy: { createdAt: "desc" } },
        plans: { orderBy: { startAt: "desc" } },
        texts: { orderBy: { updatedAt: "desc" } }
      }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramHandle: true }
    }),
    prisma.dataspaceSubscription.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: params.id,
          userId: session.user.id
        }
      }
    }),
    prisma.meetingMember.findMany({
      where: { userId: session.user.id },
      select: { meetingId: true }
    }),
    prisma.meetingInvite.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      select: { meetingId: true }
    }),
    prisma.planParticipant.findMany({
      where: { userId: session.user.id },
      select: { planId: true, status: true }
    }),
    prisma.planPair.findMany({
      where: {
        OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
      },
      select: { planRound: { select: { planId: true } } }
    })
  ]);

  if (!dataspace) {
    return <p className="text-sm text-slate-600">Dataspace not found.</p>;
  }

  const isMember = dataspace.members.some(
    (member: (typeof dataspace.members)[number]) =>
      member.userId === session.user.id
  );
  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;
  const canEdit = isAdmin || isOwner;
  const canInvite = isAdmin || isOwner;

  if (!isAdmin && !isMember) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  const now = new Date();
  const upcomingMeetings = dataspace.meetings.filter(
    (meeting: (typeof dataspace.meetings)[number]) =>
      meeting.scheduledStartAt && meeting.scheduledStartAt > now
  );
  const upcomingPlans = dataspace.plans.filter(
    (plan: (typeof dataspace.plans)[number]) => plan.startAt > now
  );
  const meetingMemberIds = new Set(
    meetingMembers.map(
      (member: (typeof meetingMembers)[number]) => member.meetingId
    )
  );
  const meetingInviteIds = new Set(
    meetingInvites.map(
      (invite: (typeof meetingInvites)[number]) => invite.meetingId
    )
  );
  const planParticipantMap = new Map(
    planParticipants.map(
      (participant: (typeof planParticipants)[number]) => [
        participant.planId,
        participant.status
      ]
    )
  );
  const planPairIds = new Set(
    planPairs
      .map((pair: (typeof planPairs)[number]) => pair.planRound.planId)
      .filter((planId: string | null): planId is string => Boolean(planId))
  );

  const theme = getDataspaceTheme(dataspace.color ?? DEFAULT_DATASPACE_COLOR);

  return (
    <div className="dataspace-theme" style={theme as CSSProperties}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white text-sm font-semibold text-slate-600">
              {dataspace.imageUrl ? (
                <img
                  src={dataspace.imageUrl}
                  alt={`${dataspace.name} avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                dataspace.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              {dataspace.name}
            </h1>
          </div>
          <p className="text-sm text-slate-600">{dataspace.description || "No description"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Created by{" "}
            <UserProfileLink
              userId={dataspace.createdBy.id}
              email={dataspace.createdBy.email}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
            />{" "}
            · {formatDateTime(dataspace.createdAt)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <span
              className="h-3 w-3 rounded-full border border-white/70 shadow-sm"
              style={{ backgroundColor: dataspace.color ?? DEFAULT_DATASPACE_COLOR }}
            />
            <span>Dataspace color</span>
            {dataspace.rssEnabled ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">
                RSS
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DataspaceJoinLeave
            dataspaceId={dataspace.id}
            isMember={isMember}
            isAdmin={isAdmin}
            isPrivate={dataspace.isPrivate}
            isOwner={isOwner}
            isSubscribed={Boolean(subscription)}
            hasTelegramHandle={Boolean(currentUser?.telegramHandle)}
          />
          <DataspaceImportSources dataspaceId={dataspace.id} />
          <Link
            href={`/dataspace/${dataspace.id}/analytics`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
          >
            Analytics
          </Link>
          <DataspaceSettingsModal
            dataspaceId={dataspace.id}
            canEdit={canEdit}
            isSubscribed={Boolean(subscription)}
            initialName={dataspace.name}
            initialDescription={dataspace.description}
            initialColor={dataspace.color}
            initialImageUrl={dataspace.imageUrl}
            initialNotifyAllActivity={dataspace.notifyAllActivity}
            initialNotifyMeetings={dataspace.notifyMeetings}
            initialNotifyPlans={dataspace.notifyPlans}
            initialNotifyTexts={dataspace.notifyTexts}
            initialRssEnabled={dataspace.rssEnabled}
            initialTelegramGroupChatId={dataspace.telegramGroupChatId}
            initialTelegramGroupLinkCode={dataspace.telegramGroupLinkCode}
            subscriptionNotifyAll={subscription?.notifyAllActivity ?? true}
            subscriptionNotifyMeetings={subscription?.notifyMeetings ?? true}
            subscriptionNotifyPlans={subscription?.notifyPlans ?? true}
            subscriptionNotifyTexts={subscription?.notifyTexts ?? true}
          />
          <Link href="/dataspace" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to dataspaces
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Upcoming</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Calls</p>
              {upcomingMeetings.length === 0 ? (
                <p className="text-slate-500">No upcoming calls.</p>
              ) : (
                upcomingMeetings.map((meeting: (typeof upcomingMeetings)[number]) => {
                  const joinStatus =
                    meeting.createdById === session.user.id || meetingMemberIds.has(meeting.id)
                      ? "JOINED"
                      : meetingInviteIds.has(meeting.id)
                        ? "PENDING"
                        : "NONE";
                  return (
                    <div key={meeting.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-900">{meeting.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(meeting.scheduledStartAt, meeting.timezone)}
                        </p>
                      </div>
                      {meeting.isPublic ? (
                        <JoinButton
                          resourceType="meeting"
                          resourceId={meeting.id}
                          initialStatus={joinStatus}
                          canJoin={true}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Templates</p>
              {upcomingPlans.length === 0 ? (
                <p className="text-slate-500">No upcoming templates.</p>
              ) : (
                upcomingPlans.map((plan: (typeof upcomingPlans)[number]) => {
                  const joinStatus =
                    plan.createdById === session.user.id || planPairIds.has(plan.id)
                      ? "JOINED"
                      : planParticipantMap.get(plan.id) === "PENDING"
                        ? "PENDING"
                        : planParticipantMap.get(plan.id) === "APPROVED"
                          ? "JOINED"
                          : "NONE";
                  return (
                    <div key={plan.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-900">{plan.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(plan.startAt, plan.timezone)}
                        </p>
                      </div>
                      {plan.isPublic ? (
                        <JoinButton
                          resourceType="plan"
                          resourceId={plan.id}
                          initialStatus={joinStatus}
                          canJoin={true}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Meetings</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {dataspace.meetings.length === 0 ? (
              <p className="text-slate-500">No meetings yet.</p>
            ) : (
              dataspace.meetings.map(
                (meeting: (typeof dataspace.meetings)[number]) => {
                const joinStatus =
                  meeting.createdById === session.user.id || meetingMemberIds.has(meeting.id)
                    ? "JOINED"
                    : meetingInviteIds.has(meeting.id)
                      ? "PENDING"
                      : "NONE";
                return (
                  <div key={meeting.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{meeting.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(meeting.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {meeting.isPublic ? (
                        <JoinButton
                          resourceType="meeting"
                          resourceId={meeting.id}
                          initialStatus={joinStatus}
                          canJoin={true}
                        />
                      ) : null}
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="text-xs font-semibold text-slate-700 hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="dr-card p-6">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Members</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
              {dataspace.members.length === 0 ? (
                <span className="text-slate-500">No members yet.</span>
              ) : (
                dataspace.members.map(
                  (member: (typeof dataspace.members)[number]) => (
                  <span key={member.id} className="rounded-full bg-white px-3 py-1">
                    <UserProfileLink
                      userId={member.user.id}
                      email={member.user.email}
                      className="text-slate-700 hover:text-slate-900 hover:underline"
                    />
                  </span>
                  )
                )
              )}
            </div>
          </div>

          {canInvite ? (
            <div className="dr-card p-6">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Invite members</h2>
              <p className="mt-1 text-xs text-slate-500">
                Invite registered users by email.
              </p>
              <div className="mt-4">
                <DataspaceInviteForm
                  dataspaceId={dataspace.id}
                  existingEmails={dataspace.members.map(
                    (member: (typeof dataspace.members)[number]) => member.user.email
                  )}
                />
              </div>
            </div>
          ) : null}

          <div className="dr-card p-6">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Templates</h2>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              {dataspace.plans.length === 0 ? (
                <p className="text-slate-500">No templates yet.</p>
              ) : (
                dataspace.plans.map((plan: (typeof dataspace.plans)[number]) => {
                  const joinStatus =
                    plan.createdById === session.user.id || planPairIds.has(plan.id)
                      ? "JOINED"
                      : planParticipantMap.get(plan.id) === "PENDING"
                        ? "PENDING"
                        : planParticipantMap.get(plan.id) === "APPROVED"
                          ? "JOINED"
                          : "NONE";
                  return (
                    <div key={plan.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-900">{plan.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(plan.startAt, plan.timezone)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {plan.isPublic ? (
                          <JoinButton
                            resourceType="plan"
                            resourceId={plan.id}
                            initialStatus={joinStatus}
                            canJoin={true}
                          />
                        ) : null}
                        <Link
                          href={`/flows/${plan.id}`}
                          className="text-xs font-semibold text-slate-700 hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DataspaceAnalysisPanel dataspaceId={dataspace.id} />
        </div>
      </div>
      </div>
    </div>
  );
}
