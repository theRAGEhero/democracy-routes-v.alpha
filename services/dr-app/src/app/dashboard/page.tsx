import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { UpcomingInvites } from "@/app/dashboard/UpcomingInvites";
import { CalendarPanel } from "@/app/dashboard/CalendarPanel";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { JoinButton } from "@/components/JoinButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [meetings, dataspaces, invites, plans, texts, dataspaceMembers, meetingMembers, meetingInvites, planParticipants, planPairs] =
    await Promise.all([
    prisma.meeting.findMany({
      where: {
        isHidden: false,
        OR: [
          { createdById: session.user.id },
          { members: { some: { userId: session.user.id } } },
          {
            isPublic: true,
            dataspace: { members: { some: { userId: session.user.id } } }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: { dataspace: { select: { id: true, name: true, personalOwnerId: true } } }
    }),
    prisma.dataspace.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { personalOwnerId: session.user.id },
          { members: { some: { userId: session.user.id } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, personalOwnerId: true }
    }),
    prisma.meetingInvite.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      include: {
        meeting: {
          include: { createdBy: { select: { email: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.plan.findMany({
      where:
        session.user.role === "ADMIN"
          ? undefined
          : {
              OR: [
                {
                  rounds: {
                    some: {
                      pairs: {
                        some: {
                          OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
                        }
                      }
                    }
                  }
                },
                {
                  participants: { some: { userId: session.user.id } }
                },
                {
                  isPublic: true,
                  dataspace: { members: { some: { userId: session.user.id } } }
                }
              ]
            },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        startAt: true,
        timezone: true,
        roundsCount: true,
        roundDurationMinutes: true,
        syncMode: true,
        maxParticipantsPerRoom: true,
        language: true,
        transcriptionProvider: true,
        meditationEnabled: true,
        meditationAtStart: true,
        meditationBetweenRounds: true,
        meditationAtEnd: true,
        meditationDurationMinutes: true,
        meditationAnimationId: true,
        meditationAudioUrl: true,
        createdById: true,
        isPublic: true,
        dataspaceId: true,
        blocks: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            type: true,
            durationSeconds: true,
            roundNumber: true,
            posterId: true
          }
        },
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    }),
    prisma.text.findMany({
      where: { createdById: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    }),
    prisma.dataspaceMember.findMany({
      where: { userId: session.user.id },
      select: { dataspaceId: true }
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

  const now = new Date();

  const dataspaceMemberIds = new Set(
    dataspaceMembers.map(
      (member: (typeof dataspaceMembers)[number]) => member.dataspaceId
    )
  );
  dataspaces.forEach((dataspace: (typeof dataspaces)[number]) => {
    if (dataspace.personalOwnerId === session.user.id) {
      dataspaceMemberIds.add(dataspace.id);
    }
  });
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

  const rows = meetings.map((meeting: (typeof meetings)[number]) => {
    const isConcluded =
      !meeting.isActive || (meeting.expiresAt ? meeting.expiresAt.getTime() < now.getTime() : false);
    const canEdit =
      (session.user.role === "ADMIN" || meeting.createdById === session.user.id) && !isConcluded;
    const joinStatus: "PENDING" | "JOINED" | "NONE" =
      meeting.createdById === session.user.id || meetingMemberIds.has(meeting.id)
        ? "JOINED"
        : meetingInviteIds.has(meeting.id)
          ? "PENDING"
          : "NONE";
    const canJoin = Boolean(
      meeting.isPublic && meeting.dataspaceId && dataspaceMemberIds.has(meeting.dataspaceId)
    );
    return {
      id: meeting.id,
      title: meeting.title,
      statusLabel: isMeetingActive(meeting) ? "Active" : "Expired",
      expiresLabel: formatDateTime(meeting.expiresAt, meeting.timezone),
      language: meeting.language,
      providerLabel:
        meeting.transcriptionProvider === "VOSK"
          ? "Vosk"
          : meeting.transcriptionProvider === "DEEPGRAMLIVE"
            ? "Deepgram Live"
            : "Deepgram",
      dataspaceLabel:
        meeting.dataspace?.personalOwnerId === session.user.id
          ? "My Data Space"
          : meeting.dataspace?.name ?? "No dataspace",
      dataspaceKey:
        meeting.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : meeting.dataspace?.id ?? "none",
      isPublic: meeting.isPublic,
      isHidden: meeting.isHidden,
      isPast: Boolean(
        (meeting.expiresAt && meeting.expiresAt < now) ||
          (!meeting.expiresAt && meeting.scheduledStartAt && meeting.scheduledStartAt < now && !meeting.isActive)
      ),
      joinStatus,
      canJoin,
      canDelete: session.user.role === "ADMIN" || meeting.createdById === session.user.id,
      canEdit
    };
  });

  const planRows = plans
    .map((plan: (typeof plans)[number]) => {
      const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
        (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
        const type = block.type as PlanBlockType;
        if (!["ROUND", "MEDITATION", "POSTER", "TEXT", "RECORD", "FORM"].includes(type)) {
          return acc;
        }
        acc.push({
          id: block.id,
          type,
          durationSeconds: block.durationSeconds,
          roundNumber: block.roundNumber ?? null,
          posterId: block.posterId ?? null
        });
        return acc;
        },
        []
      );
    const schedule =
      normalizedBlocks.length > 0
        ? buildPlanSegmentsFromBlocks(plan.startAt, normalizedBlocks)
        : buildLegacySegments({
            startAt: plan.startAt,
            roundsCount: plan.roundsCount,
            roundDurationMinutes: plan.roundDurationMinutes,
            meditationEnabled: plan.meditationEnabled,
            meditationAtStart: plan.meditationAtStart,
            meditationBetweenRounds: plan.meditationBetweenRounds,
            meditationAtEnd: plan.meditationAtEnd,
            meditationDurationMinutes: plan.meditationDurationMinutes
          });
    const { totalEndMs } = schedule;
    const canEdit =
      (session.user.role === "ADMIN" || plan.createdById === session.user.id) &&
      now.getTime() <= totalEndMs;
    return {
      id: plan.id,
      title: plan.title,
      startLabel: formatDateTime(plan.startAt, plan.timezone),
      startAtMs: plan.startAt.getTime(),
      roundsCount: plan.roundsCount,
      dataspaceLabel:
        plan.dataspace?.personalOwnerId === session.user.id
          ? "My Data Space"
          : plan.dataspace?.name ?? "No dataspace",
      dataspaceKey:
        plan.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : plan.dataspace?.id ?? "none",
      isPast: totalEndMs < now.getTime(),
      isPublic: plan.isPublic,
      joinStatus:
        (plan.createdById === session.user.id || planPairIds.has(plan.id)
          ? "JOINED"
          : planParticipantMap.get(plan.id) === "PENDING"
            ? "PENDING"
            : planParticipantMap.get(plan.id) === "APPROVED"
              ? "JOINED"
              : "NONE") as "PENDING" | "JOINED" | "NONE",
      canJoin: Boolean(
        plan.isPublic && plan.dataspaceId && dataspaceMemberIds.has(plan.dataspaceId)
      ),
      canEdit
    };
  })
  .sort(
    (a: { startAtMs: number }, b: { startAtMs: number }) => b.startAtMs - a.startAtMs
  );

  const textPastCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const textRows = texts.map((text: (typeof texts)[number]) => {
    const snippet = text.content.trim().split("\n")[0]?.slice(0, 80) ?? "";
    return {
      id: text.id,
      snippet,
      updatedLabel: formatDateTime(text.updatedAt),
      isPast: text.updatedAt < textPastCutoff,
      dataspaceLabel:
        text.dataspace?.personalOwnerId === session.user.id
          ? "My Data Space"
        : text.dataspace?.name ?? "Personal",
      dataspaceKey:
        text.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : text.dataspace?.id ?? "none"
    };
  });

  const meetingJoinMap = new Map(
    rows.map((row: (typeof rows)[number]) => [
      row.id,
      { isPublic: row.isPublic, joinStatus: row.joinStatus, canJoin: row.canJoin }
    ])
  );
  const planJoinMap = new Map(
    planRows.map((row: (typeof planRows)[number]) => [
      row.id,
      { isPublic: row.isPublic, joinStatus: row.joinStatus, canJoin: row.canJoin }
    ])
  );

  const upcomingMeetings = meetings
    .filter(
      (meeting: (typeof meetings)[number]) =>
        meeting.scheduledStartAt && meeting.scheduledStartAt > now
    )
    .map((meeting: (typeof meetings)[number]) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.scheduledStartAt as Date,
      type: "Meeting" as const,
      href: `/meetings/${meeting.id}`,
      join: meetingJoinMap.get(meeting.id)
    }));

  const upcomingPlans = plans
    .filter((plan: (typeof plans)[number]) => plan.startAt > now)
    .map((plan: (typeof plans)[number]) => ({
      id: plan.id,
      title: plan.title,
      startsAt: plan.startAt,
      type: "Plan" as const,
      href: `/plans/${plan.id}`,
      join: planJoinMap.get(plan.id)
    }));

  const upcomingItems = [...upcomingMeetings, ...upcomingPlans]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 6);

  const recentItems = [
    ...meetings.map((meeting: (typeof meetings)[number]) => ({
      id: meeting.id,
      title: meeting.title,
      type: "Meeting" as const,
      date: meeting.createdAt,
      href: `/meetings/${meeting.id}`,
      join: meetingJoinMap.get(meeting.id)
    })),
    ...plans.map((plan: (typeof plans)[number]) => ({
      id: plan.id,
      title: plan.title,
      type: "Plan" as const,
      date: plan.createdAt,
      href: `/plans/${plan.id}`,
      join: planJoinMap.get(plan.id)
    })),
    ...texts.map((text: (typeof texts)[number]) => ({
      id: text.id,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      type: "Text" as const,
      date: text.updatedAt,
      href: `/texts/${text.id}`
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6);

  const calendarEvents = [
    ...meetings.map((meeting: (typeof meetings)[number]) => {
      const start = meeting.scheduledStartAt ?? meeting.createdAt;
      return {
        id: `meeting-${meeting.id}`,
        title: meeting.title,
        type: "Meeting" as const,
        startsAt: start.toISOString(),
        href: `/meetings/${meeting.id}`
      };
    }),
    ...plans.map((plan: (typeof plans)[number]) => ({
      id: `plan-${plan.id}`,
      title: plan.title,
      type: "Plan" as const,
      startsAt: plan.startAt.toISOString(),
      href: `/plans/${plan.id}`
    })),
    ...texts.map((text: (typeof texts)[number]) => ({
      id: `text-${text.id}`,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      type: "Text" as const,
      startsAt: text.updatedAt.toISOString(),
      href: `/texts/${text.id}`
    }))
  ];

  const upcomingInvites = invites
    .filter((invite: (typeof invites)[number]) => {
      const startAt = invite.meeting.scheduledStartAt;
      return !startAt || startAt > now;
    })
    .slice(0, 5)
    .map((invite: (typeof invites)[number]) => ({
      id: invite.id,
      meetingId: invite.meetingId,
      title: invite.meeting.title,
      hostEmail: invite.meeting.createdBy.email,
      scheduledStartAt: invite.meeting.scheduledStartAt
        ? invite.meeting.scheduledStartAt.toISOString()
        : null,
      timezone: invite.meeting.timezone ?? null
    }));

  const dataspaceOptions = [
    { key: "personal", label: "My Data Space" },
    { key: "none", label: "No dataspace" },
    ...dataspaces
      .filter((dataspace: (typeof dataspaces)[number]) => !dataspace.personalOwnerId)
      .map((dataspace: (typeof dataspaces)[number]) => ({
        key: dataspace.id,
        label: dataspace.name
      }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">Your meeting, plan, and text activity.</p>
        </div>
        <Link href="/meetings/new" className="dr-button px-4 py-2 text-sm">
          New meeting
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Recent activity</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {recentItems.length === 0 ? (
              <p className="text-slate-500">No recent activity yet.</p>
            ) : (
              recentItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {item.type}
                      </span>
                      <p className="font-medium text-slate-900">{item.title}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {"join" in item && item.join?.isPublic ? (
                      <JoinButton
                        resourceType={item.type === "Meeting" ? "meeting" : "plan"}
                        resourceId={item.id}
                        initialStatus={
                          item.join.joinStatus as "PENDING" | "JOINED" | "NONE"
                        }
                        canJoin={item.join.canJoin}
                      />
                    ) : null}
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Upcoming events</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {upcomingItems.length === 0 ? (
              <p className="text-slate-500">No upcoming events scheduled.</p>
            ) : (
              upcomingItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {item.type}
                      </span>
                      <p className="font-medium text-slate-900">{item.title}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.startsAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {"join" in item && item.join?.isPublic ? (
                      <JoinButton
                        resourceType={item.type === "Meeting" ? "meeting" : "plan"}
                        resourceId={item.id}
                        initialStatus={
                          item.join.joinStatus as "PENDING" | "JOINED" | "NONE"
                        }
                        canJoin={item.join.canJoin}
                      />
                    ) : null}
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <UpcomingInvites invites={upcomingInvites} />
      </div>

      <MeetingsTable
        initialMeetings={rows}
        dataspaceOptions={dataspaceOptions}
        plans={planRows}
        texts={textRows}
      />

      <CalendarPanel events={calendarEvents} />
    </div>
  );
}
