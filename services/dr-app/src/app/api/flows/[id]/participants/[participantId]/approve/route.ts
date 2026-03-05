import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; participantId: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = plan.createdById === session.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const participant = await prisma.planParticipant.findUnique({
    where: { id: params.participantId }
  });

  if (!participant || participant.planId !== plan.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const approvedCount = await prisma.planParticipant.count({
    where: { planId: plan.id, status: "APPROVED" }
  });
  const fixedPairs = await prisma.planPair.findMany({
    where: { planRound: { planId: plan.id } },
    select: { userAId: true, userBId: true }
  });
  const fixedUsers = new Set<string>();
  fixedPairs.forEach((pair: (typeof fixedPairs)[number]) => {
    fixedUsers.add(pair.userAId);
    if (pair.userBId) fixedUsers.add(pair.userBId);
  });

  if (plan.capacity && approvedCount + fixedUsers.size >= plan.capacity) {
    return NextResponse.json({ error: "Template is full" }, { status: 400 });
  }

  await prisma.planParticipant.update({
    where: { id: participant.id },
    data: { status: "APPROVED" }
  });

  return NextResponse.json({ message: "Participant approved" });
}
