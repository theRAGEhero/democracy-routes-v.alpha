import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RecentDataspace = {
  id: string;
  name: string;
  color: string | null;
  lastActivity: number;
};

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    memberships,
    subscriptions,
    ownedSpaces,
    meetingMemberships,
    meetingsHosted,
    planParticipants,
    plansHosted,
    authoredTexts
  ] = await Promise.all([
    prisma.dataspaceMember.findMany({
      where: { userId: session.user.id },
      select: { dataspaceId: true }
    }),
    prisma.dataspaceSubscription.findMany({
      where: { userId: session.user.id },
      select: { dataspaceId: true }
    }),
    prisma.dataspace.findMany({
      where: { createdById: session.user.id },
      select: { id: true }
    }),
    prisma.meetingMember.findMany({
      where: { userId: session.user.id },
      select: { meetingId: true }
    }),
    prisma.meeting.findMany({
      where: { createdById: session.user.id },
      select: { dataspaceId: true }
    }),
    prisma.planParticipant.findMany({
      where: { userId: session.user.id },
      select: { planId: true }
    }),
    prisma.plan.findMany({
      where: { createdById: session.user.id },
      select: { dataspaceId: true }
    }),
    prisma.text.findMany({
      where: { createdById: session.user.id },
      select: { dataspaceId: true }
    })
  ]);

  const meetingIds = Array.from(new Set(meetingMemberships.map((m) => m.meetingId)));
  const meetingDataspaces = meetingIds.length
    ? await prisma.meeting.findMany({
        where: { id: { in: meetingIds } },
        select: { dataspaceId: true }
      })
    : [];
  const planIds = Array.from(new Set(planParticipants.map((p) => p.planId)));
  const planDataspaces = planIds.length
    ? await prisma.plan.findMany({
        where: { id: { in: planIds } },
        select: { dataspaceId: true }
      })
    : [];

  const dataspaceIds = Array.from(
    new Set(
      [
        ...memberships.map((m) => m.dataspaceId),
        ...subscriptions.map((s) => s.dataspaceId),
        ...ownedSpaces.map((s) => s.id),
        ...meetingDataspaces.map((m) => m.dataspaceId),
        ...meetingsHosted.map((m) => m.dataspaceId),
        ...planDataspaces.map((p) => p.dataspaceId),
        ...plansHosted.map((p) => p.dataspaceId),
        ...authoredTexts.map((t) => t.dataspaceId)
      ].filter((id): id is string => Boolean(id))
    )
  );
  if (dataspaceIds.length === 0) {
    return NextResponse.json({ dataspaces: [] });
  }

  const [dataspaces, meetings, plans, texts] = await Promise.all([
    prisma.dataspace.findMany({
      where: { id: { in: dataspaceIds } },
      select: { id: true, name: true, color: true, createdAt: true }
    }),
    prisma.meeting.findMany({
      where: { dataspaceId: { in: dataspaceIds } },
      select: { dataspaceId: true, updatedAt: true }
    }),
    prisma.plan.findMany({
      where: { dataspaceId: { in: dataspaceIds } },
      select: { dataspaceId: true, updatedAt: true }
    }),
    prisma.text.findMany({
      where: { dataspaceId: { in: dataspaceIds } },
      select: { dataspaceId: true, updatedAt: true }
    })
  ]);

  const activityByDataspace = new Map<string, number>();

  function bump(id: string | null, date: Date | null | undefined) {
    if (!id || !date) return;
    const ms = date.getTime();
    const prev = activityByDataspace.get(id) ?? 0;
    if (ms > prev) activityByDataspace.set(id, ms);
  }

  dataspaces.forEach((space) => bump(space.id, space.createdAt));
  meetings.forEach((meeting) => bump(meeting.dataspaceId ?? null, meeting.updatedAt));
  plans.forEach((plan) => bump(plan.dataspaceId ?? null, plan.updatedAt));
  texts.forEach((text) => bump(text.dataspaceId ?? null, text.updatedAt));

  const recent: RecentDataspace[] = dataspaces
    .map((space) => ({
      id: space.id,
      name: space.name,
      color: space.color ?? null,
      lastActivity: activityByDataspace.get(space.id) ?? space.createdAt.getTime()
    }))
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .slice(0, 5);

  return NextResponse.json({ dataspaces: recent });
}
