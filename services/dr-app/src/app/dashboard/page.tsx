import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardTabs } from "@/app/dashboard/DashboardTabs";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [meetings, dataspaces, invites, flows, texts, dataspaceMembers, meetingMembers, meetingInvites, planParticipants, planPairs] =
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
      include: { dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true, imageUrl: true } } }
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
      select: { id: true, name: true, personalOwnerId: true, color: true, imageUrl: true }
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
            posterId: true,
            embedUrl: true,
            harmonicaUrl: true,
            matchingMode: true
          }
        },
        dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true } }
      }
    }),
    prisma.text.findMany({
      where: { createdById: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true } }
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
      scheduledLabel: formatDateTime(meeting.scheduledStartAt, meeting.timezone) ?? "Not scheduled",
      expiresLabel: formatDateTime(meeting.expiresAt, meeting.timezone),
      language: meeting.language,
      providerLabel:
        meeting.transcriptionProvider === "VOSK"
          ? "Vosk"
          : meeting.transcriptionProvider === "AUTOREMOTE"
            ? "Auto Remote"
          : meeting.transcriptionProvider === "WHISPERREMOTE"
            ? "Whisper Remote"
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
      dataspaceColor: meeting.dataspace?.color ?? null,
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

  const planRows = flows
    .map((plan: (typeof flows)[number]) => {
      const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
        (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
        const type = block.type as PlanBlockType;
        if (!["START", "PARTICIPANTS", "PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING", "BREAK", "HARMONICA", "DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(type)) {
          return acc;
        }
        acc.push({
          id: block.id,
          type,
            durationSeconds: block.durationSeconds,
            roundNumber: block.roundNumber ?? null,
            posterId: block.posterId ?? null,
            embedUrl: block.embedUrl ?? null,
            harmonicaUrl: block.harmonicaUrl ?? null,
            matchingMode: normalizeMatchingMode(block.matchingMode)
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
      dataspaceColor: plan.dataspace?.color ?? null,
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
          : text.dataspace?.id ?? "none",
      dataspaceColor: text.dataspace?.color ?? null
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
    .filter((meeting: (typeof meetings)[number]) => {
      const startAt = meeting.scheduledStartAt ?? meeting.createdAt;
      return startAt > now;
    })
    .map((meeting: (typeof meetings)[number]) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: (meeting.scheduledStartAt ?? meeting.createdAt) as Date,
      type: "Meeting" as const,
      href: `/meetings/${meeting.id}`,
      join: meetingJoinMap.get(meeting.id),
      dataspaceColor: meeting.dataspace?.color ?? null,
      dataspaceKey:
        meeting.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : meeting.dataspace?.id ?? "none"
    }));

  const upcomingPlans = flows
    .filter((plan: (typeof flows)[number]) => plan.startAt > now)
    .map((plan: (typeof flows)[number]) => ({
      id: plan.id,
      title: plan.title,
      startsAt: plan.startAt,
      type: "Template" as const,
      href: `/flows/${plan.id}`,
      join: planJoinMap.get(plan.id),
      dataspaceColor: plan.dataspace?.color ?? null,
      dataspaceKey:
        plan.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : plan.dataspace?.id ?? "none"
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
      join: meetingJoinMap.get(meeting.id),
      dataspaceColor: meeting.dataspace?.color ?? null,
      dataspaceKey:
        meeting.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : meeting.dataspace?.id ?? "none"
    })),
    ...flows.map((plan: (typeof flows)[number]) => ({
      id: plan.id,
      title: plan.title,
      type: "Template" as const,
      date: plan.createdAt,
      href: `/flows/${plan.id}`,
      join: planJoinMap.get(plan.id),
      dataspaceColor: plan.dataspace?.color ?? null,
      dataspaceKey:
        plan.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : plan.dataspace?.id ?? "none"
    })),
    ...texts.map((text: (typeof texts)[number]) => ({
      id: text.id,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      type: "Text" as const,
      date: text.updatedAt,
      href: `/texts/${text.id}`,
      dataspaceColor: text.dataspace?.color ?? null,
      dataspaceKey:
        text.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : text.dataspace?.id ?? "none"
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
        href: `/meetings/${meeting.id}`,
        dataspaceKey:
          meeting.dataspace?.personalOwnerId === session.user.id
            ? "personal"
            : meeting.dataspace?.id ?? "none"
      };
    }),
    ...flows.map((plan: (typeof flows)[number]) => ({
      id: `plan-${plan.id}`,
      title: plan.title,
      type: "Template" as const,
      startsAt: plan.startAt.toISOString(),
      href: `/flows/${plan.id}`,
      dataspaceKey:
        plan.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : plan.dataspace?.id ?? "none"
    })),
    ...texts.map((text: (typeof texts)[number]) => ({
      id: `text-${text.id}`,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      type: "Text" as const,
      startsAt: text.updatedAt.toISOString(),
      href: `/texts/${text.id}`,
      dataspaceKey:
        text.dataspace?.personalOwnerId === session.user.id
          ? "personal"
          : text.dataspace?.id ?? "none"
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
    { key: "personal", label: "My Data Space", color: null, imageUrl: session.user.avatarUrl ?? null },
    { key: "none", label: "No dataspace", color: null, imageUrl: null },
    ...dataspaces
      .filter((dataspace: (typeof dataspaces)[number]) => !dataspace.personalOwnerId)
      .map((dataspace: (typeof dataspaces)[number]) => ({
        key: dataspace.id,
        label: dataspace.name,
        color: dataspace.color ?? null,
        imageUrl: dataspace.imageUrl ?? null
      }))
  ];

  return (
    <div className="h-[calc(100dvh-140px)] max-h-[calc(100dvh-140px)] overflow-hidden">
      <DashboardTabs
        meetingRows={rows}
        planRows={planRows}
        textRows={textRows}
        dataspaceOptions={dataspaceOptions}
        recentItems={recentItems.map((item) => ({
          ...item,
          date: formatDateTime(item.date)
        }))}
        upcomingItems={upcomingItems.map((item) => ({
          ...item,
          startsAt: formatDateTime(item.startsAt)
        }))}
        upcomingInvites={upcomingInvites}
        calendarEvents={calendarEvents}
      />
    </div>
  );
}
