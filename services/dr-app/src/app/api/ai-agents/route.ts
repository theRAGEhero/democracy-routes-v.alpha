import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.aiAgent.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      username: true,
      description: true,
      color: true,
      model: true,
      defaultIntervalSeconds: true
    }
  });

  return NextResponse.json({ agents });
}
