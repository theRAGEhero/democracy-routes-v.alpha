import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function hasInternalKey(request: Request) {
  const expected = process.env.DR_INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = request.headers.get("x-internal-key");
  return Boolean(provided && provided === expected);
}

export async function GET(request: Request) {
  const session = await getSession();
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin && !hasInternalKey(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = 100;
  const planAnalyses = await prisma.planAnalysis.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        select: {
          id: true,
          title: true,
          dataspace: { select: { id: true, name: true, color: true } }
        }
      }
    }
  });

  let dataspaceAnalyses: Array<{
    id: string;
    dataspaceId: string;
    prompt: string;
    provider: string;
    analysis: string;
    createdAt: Date;
    dataspace?: { id: string; name: string; color: string } | null;
  }> = [];
  try {
    dataspaceAnalyses = await prisma.dataspaceAnalysis.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        dataspace: { select: { id: true, name: true, color: true } }
      }
    });
  } catch {
    dataspaceAnalyses = [];
  }

  return NextResponse.json({
    planAnalyses: planAnalyses.map((entry) => ({
      id: entry.id,
      scope: "template",
      planId: entry.planId,
      planTitle: entry.plan?.title ?? null,
      dataspaceId: entry.plan?.dataspace?.id ?? null,
      dataspaceName: entry.plan?.dataspace?.name ?? null,
      dataspaceColor: entry.plan?.dataspace?.color ?? null,
      prompt: entry.prompt,
      provider: entry.provider,
      analysis: entry.analysis,
      createdAt: entry.createdAt.toISOString()
    })),
    dataspaceAnalyses: dataspaceAnalyses.map((entry) => ({
      id: entry.id,
      scope: "dataspace",
      dataspaceId: entry.dataspaceId,
      dataspaceName: entry.dataspace?.name ?? null,
      dataspaceColor: entry.dataspace?.color ?? null,
      prompt: entry.prompt,
      provider: entry.provider,
      analysis: entry.analysis,
      createdAt: entry.createdAt.toISOString()
    }))
  });
}
