import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      userEmail: true,
      pagePath: true,
      message: true,
      createdAt: true
    }
  });

  return NextResponse.json({
    feedbacks: feedbacks.map((entry: (typeof feedbacks)[number]) => ({
      id: entry.id,
      userEmail: entry.userEmail,
      pagePath: entry.pagePath,
      message: entry.message,
      createdAt: entry.createdAt.toISOString()
    }))
  });
}
