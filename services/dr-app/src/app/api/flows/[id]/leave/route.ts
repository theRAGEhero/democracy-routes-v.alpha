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
    where: { id: params.id }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const fixedParticipants = await prisma.planPair.findFirst({
    where: {
      planRound: { planId: plan.id },
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
    },
    select: { id: true }
  });

  if (fixedParticipants) {
    return NextResponse.json(
      { error: "You are assigned to this plan and cannot leave." },
      { status: 400 }
    );
  }

  await prisma.planParticipant.deleteMany({
    where: {
      planId: plan.id,
      userId: session.user.id
    }
  });

  return NextResponse.json({ message: "Left plan" });
}
