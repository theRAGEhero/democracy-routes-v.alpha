import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const problem = await prisma.openProblem.findUnique({
    where: { id: params.id },
    include: {
      joins: { select: { userId: true } },
      dataspace: { select: { id: true, members: { select: { userId: true } } } }
    }
  });

  if (!problem) {
    return NextResponse.json({ error: "Open problem not found" }, { status: 404 });
  }

  if (problem.dataspace && !problem.dataspace.members.some((member) => member.userId === session.user.id)) {
    return NextResponse.json({ error: "Open problem not available." }, { status: 403 });
  }

  await prisma.openProblemJoin.upsert({
    where: {
      problemId_userId: {
        problemId: params.id,
        userId: session.user.id
      }
    },
    update: {},
    create: {
      problemId: params.id,
      userId: session.user.id
    }
  });

  const joinCount = problem.joins.some((join) => join.userId === session.user.id)
    ? problem.joins.length
    : problem.joins.length + 1;

  return NextResponse.json({
    ok: true,
    joinCount,
    joinedByMe: true
  });
}
