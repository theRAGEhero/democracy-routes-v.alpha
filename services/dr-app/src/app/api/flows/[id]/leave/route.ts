import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getPlanViewer } from "@/lib/planGuests";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (plan.runtimeVersion === "LEGACY_PAIR" && viewer.user.id) {
    const fixedParticipants = await prisma.planPair.findFirst({
      where: {
        planRound: { planId: plan.id },
        OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
      },
      select: { id: true }
    });

    if (fixedParticipants) {
      return NextResponse.json(
        { error: "You are assigned to this flow and cannot leave." },
        { status: 400 }
      );
    }
  }

  if (viewer.participantSessionId) {
    await prisma.planParticipantSession.deleteMany({
      where: { id: viewer.participantSessionId, planId: plan.id }
    });
  }

  if (viewer.user.id) {
    await prisma.planParticipant.deleteMany({
      where: {
        planId: plan.id,
        userId: viewer.user.id
      }
    });
    await prisma.planParticipantSession.deleteMany({
      where: {
        planId: plan.id,
        userId: viewer.user.id
      }
    });
  }

  return NextResponse.json({ message: "Left flow" });
}
