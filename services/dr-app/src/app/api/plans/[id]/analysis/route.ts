import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";

const analysisSchema = z.object({
  prompt: z.string().min(1).max(5000),
  provider: z.enum(["gemini", "ollama"]).optional()
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getPlanRecapData(params.id, viewer);
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let latest: {
    analysis: string;
    prompt: string;
    provider: string;
    createdAt: Date;
  } | null = null;

  try {
    latest = await prisma.planAnalysis.findFirst({
      where: { planId: params.id },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2021", "P2022"].includes(error.code)
    ) {
      return NextResponse.json({ analysis: null });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!latest) {
    return NextResponse.json({ analysis: null });
  }

  return NextResponse.json({
    analysis: latest.analysis,
    prompt: latest.prompt,
    provider: latest.provider,
    createdAt: latest.createdAt.toISOString()
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = analysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let planRecap: Awaited<ReturnType<typeof getPlanRecapData>>;
  try {
    planRecap = await getPlanRecapData(params.id, viewer);
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const baseUrl = process.env.ANALYZE_TABLES_API_URL || "http://localhost:3001";
  const apiKey = process.env.ANALYZE_TABLES_API_KEY;
  const provider = parsed.data.provider ?? "gemini";

  const response = await fetch(`${baseUrl}/api/plan-analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({
      plan: planRecap.plan,
      recap: planRecap.recap,
      prompt: parsed.data.prompt,
      provider
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Failed to analyze plan", details: errorData },
      { status: response.status }
    );
  }

  const payload = await response.json();

  try {
    const saved = await prisma.planAnalysis.create({
      data: {
        planId: params.id,
        prompt: parsed.data.prompt,
        provider,
        analysis: payload.analysis
      }
    });

    return NextResponse.json({
      analysis: saved.analysis,
      prompt: saved.prompt,
      provider: saved.provider,
      createdAt: saved.createdAt.toISOString(),
      metadata: payload.metadata ?? null
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2021", "P2022"].includes(error.code)
    ) {
      return NextResponse.json({
        analysis: payload.analysis,
        prompt: parsed.data.prompt,
        provider,
        createdAt: new Date().toISOString(),
        metadata: payload.metadata ?? null
      });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
