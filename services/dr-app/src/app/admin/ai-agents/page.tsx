import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AiAgentsAdminClient } from "@/app/admin/ai-agents/AiAgentsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminAiAgentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const agents = await prisma.aiAgent.findMany({
    orderBy: { createdAt: "desc" }
  });

  const runs = await prisma.meetingAiAgentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          username: true,
          color: true
        }
      },
      meeting: {
        select: {
          id: true,
          title: true,
          roomId: true
        }
      }
    }
  });

  return <AiAgentsAdminClient initialAgents={agents} initialRuns={runs} />;
}
