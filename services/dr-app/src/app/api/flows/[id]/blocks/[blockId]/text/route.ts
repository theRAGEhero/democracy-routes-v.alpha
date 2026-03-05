import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import { z } from "zod";

const textSchema = z.object({
  content: z.string().max(5000)
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string; blockId: string } }
) {
  const viewer = await getPlanViewer(_request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: { select: { members: { select: { userId: true } } } }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const isDataspaceMember = plan.dataspace
    ? plan.dataspace.members.some(
        (member: (typeof plan.dataspace.members)[number]) =>
          member.userId === viewer.user.id
      )
    : false;
  const participantRecord = await prisma.planParticipant.findUnique({
    where: {
      planId_userId: {
        planId: plan.id,
        userId: viewer.user.id
      }
    },
    select: { status: true }
  });
  const participantApproved = participantRecord?.status === "APPROVED";
  const isPairParticipant =
    (await prisma.planPair.findFirst({
      where: {
        planRound: { planId: plan.id },
        OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
      }
    })) !== null;

  if (!isAdmin && !participantApproved && !isPairParticipant && !(plan.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const block = await prisma.planBlock.findFirst({
    where: { id: params.blockId, planId: plan.id, type: "NOTES" }
  });

  if (!block) {
    return NextResponse.json({ error: "Text block not found" }, { status: 404 });
  }

  const entry = await prisma.planTextEntry.findUnique({
    where: {
      blockId_userId: {
        blockId: block.id,
        userId: viewer.user.id
      }
    },
    select: { id: true, content: true, updatedAt: true }
  });

  return NextResponse.json({ entry });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; blockId: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = textSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const block = await prisma.planBlock.findFirst({
    where: { id: params.blockId, planId: params.id, type: "NOTES" }
  });

  if (!block) {
    return NextResponse.json({ error: "Text block not found" }, { status: 404 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: { select: { members: { select: { userId: true } } } }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const isDataspaceMember = plan.dataspace
    ? plan.dataspace.members.some(
        (member: (typeof plan.dataspace.members)[number]) =>
          member.userId === viewer.user.id
      )
    : false;
  const participantRecord = await prisma.planParticipant.findUnique({
    where: {
      planId_userId: {
        planId: plan.id,
        userId: viewer.user.id
      }
    },
    select: { status: true }
  });
  const participantApproved = participantRecord?.status === "APPROVED";
  const isPairParticipant =
    (await prisma.planPair.findFirst({
      where: {
        planRound: { planId: plan.id },
        OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
      }
    })) !== null;

  if (!isAdmin && !participantApproved && !isPairParticipant && !(plan.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.planTextEntry.upsert({
    where: {
      blockId_userId: {
        blockId: block.id,
        userId: viewer.user.id
      }
    },
    update: { content: parsed.data.content },
    create: {
      planId: plan.id,
      blockId: block.id,
      userId: viewer.user.id,
      content: parsed.data.content
    },
    select: { id: true, content: true, updatedAt: true }
  });

  return NextResponse.json({ entry });
}
