import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAnalyzeTablesKey } from "@/app/api/integrations/analyze/utils";

const payloadSchema = z.object({
  planId: z.string().optional(),
  analysis: z.string().min(1),
  prompt: z.string().min(1),
  provider: z.string().optional(),
  createdAt: z.string().optional(),
  metadata: z.unknown().optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireAnalyzeTablesKey(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.planId && parsed.data.planId !== params.id) {
    return NextResponse.json({ error: "Template ID mismatch" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    select: { id: true }
  });
  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const saved = await prisma.planAnalysis.create({
      data: {
        planId: params.id,
        prompt: parsed.data.prompt,
        provider: parsed.data.provider ?? "gemini",
        analysis: parsed.data.analysis
      }
    });

    return NextResponse.json({
      analysis: saved.analysis,
      prompt: saved.prompt,
      provider: saved.provider,
      createdAt: saved.createdAt.toISOString(),
      metadata: parsed.data.metadata ?? null
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2021", "P2022"].includes(error.code)
    ) {
      return NextResponse.json(
        { error: "PlanAnalysis table missing. Apply schema migrations first." },
        { status: 501 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
