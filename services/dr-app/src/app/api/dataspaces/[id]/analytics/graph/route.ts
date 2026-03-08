import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type GraphNodeType = "template" | "meeting" | "participant";

type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  x: number;
  y: number;
  meta: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "template-meeting" | "participant-template" | "participant-meeting";
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, email: true } },
      members: { include: { user: { select: { id: true, email: true } } } },
      meetings: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          roomId: true,
          createdAt: true,
          createdById: true,
          createdBy: { select: { id: true, email: true } }
        }
      },
      plans: {
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          startAt: true,
          createdById: true,
          createdBy: { select: { id: true, email: true } }
        }
      }
    }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isMember = dataspace.members.some((member) => member.userId === session.user.id);
  if (!isAdmin && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const meetingIds = dataspace.meetings.map((meeting) => meeting.id);
  const planIds = dataspace.plans.map((plan) => plan.id);

  const [meetingMembers, planParticipants, planPairs] = await Promise.all([
    meetingIds.length
      ? prisma.meetingMember.findMany({
          where: { meetingId: { in: meetingIds } },
          select: {
            meetingId: true,
            user: { select: { id: true, email: true } }
          }
        })
      : [],
    planIds.length
      ? prisma.planParticipant.findMany({
          where: { planId: { in: planIds } },
          select: {
            planId: true,
            user: { select: { id: true, email: true } }
          }
        })
      : [],
    planIds.length
      ? prisma.planPair.findMany({
          where: {
            planRound: { planId: { in: planIds } },
            meetingId: { not: null }
          },
          select: {
            meetingId: true,
            planRound: { select: { planId: true } }
          }
        })
      : []
  ]);

  const participantMap = new Map<
    string,
    {
      nodeId: string;
      email: string;
      userId: string | null;
      meetingIds: Set<string>;
      planIds: Set<string>;
    }
  >();
  const meetingParticipantMap = new Map<string, Set<string>>();
  const planParticipantMap = new Map<string, Set<string>>();

  const ensureParticipant = (user: { id: string; email: string | null } | null | undefined) => {
    const email = normalizeEmail(user?.email);
    if (!email) return null;
    const existing = participantMap.get(email);
    if (existing) return existing;
    const created = {
      nodeId: `participant:${email}`,
      email,
      userId: user?.id ?? null,
      meetingIds: new Set<string>(),
      planIds: new Set<string>()
    };
    participantMap.set(email, created);
    return created;
  };

  dataspace.meetings.forEach((meeting) => {
    const creator = ensureParticipant(meeting.createdBy);
    creator?.meetingIds.add(meeting.id);
    const creatorEmail = normalizeEmail(meeting.createdBy?.email);
    if (creatorEmail) {
      if (!meetingParticipantMap.has(meeting.id)) {
        meetingParticipantMap.set(meeting.id, new Set<string>());
      }
      meetingParticipantMap.get(meeting.id)?.add(creatorEmail);
    }
  });

  dataspace.plans.forEach((plan) => {
    const creator = ensureParticipant(plan.createdBy);
    creator?.planIds.add(plan.id);
    const creatorEmail = normalizeEmail(plan.createdBy?.email);
    if (creatorEmail) {
      if (!planParticipantMap.has(plan.id)) {
        planParticipantMap.set(plan.id, new Set<string>());
      }
      planParticipantMap.get(plan.id)?.add(creatorEmail);
    }
  });

  meetingMembers.forEach((membership) => {
    const participant = ensureParticipant(membership.user);
    participant?.meetingIds.add(membership.meetingId);
    const email = normalizeEmail(membership.user?.email);
    if (email) {
      if (!meetingParticipantMap.has(membership.meetingId)) {
        meetingParticipantMap.set(membership.meetingId, new Set<string>());
      }
      meetingParticipantMap.get(membership.meetingId)?.add(email);
    }
  });

  planParticipants.forEach((participantEntry) => {
    const participant = ensureParticipant(participantEntry.user);
    participant?.planIds.add(participantEntry.planId);
    const email = normalizeEmail(participantEntry.user?.email);
    if (email) {
      if (!planParticipantMap.has(participantEntry.planId)) {
        planParticipantMap.set(participantEntry.planId, new Set<string>());
      }
      planParticipantMap.get(participantEntry.planId)?.add(email);
    }
  });

  const templateMeetingLinks = new Map<string, { planId: string; meetingId: string }>();
  planPairs.forEach((pair) => {
    if (!pair.meetingId) return;
    const key = `${pair.planRound.planId}:${pair.meetingId}`;
    templateMeetingLinks.set(key, {
      planId: pair.planRound.planId,
      meetingId: pair.meetingId
    });
  });

  const templateNodes: GraphNode[] = dataspace.plans.map((plan, index) => ({
    id: `template:${plan.id}`,
    type: "template",
    label: plan.title,
    x: 96,
    y: 96 + index * 124,
    meta: {
      id: plan.id,
      href: `/flows/${plan.id}`,
      description: plan.description ?? null,
      participants: Array.from(planParticipantMap.get(plan.id) ?? []),
      startAt: plan.startAt.toISOString(),
      createdById: plan.createdById
    }
  }));

  const meetingNodes: GraphNode[] = dataspace.meetings.map((meeting, index) => ({
    id: `meeting:${meeting.id}`,
    type: "meeting",
    label: meeting.title,
    x: 432,
    y: 96 + index * 124,
    meta: {
      id: meeting.id,
      href: `/meetings/${meeting.id}`,
      description: meeting.description ?? null,
      roomId: meeting.roomId,
      participants: Array.from(meetingParticipantMap.get(meeting.id) ?? []),
      createdAt: meeting.createdAt.toISOString(),
      createdById: meeting.createdById
    }
  }));

  const sortedParticipants = Array.from(participantMap.values()).sort((a, b) =>
    a.email.localeCompare(b.email)
  );

  const participantNodes: GraphNode[] = sortedParticipants.map((participant, index) => ({
    id: participant.nodeId,
    type: "participant",
    label: participant.email,
    x: 768,
    y: 96 + index * 112,
    meta: {
      userId: participant.userId,
      href: participant.userId ? `/users/${participant.userId}` : undefined,
      meetings: participant.meetingIds.size,
      templates: participant.planIds.size
    }
  }));

  const edges: GraphEdge[] = [];

  sortedParticipants.forEach((participant) => {
    participant.meetingIds.forEach((meetingId) => {
      edges.push({
        id: `edge:${participant.nodeId}:meeting:${meetingId}`,
        source: participant.nodeId,
        target: `meeting:${meetingId}`,
        type: "participant-meeting"
      });
    });
    participant.planIds.forEach((planId) => {
      edges.push({
        id: `edge:${participant.nodeId}:template:${planId}`,
        source: participant.nodeId,
        target: `template:${planId}`,
        type: "participant-template"
      });
    });
  });

  Array.from(templateMeetingLinks.values()).forEach((link) => {
    edges.push({
      id: `edge:template:${link.planId}:meeting:${link.meetingId}`,
      source: `template:${link.planId}`,
      target: `meeting:${link.meetingId}`,
      type: "template-meeting"
    });
  });

  const stats = {
    templates: templateNodes.length,
    meetings: meetingNodes.length,
    participants: participantNodes.length,
    connections: edges.length,
    mostConnectedParticipant:
      sortedParticipants
        .map((participant) => ({
          email: participant.email,
          count: participant.meetingIds.size + participant.planIds.size
        }))
        .sort((a, b) => b.count - a.count)[0] ?? null
  };

  return NextResponse.json({
    dataspace: {
      id: dataspace.id,
      name: dataspace.name,
      color: dataspace.color
    },
    stats,
    nodes: [...templateNodes, ...meetingNodes, ...participantNodes],
    edges
  });
}
