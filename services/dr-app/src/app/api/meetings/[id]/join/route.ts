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

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: true,
      dataspace: true
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!meeting.isPublic || !meeting.dataspaceId) {
    return NextResponse.json({ error: "Meeting is not public" }, { status: 403 });
  }

  const dataspaceMembership = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: meeting.dataspaceId,
        userId: session.user.id
      }
    }
  });

  if (!dataspaceMembership) {
    return NextResponse.json({ error: "Not a dataspace member" }, { status: 403 });
  }

  const existingMember = await prisma.meetingMember.findUnique({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: session.user.id
      }
    }
  });

  if (existingMember) {
    return NextResponse.json({ message: "Already participating" });
  }

  const approvedCount = await prisma.meetingMember.count({
    where: { meetingId: meeting.id }
  });

  if (meeting.capacity && approvedCount >= meeting.capacity) {
    return NextResponse.json({ error: "Meeting is full" }, { status: 400 });
  }

  if (meeting.requiresApproval) {
    await prisma.meetingInvite.upsert({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId: session.user.id
        }
      },
      update: { status: "PENDING" },
      create: {
        meetingId: meeting.id,
        userId: session.user.id,
        status: "PENDING"
      }
    });

    return NextResponse.json({ status: "PENDING" });
  }

  await prisma.meetingMember.create({
    data: {
      meetingId: meeting.id,
      userId: session.user.id,
      role: "GUEST"
    }
  });

  return NextResponse.json({ status: "APPROVED" });
}
