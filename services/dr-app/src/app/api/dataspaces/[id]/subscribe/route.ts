import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.dataspaceMember.findUnique({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    }
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a dataspace member" }, { status: 403 });
  }

  await prisma.dataspaceSubscription.upsert({
    where: {
      dataspaceId_userId: {
        dataspaceId: params.id,
        userId: session.user.id
      }
    },
    update: {},
    create: {
      dataspaceId: params.id,
      userId: session.user.id
    }
  });

  return NextResponse.json({ subscribed: true });
}
