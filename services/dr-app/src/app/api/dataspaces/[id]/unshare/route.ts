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

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    select: { id: true, isPrivate: true, personalOwnerId: true, createdById: true }
  });

  if (!dataspace) {
    return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
  }

  if (!dataspace.personalOwnerId) {
    return NextResponse.json({ error: "Only personal dataspaces can be unshared" }, { status: 400 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (dataspace.isPrivate) {
    return NextResponse.json({ message: "Dataspace already private" });
  }

  await prisma.dataspace.update({
    where: { id: params.id },
    data: { isPrivate: true }
  });

  await prisma.dataspaceMember.deleteMany({
    where: {
      dataspaceId: dataspace.id,
      userId: { not: dataspace.personalOwnerId }
    }
  });

  return NextResponse.json({ message: "Dataspace unshared" });
}
