import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await prisma.dataspaceInvite.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    include: {
      dataspace: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({
    invites: invites.map((invite: (typeof invites)[number]) => ({
      id: invite.id,
      dataspaceId: invite.dataspaceId,
      dataspaceName: invite.dataspace.name
    }))
  });
}
