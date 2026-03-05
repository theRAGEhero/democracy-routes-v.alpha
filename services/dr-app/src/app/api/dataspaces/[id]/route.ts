import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { updateDataspaceSchema } from "@/lib/validators";
import { normalizeHexColor } from "@/lib/dataspaceColor";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateDataspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { id: true, personalOwnerId: true, createdById: true }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const color = normalizeHexColor(parsed.data.color);
  const data: {
    name?: string;
    description?: string | null;
    color?: string;
    imageUrl?: string | null;
    notifyAllActivity?: boolean;
    notifyMeetings?: boolean;
    notifyPlans?: boolean;
    notifyTexts?: boolean;
    rssEnabled?: boolean;
  } = {};

  if (typeof parsed.data.name === "string") {
    data.name = parsed.data.name;
  }
  if (typeof parsed.data.description === "string") {
    data.description = parsed.data.description.trim() ? parsed.data.description : null;
  }
  if (typeof parsed.data.imageUrl === "string") {
    data.imageUrl = parsed.data.imageUrl.trim() ? parsed.data.imageUrl.trim() : null;
  }
  if (color) {
    data.color = color;
  }
  if (typeof parsed.data.notifyAllActivity === "boolean") {
    data.notifyAllActivity = parsed.data.notifyAllActivity;
  }
  if (typeof parsed.data.notifyMeetings === "boolean") {
    data.notifyMeetings = parsed.data.notifyMeetings;
  }
  if (typeof parsed.data.notifyPlans === "boolean") {
    data.notifyPlans = parsed.data.notifyPlans;
  }
  if (typeof parsed.data.notifyTexts === "boolean") {
    data.notifyTexts = parsed.data.notifyTexts;
  }
  if (typeof parsed.data.rssEnabled === "boolean") {
    data.rssEnabled = parsed.data.rssEnabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  const updated = await prisma.dataspace.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json({
    id: updated.id,
    color: updated.color,
    imageUrl: updated.imageUrl
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { id: true }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.meeting.updateMany({
      where: { dataspaceId: params.id },
      data: { dataspaceId: null }
    }),
    prisma.plan.updateMany({
      where: { dataspaceId: params.id },
      data: { dataspaceId: null }
    }),
    prisma.dataspaceMember.deleteMany({
      where: { dataspaceId: params.id }
    }),
    prisma.dataspace.delete({
      where: { id: params.id }
    })
  ]);

  return NextResponse.json({ message: "Dataspace deleted" });
}
