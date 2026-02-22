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

  await prisma.dataspaceSubscription.deleteMany({
    where: {
      dataspaceId: params.id,
      userId: session.user.id
    }
  });

  return NextResponse.json({ subscribed: false });
}
