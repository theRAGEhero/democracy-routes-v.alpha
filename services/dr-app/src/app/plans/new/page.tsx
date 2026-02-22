import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanBuilderClient } from "@/app/plans/new/PlanBuilderClient";

export default async function PlanBuilderPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [users, dataspaces] = await Promise.all([
    prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true }
    }),
    prisma.dataspace.findMany({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Plan Builder
        </h1>
        <p className="text-sm text-slate-600">
          Build a rotation plan and generate participant links.
        </p>
      </div>
      <PlanBuilderClient users={users} dataspaces={dataspaces} />
    </div>
  );
}
