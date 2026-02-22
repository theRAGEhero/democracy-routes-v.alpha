import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(_request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const plan = isAdmin
    ? await prisma.plan.findUnique({
        where: { id: params.id },
        select: { id: true }
      })
    : await prisma.plan.findFirst({
        where: {
          id: params.id,
          OR: [
            {
              rounds: {
                some: {
                  pairs: {
                    some: {
                      OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
                    }
                  }
                }
              }
            },
            {
              participants: { some: { userId: viewer.user.id, status: "APPROVED" } }
            }
          ]
        },
        select: { id: true }
      });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const sessions = await prisma.planRecordSession.findMany({
    where: {
      planId: plan.id,
      userId: viewer.user.id
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      blockId: true,
      transcriptText: true,
      createdAt: true
    }
  });

  return NextResponse.json({ sessions });
}
