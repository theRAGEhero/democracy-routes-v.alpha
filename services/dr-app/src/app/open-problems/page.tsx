import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OpenProblemsClient } from "@/app/open-problems/OpenProblemsClient";
import { OPEN_PROBLEM_BOARD_STATUSES } from "@/lib/openProblemStatus";

export default async function OpenProblemsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const [problems, dataspaces] = await Promise.all([
    prisma.openProblem.findMany({
      where: {
        status: { in: [...OPEN_PROBLEM_BOARD_STATUSES] },
        OR: [
          { dataspaceId: null },
          { dataspace: { members: { some: { userId: session.user.id } } } }
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { email: true } },
        joins: { select: { userId: true } },
        dataspace: { select: { id: true, name: true, color: true } }
      }
    }),
    prisma.dataspace.findMany({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, color: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Open Problems Board
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Capture an open problem, place it in Todo, and move it through In Progress, In Review, and Done as the work advances.
        </p>
      </div>
      <OpenProblemsClient
        dataspaces={dataspaces.map((space) => ({
          id: space.id,
          name: space.name,
          color: space.color
        }))}
        initialProblems={problems.map((problem) => ({
          id: problem.id,
          title: problem.title,
          description: problem.description,
          status: problem.status,
          createdAt: problem.createdAt.toISOString(),
          updatedAt: problem.updatedAt.toISOString(),
          createdByEmail: problem.createdBy.email,
          createdByMe: problem.createdById === session.user.id,
          joinCount: problem.joins.length,
          joinedByMe: problem.joins.some((join) => join.userId === session.user.id),
          dataspaceId: problem.dataspace?.id ?? null,
          dataspaceName: problem.dataspace?.name ?? null,
          dataspaceColor: problem.dataspace?.color ?? null
        }))}
      />
    </div>
  );
}
