import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: true
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!plan.isPublic || !plan.dataspaceId) {
    return NextResponse.json({ error: "Plan is not public" }, { status: 403 });
  }

  const dataspaceMembership = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: plan.dataspaceId,
        userId: session.user.id
      }
    }
  });

  if (!dataspaceMembership) {
    return NextResponse.json({ error: "Not a dataspace member" }, { status: 403 });
  }

  const existingParticipant = await prisma.planParticipant.findUnique({
    where: {
      planId_userId: {
        planId: plan.id,
        userId: session.user.id
      }
    }
  });

  if (existingParticipant) {
    return NextResponse.json({ status: existingParticipant.status });
  }

  const fixedParticipants = await prisma.planPair.findFirst({
    where: {
      planRound: { planId: plan.id },
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
    },
    select: { id: true }
  });

  if (fixedParticipants) {
    return NextResponse.json({ status: "APPROVED" });
  }

  const approvedCount = await prisma.planParticipant.count({
    where: {
      planId: plan.id,
      status: "APPROVED"
    }
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
    return NextResponse.json({ error: "Plan is full" }, { status: 400 });
  }

  const status = plan.requiresApproval ? "PENDING" : "APPROVED";

  await prisma.planParticipant.create({
    data: {
      planId: plan.id,
      userId: session.user.id,
      status
    }
  });

  return NextResponse.json({ status });
}
