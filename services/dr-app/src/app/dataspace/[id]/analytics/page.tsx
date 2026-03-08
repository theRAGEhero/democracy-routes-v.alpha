import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DataspaceAnalyticsClient } from "@/app/dataspace/[id]/analytics/DataspaceAnalyticsClient";

export default async function DataspaceAnalyticsPage({
  params
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    include: {
      members: { select: { userId: true } }
    }
  });

  if (!dataspace) {
    notFound();
  }

  const isAdmin = session.user.role === "ADMIN";
  const isMember = dataspace.members.some((member) => member.userId === session.user.id);
  if (!isAdmin && !isMember) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  return <DataspaceAnalyticsClient dataspaceId={dataspace.id} />;
}
