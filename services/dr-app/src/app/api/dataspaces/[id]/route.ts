import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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
