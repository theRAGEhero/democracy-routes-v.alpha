import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { OPEN_PROBLEM_ACTIVE_STATUSES } from "@/lib/openProblemStatus";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import { normalizeBlockType } from "@/lib/blockType";
import { getTranscriptionProviderLabel } from "@/lib/transcriptionProviders";
import type { TemplateBlock, TemplateDraftSettings } from "@/lib/templateDraft";
import { normalizeBlockRecords } from "@/lib/blockType";

type DashboardSessionUser = {
  id: string;
  role: string;
  avatarUrl?: string | null;
};

type AttentionItem = {
  id: string;
  kind: "Notification" | "Meeting" | "Flow" | "Problem";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type LiveItem = {
  id: string;
  kind: "Meeting" | "Flow";
  title: string;
  detail: string;
  href: string;
  ctaLabel: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type UpcomingItem = {
  id: string;
  kind: "Meeting" | "Flow";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type WorkItem = {
  id: string;
  title: string;
  meta: string;
  description?: string | null;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type ActivityItem = {
  id: string;
  kind: "Meeting" | "Flow" | "Template" | "Problem" | "Text";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type InviteRow = {
  id: string;
  meetingId: string;
  title: string;
  hostEmail: string;
  scheduledStartAt: string | null;
  timezone: string | null;
  dataspaceKey: string;
};

type OpenProblemRow = {
  id: string;
  title: string;
  description: string;
  updatedLabel: string | null;
  createdByEmail: string;
  joinCount: number;
  joinedByMe: boolean;
  createdByMe: boolean;
  href: string;
  dataspaceLabel: string;
  dataspaceColor: string | null;
  dataspaceKey: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  type: "Meeting" | "Template" | "Text";
  startsAt: string;
  href: string;
  dataspaceKey: string;
};

export type DashboardData = {
  dataspaceOptions: Array<{
    key: string;
    label: string;
    color?: string | null;
    imageUrl?: string | null;
  }>;
  attentionItems: AttentionItem[];
  liveItems: LiveItem[];
  upcomingItems: UpcomingItem[];
  activityItems: ActivityItem[];
  upcomingInvites: InviteRow[];
  calendarEvents: CalendarEvent[];
  openProblemRows: OpenProblemRow[];
  meetingItems: WorkItem[];
  completedMeetingItems: WorkItem[];
  flowItems: WorkItem[];
  templateItems: WorkItem[];
  problemItems: WorkItem[];
  counts: {
    notifications: number;
    live: number;
    upcoming: number;
    openProblems: number;
  };
};

function dataspaceKeyFor(
  dataspace: { id: string; personalOwnerId: string | null } | null | undefined,
  userId: string
) {
  if (dataspace?.personalOwnerId === userId) return "personal";
  return dataspace?.id ?? "none";
}

function dataspaceLabelFor(
  dataspace: { name: string; personalOwnerId: string | null } | null | undefined,
  userId: string,
  emptyLabel = "No dataspace"
) {
  if (dataspace?.personalOwnerId === userId) return "My Data Space";
  return dataspace?.name ?? emptyLabel;
}

function buildAttentionItems(args: {
  now: Date;
  upcomingInvites: InviteRow[];
  upcomingItems: Array<{
    id: string;
    title: string;
    startsAt: Date;
    type: "Meeting" | "Template";
    href: string;
    join?: { isPublic: boolean; joinStatus: "PENDING" | "JOINED" | "NONE"; canJoin: boolean };
    dataspaceColor?: string | null;
    dataspaceKey: string;
  }>;
  openProblemRows: OpenProblemRow[];
}) {
  const scored = [
    ...args.upcomingInvites.map((invite) => ({
      score: 100,
      sortTime: invite.scheduledStartAt ? new Date(invite.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER,
      item: {
        id: `invite-${invite.id}`,
        kind: "Notification" as const,
        title: invite.title,
        detail: invite.scheduledStartAt
          ? formatDateTime(new Date(invite.scheduledStartAt), invite.timezone ?? undefined) ?? "Invitation pending"
          : "Invitation pending",
        href: `/meetings/${invite.meetingId}`,
        dataspaceColor: null,
        dataspaceKey: invite.dataspaceKey
      }
    })),
    ...args.upcomingItems
      .filter((item) => item.join && item.join.joinStatus !== "JOINED" && (item.join.canJoin || item.join.isPublic))
      .map((item) => {
        const startsInMs = item.startsAt.getTime() - args.now.getTime();
        const score = startsInMs <= 15 * 60 * 1000 ? 90 : startsInMs <= 60 * 60 * 1000 ? 80 : 70;
        return {
          score,
          sortTime: item.startsAt.getTime(),
          item: {
            id: `upcoming-${item.id}`,
            kind: item.type === "Meeting" ? ("Meeting" as const) : ("Flow" as const),
            title: item.title,
            detail: formatDateTime(item.startsAt) ?? "Scheduled soon",
            href: item.href,
            dataspaceColor: item.dataspaceColor ?? null,
            dataspaceKey: item.dataspaceKey
          }
        };
      }),
    ...args.openProblemRows
      .filter((problem) => !problem.joinedByMe && !problem.createdByMe)
      .slice(0, 6)
      .map((problem) => ({
        score: 50,
        sortTime: 0,
        item: {
          id: `problem-${problem.id}`,
          kind: "Problem" as const,
          title: problem.title,
          detail: `${problem.joinCount} joined · ${problem.updatedLabel ?? "Recently updated"}`,
          href: problem.href,
          dataspaceColor: problem.dataspaceColor,
          dataspaceKey: problem.dataspaceKey
        }
      }))
  ];

  return scored
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.sortTime - b.sortTime))
    .slice(0, 8)
    .map((entry) => entry.item);
}

export async function getDashboardData(sessionUser: DashboardSessionUser): Promise<DashboardData> {
  const [
    meetings,
    dataspaces,
    invites,
    flows,
    templates,
    texts,
    openProblems,
    dataspaceMembers,
    meetingMembers,
    meetingInvites,
    planParticipants,
    planPairs
  ] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        isHidden: false,
        OR: [
          { createdById: sessionUser.id },
          { members: { some: { userId: sessionUser.id } } },
          {
            isPublic: true,
            dataspace: { members: { some: { userId: sessionUser.id } } }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true, imageUrl: true } },
        transcript: { select: { id: true } },
        aiSummary: { select: { status: true, summaryMarkdown: true } }
        ,
        _count: { select: { aiAgentMessages: true } }
      }
    }),
    prisma.dataspace.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { personalOwnerId: sessionUser.id },
          { members: { some: { userId: sessionUser.id } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, personalOwnerId: true, color: true, imageUrl: true }
    }),
    prisma.meetingInvite.findMany({
      where: { userId: sessionUser.id, status: "PENDING" },
      include: {
        meeting: {
          include: {
            createdBy: { select: { email: true } },
            dataspace: { select: { id: true, personalOwnerId: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.plan.findMany({
      where:
        sessionUser.role === "ADMIN"
          ? undefined
          : {
              OR: [
                {
                  rounds: {
                    some: {
                      pairs: {
                        some: {
                          OR: [{ userAId: sessionUser.id }, { userBId: sessionUser.id }]
                        }
                      }
                    }
                  }
                },
                { participants: { some: { userId: sessionUser.id } } },
                {
                  isPublic: true,
                  dataspace: { members: { some: { userId: sessionUser.id } } }
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
    prisma.planTemplate.findMany({
      where: { OR: [{ isPublic: true }, { createdById: sessionUser.id }] },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        blocksJson: true,
        settingsJson: true,
        updatedAt: true,
        createdById: true,
        isPublic: true
      }
    }),
    prisma.text.findMany({
      where: { createdById: sessionUser.id },
      orderBy: { updatedAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true } }
      }
    }),
    prisma.openProblem.findMany({
      where: {
        status: { in: [...OPEN_PROBLEM_ACTIVE_STATUSES] },
        OR: [
          { createdById: sessionUser.id },
          { joins: { some: { userId: sessionUser.id } } },
          { dataspaceId: null },
          { dataspace: { members: { some: { userId: sessionUser.id } } } }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { email: true } },
        joins: { select: { userId: true } },
        dataspace: { select: { id: true, name: true, personalOwnerId: true, color: true } }
      }
    }),
    prisma.dataspaceMember.findMany({
      where: { userId: sessionUser.id },
      select: { dataspaceId: true }
    }),
    prisma.meetingMember.findMany({
      where: { userId: sessionUser.id },
      select: { meetingId: true }
    }),
    prisma.meetingInvite.findMany({
      where: { userId: sessionUser.id, status: "PENDING" },
      select: { meetingId: true }
    }),
    prisma.planParticipant.findMany({
      where: { userId: sessionUser.id },
      select: { planId: true, status: true }
    }),
    prisma.planPair.findMany({
      where: { OR: [{ userAId: sessionUser.id }, { userBId: sessionUser.id }] },
      select: { planRound: { select: { planId: true } } }
    })
  ]);

  const now = new Date();
  const dataspaceMemberIds = new Set(dataspaceMembers.map((member) => member.dataspaceId));
  dataspaces.forEach((dataspace) => {
    if (dataspace.personalOwnerId === sessionUser.id) dataspaceMemberIds.add(dataspace.id);
  });
  const meetingMemberIds = new Set(meetingMembers.map((member) => member.meetingId));
  const meetingInviteIds = new Set(meetingInvites.map((invite) => invite.meetingId));
  const planParticipantMap = new Map(planParticipants.map((participant) => [participant.planId, participant.status]));
  const planPairIds = new Set(
    planPairs.map((pair) => pair.planRound.planId).filter((planId): planId is string => Boolean(planId))
  );

  const rows = meetings.map((meeting) => {
    const isConcluded =
      !meeting.isActive || (meeting.expiresAt ? meeting.expiresAt.getTime() < now.getTime() : false);
    const canEdit =
      (sessionUser.role === "ADMIN" || meeting.createdById === sessionUser.id) && !isConcluded;
    const joinStatus: "PENDING" | "JOINED" | "NONE" =
      meeting.createdById === sessionUser.id || meetingMemberIds.has(meeting.id)
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
      description: meeting.description,
      statusLabel: isMeetingActive(meeting) ? "Active" : "Expired",
      scheduledLabel: formatDateTime(meeting.scheduledStartAt, meeting.timezone) ?? "Not scheduled",
      endedLabel: formatDateTime(meeting.expiresAt, meeting.timezone) ?? "Ended",
      endedAtMs: meeting.expiresAt?.getTime() ?? 0,
      providerLabel: getTranscriptionProviderLabel(meeting.transcriptionProvider),
      dataspaceKey: dataspaceKeyFor(meeting.dataspace, sessionUser.id),
      dataspaceColor: meeting.dataspace?.color ?? null,
      isPublic: meeting.isPublic,
      joinStatus,
      canJoin,
      canEdit,
      isConcluded,
      hasTranscript: Boolean(meeting.transcript?.id),
      hasSummary: Boolean(meeting.aiSummary?.status === "DONE" && meeting.aiSummary?.summaryMarkdown),
      hasAiAgentOutput: (meeting._count?.aiAgentMessages ?? 0) > 0
    };
  });

  const planRows = flows
    .map((plan) => {
      const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce((acc: PlanBlockInput[], block) => {
        const type = normalizeBlockType(block.type) as PlanBlockType | null;
        if (
          !type ||
          ![
            "START",
            "PARTICIPANTS",
            "DISCUSSION",
            "PAUSE",
            "PROMPT",
            "NOTES",
            "RECORD",
            "FORM",
            "EMBED",
            "GROUPING",
            "BREAK",
            "HARMONICA",
            "DEMBRANE",
            "DELIBERAIDE",
            "POLIS",
            "AGORACITIZENS",
            "NEXUSPOLITICS",
            "SUFFRAGO"
          ].includes(type)
        ) {
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
      }, []);

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

      return {
        id: plan.id,
        title: plan.title,
        startLabel: formatDateTime(plan.startAt, plan.timezone),
        startAtMs: plan.startAt.getTime(),
        roundsCount: plan.roundsCount,
        dataspaceKey: dataspaceKeyFor(plan.dataspace, sessionUser.id),
        dataspaceColor: plan.dataspace?.color ?? null,
        isPast: totalEndMs < now.getTime(),
        isPublic: plan.isPublic,
        joinStatus:
          (plan.createdById === sessionUser.id || planPairIds.has(plan.id)
            ? "JOINED"
            : planParticipantMap.get(plan.id) === "PENDING"
              ? "PENDING"
              : planParticipantMap.get(plan.id) === "APPROVED"
                ? "JOINED"
                : "NONE") as "PENDING" | "JOINED" | "NONE",
        canJoin: Boolean(plan.isPublic && plan.dataspaceId && dataspaceMemberIds.has(plan.dataspaceId))
      };
    })
    .sort((a, b) => b.startAtMs - a.startAtMs);

  const textPastCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const templateRows = templates.map((template) => {
    let blocks: TemplateBlock[] = [];
    let settings: TemplateDraftSettings | null = null;
    try {
      blocks = normalizeBlockRecords(JSON.parse(template.blocksJson) as TemplateBlock[]) as TemplateBlock[];
    } catch {
      blocks = [];
    }
    try {
      settings = template.settingsJson ? (JSON.parse(template.settingsJson) as TemplateDraftSettings) : null;
    } catch {
      settings = null;
    }

    return {
      id: template.id,
      title: template.name,
      updatedAt: template.updatedAt,
      updatedLabel: formatDateTime(template.updatedAt),
      blockCount: blocks.length,
      dataspaceKey:
        settings?.dataspaceId && dataspaceMemberIds.has(settings.dataspaceId) ? settings.dataspaceId : "none",
      dataspaceColor: dataspaces.find((dataspace) => dataspace.id === settings?.dataspaceId)?.color ?? null
    };
  });

  const textRows = texts.map((text) => ({
    id: text.id,
    snippet: text.content.trim().split("\n")[0]?.slice(0, 80) ?? "",
    updatedLabel: formatDateTime(text.updatedAt),
    isPast: text.updatedAt < textPastCutoff,
    dataspaceKey: dataspaceKeyFor(text.dataspace, sessionUser.id),
    dataspaceColor: text.dataspace?.color ?? null
  }));

  const openProblemRows = openProblems.map((problem) => ({
    id: problem.id,
    title: problem.title,
    description: problem.description,
    updatedLabel: formatDateTime(problem.updatedAt),
    createdByEmail: problem.createdBy.email,
    joinCount: problem.joins.length,
    joinedByMe: problem.joins.some((join) => join.userId === sessionUser.id),
    createdByMe: problem.createdById === sessionUser.id,
    href: `/open-problems/${problem.id}`,
    dataspaceLabel: dataspaceLabelFor(problem.dataspace, sessionUser.id),
    dataspaceKey: dataspaceKeyFor(problem.dataspace, sessionUser.id),
    dataspaceColor: problem.dataspace?.color ?? null
  }));

  const meetingJoinMap = new Map(
    rows.map((row) => [row.id, { isPublic: row.isPublic, joinStatus: row.joinStatus, canJoin: row.canJoin }])
  );
  const planJoinMap = new Map(
    planRows.map((row) => [row.id, { isPublic: row.isPublic, joinStatus: row.joinStatus, canJoin: row.canJoin }])
  );

  const upcomingMeetings = meetings
    .filter((meeting) => (meeting.scheduledStartAt ?? meeting.createdAt) > now)
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: (meeting.scheduledStartAt ?? meeting.createdAt) as Date,
      type: "Meeting" as const,
      href: `/meetings/${meeting.id}`,
      join: meetingJoinMap.get(meeting.id),
      dataspaceColor: meeting.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(meeting.dataspace, sessionUser.id)
    }));

  const upcomingPlans = flows
    .filter((plan) => plan.startAt > now)
    .map((plan) => ({
      id: plan.id,
      title: plan.title,
      startsAt: plan.startAt,
      type: "Template" as const,
      href: `/flows/${plan.id}`,
      join: planJoinMap.get(plan.id),
      dataspaceColor: plan.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(plan.dataspace, sessionUser.id)
    }));

  const upcomingItemsSource = [...upcomingMeetings, ...upcomingPlans]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 6);

  const liveItems: LiveItem[] = [
    ...rows
      .filter((meeting) => meeting.statusLabel === "Active")
      .slice(0, 6)
      .map((meeting) => ({
        id: `meeting-${meeting.id}`,
        kind: "Meeting" as const,
        title: meeting.title,
        detail: `${meeting.providerLabel} · ${meeting.scheduledLabel}`,
        href: `/meetings/${meeting.id}`,
        ctaLabel: "Open",
        dataspaceColor: meeting.dataspaceColor,
        dataspaceKey: meeting.dataspaceKey
      })),
    ...planRows
      .filter((plan) => !plan.isPast && plan.startAtMs <= now.getTime())
      .slice(0, 6)
      .map((plan) => ({
        id: `flow-${plan.id}`,
        kind: "Flow" as const,
        title: plan.title,
        detail: `${plan.roundsCount} rounds · ${plan.startLabel}`,
        href: `/flows/${plan.id}`,
        ctaLabel: "Open",
        dataspaceColor: plan.dataspaceColor,
        dataspaceKey: plan.dataspaceKey
      }))
  ].slice(0, 6);

  const upcomingInvites = invites
    .filter((invite) => !invite.meeting.scheduledStartAt || invite.meeting.scheduledStartAt > now)
    .slice(0, 5)
    .map((invite) => ({
      id: invite.id,
      meetingId: invite.meetingId,
      title: invite.meeting.title,
      hostEmail: invite.meeting.createdBy.email,
      scheduledStartAt: invite.meeting.scheduledStartAt ? invite.meeting.scheduledStartAt.toISOString() : null,
      timezone: invite.meeting.timezone ?? null,
      dataspaceKey: dataspaceKeyFor(invite.meeting.dataspace, sessionUser.id)
    }));

  const attentionItems = buildAttentionItems({
    now,
    upcomingInvites,
    upcomingItems: upcomingItemsSource,
    openProblemRows
  });

  const activityItems = [
    ...meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      kind: "Meeting" as const,
      title: meeting.title,
      detail: `Meeting updated ${formatDateTime(meeting.updatedAt ?? meeting.createdAt) ?? "recently"}`,
      href: `/meetings/${meeting.id}`,
      date: meeting.updatedAt ?? meeting.createdAt,
      dataspaceColor: meeting.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(meeting.dataspace, sessionUser.id)
    })),
    ...flows.map((plan) => ({
      id: `flow-${plan.id}`,
      kind: "Flow" as const,
      title: plan.title,
      detail: `Flow scheduled ${formatDateTime(plan.startAt, plan.timezone) ?? "soon"}`,
      href: `/flows/${plan.id}`,
      date: plan.createdAt,
      dataspaceColor: plan.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(plan.dataspace, sessionUser.id)
    })),
    ...templateRows.map((template) => ({
      id: `template-${template.id}`,
      kind: "Template" as const,
      title: template.title,
      detail: `${template.blockCount} modules · ${template.updatedLabel ?? "Recently updated"}`,
      href: `/templates/workspace?templateId=${template.id}`,
      date: template.updatedAt,
      dataspaceColor: template.dataspaceColor,
      dataspaceKey: template.dataspaceKey
    })),
    ...openProblems.map((problem) => ({
      id: `problem-${problem.id}`,
      kind: "Problem" as const,
      title: problem.title,
      detail: `${problem.joins.length} joined · ${formatDateTime(problem.updatedAt) ?? "Recently updated"}`,
      href: `/open-problems/${problem.id}`,
      date: problem.updatedAt,
      dataspaceColor: problem.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(problem.dataspace, sessionUser.id)
    })),
    ...texts.map((text) => ({
      id: `text-${text.id}`,
      kind: "Text" as const,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      detail: `Text updated ${formatDateTime(text.updatedAt) ?? "recently"}`,
      href: `/texts/${text.id}`,
      date: text.updatedAt,
      dataspaceColor: text.dataspace?.color ?? null,
      dataspaceKey: dataspaceKeyFor(text.dataspace, sessionUser.id)
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .map(({ date, ...item }) => item);

  const calendarEvents = [
    ...meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      type: "Meeting" as const,
      startsAt: (meeting.scheduledStartAt ?? meeting.createdAt).toISOString(),
      href: `/meetings/${meeting.id}`,
      dataspaceKey: dataspaceKeyFor(meeting.dataspace, sessionUser.id)
    })),
    ...flows.map((plan) => ({
      id: `plan-${plan.id}`,
      title: plan.title,
      type: "Template" as const,
      startsAt: plan.startAt.toISOString(),
      href: `/flows/${plan.id}`,
      dataspaceKey: dataspaceKeyFor(plan.dataspace, sessionUser.id)
    })),
    ...texts.map((text) => ({
      id: `text-${text.id}`,
      title: text.content.trim().split("\n")[0]?.slice(0, 60) || "Text draft",
      type: "Text" as const,
      startsAt: text.updatedAt.toISOString(),
      href: `/texts/${text.id}`,
      dataspaceKey: dataspaceKeyFor(text.dataspace, sessionUser.id)
    }))
  ];

  const dataspaceOptions = [
    { key: "personal", label: "My Data Space", color: null, imageUrl: sessionUser.avatarUrl ?? null },
    { key: "none", label: "No dataspace", color: null, imageUrl: null },
    ...dataspaces
      .filter((dataspace) => !dataspace.personalOwnerId)
      .map((dataspace) => ({
        key: dataspace.id,
        label: dataspace.name,
        color: dataspace.color ?? null,
        imageUrl: dataspace.imageUrl ?? null
      }))
  ];

  return {
    counts: {
      notifications: upcomingInvites.length,
      live: liveItems.length,
      upcoming: upcomingItemsSource.length,
      openProblems: openProblemRows.length
    },
    openProblemRows,
    dataspaceOptions,
    upcomingItems: upcomingItemsSource.map((item) => ({
      id: item.id,
      kind: item.type === "Meeting" ? "Meeting" : "Flow",
      title: item.title,
      detail: formatDateTime(item.startsAt) ?? "Scheduled",
      href: item.href,
      dataspaceColor: item.dataspaceColor ?? null,
      dataspaceKey: item.dataspaceKey
    })),
    liveItems,
    attentionItems,
    activityItems,
    upcomingInvites,
    calendarEvents,
    meetingItems: rows.slice(0, 6).map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.statusLabel} · ${row.scheduledLabel}`,
      description: row.description || null,
      href: `/meetings/${row.id}`,
      dataspaceColor: row.dataspaceColor,
      dataspaceKey: row.dataspaceKey
    })),
    completedMeetingItems: rows
      .filter((row) => row.isConcluded)
      .sort((a, b) => {
        const scoreA =
          (a.hasTranscript ? 4 : 0) +
          (a.hasSummary ? 3 : 0) +
          (a.hasAiAgentOutput ? 2 : 0);
        const scoreB =
          (b.hasTranscript ? 4 : 0) +
          (b.hasSummary ? 3 : 0) +
          (b.hasAiAgentOutput ? 2 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.endedAtMs - a.endedAtMs;
      })
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        title: row.title,
        meta: `${row.hasTranscript ? "Transcript ready" : "No transcript"} · ${row.hasSummary ? "AI summary ready" : "Summary pending"}${row.hasAiAgentOutput ? " · AI agent notes" : ""} · ${row.endedLabel}`,
        description: row.description || null,
        href: `/meetings/${row.id}`,
        dataspaceColor: row.dataspaceColor,
        dataspaceKey: row.dataspaceKey
      })),
    flowItems: planRows.slice(0, 6).map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.startLabel} · ${row.roundsCount} rounds`,
      href: `/flows/${row.id}`,
      dataspaceColor: row.dataspaceColor,
      dataspaceKey: row.dataspaceKey
    })),
    templateItems: templateRows.slice(0, 6).map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.blockCount} modules · ${row.updatedLabel}`,
      href: `/templates/workspace?templateId=${row.id}`,
      dataspaceColor: row.dataspaceColor,
      dataspaceKey: row.dataspaceKey
    })),
    problemItems: openProblemRows.slice(0, 6).map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.joinCount} joined · ${row.updatedLabel ?? "Recently updated"}`,
      href: row.href,
      dataspaceColor: row.dataspaceColor,
      dataspaceKey: row.dataspaceKey
    }))
  };
}
