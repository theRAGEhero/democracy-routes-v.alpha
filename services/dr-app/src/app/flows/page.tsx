import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplatesLibraryClient } from "./TemplatesLibraryClient";

type TemplateBlock = {
  type: string;
  durationSeconds: number;
};

export default async function PlansLibraryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const flows = await prisma.planTemplate.findMany({
    where: {
      OR: [{ isPublic: true }, { createdById: session.user.id }]
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      blocksJson: true,
      isPublic: true,
      createdById: true,
      updatedAt: true,
      createdBy: { select: { email: true } }
    }
  });

  const parsed = flows.map((flow) => {
    let blocks: TemplateBlock[] = [];
    try {
      blocks = JSON.parse(flow.blocksJson);
    } catch {
      blocks = [];
    }
    const totalSeconds = blocks.reduce(
      (sum, block) => sum + Math.max(1, Number(block.durationSeconds || 0)),
      0
    );
    const types = blocks.reduce<Record<string, number>>((acc, block) => {
      acc[block.type] = (acc[block.type] || 0) + 1;
      return acc;
    }, {});
    return {
      ...flow,
      totalSeconds,
      types,
      isPublic: flow.isPublic,
      createdById: flow.createdById,
      updatedAt: flow.updatedAt.toISOString(),
      authorEmail: flow.createdBy?.email ?? "Unknown"
    };
  });

  return <TemplatesLibraryClient templates={parsed} currentUserId={session.user.id} />;
}
