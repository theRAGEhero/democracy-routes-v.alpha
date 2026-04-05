import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS,
  getTemplateModuleDescriptions,
  normalizeTemplateModuleDescriptions,
  TEMPLATE_MODULE_DESCRIPTION_KEY
} from "@/lib/templateModuleDescriptions";
import {
  DEFAULT_TEMPLATE_AI_INSTRUCTIONS,
  getTemplateAiInstructions,
  normalizeTemplateAiInstructions,
  TEMPLATE_AI_INSTRUCTIONS_KEY
} from "@/lib/templateAiInstructions";
import { TEMPLATE_BLOCK_TYPES } from "@/lib/templateDraft";

const descriptionsSchema = z.object(
  Object.fromEntries(
    TEMPLATE_BLOCK_TYPES.map((type) => [type, z.string().trim().min(1).max(1200)])
  ) as Record<(typeof TEMPLATE_BLOCK_TYPES)[number], z.ZodString>
);

const payloadSchema = z.object({
  descriptions: descriptionsSchema,
  instructions: z.string().trim().min(1).max(12000)
});

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const descriptions = await getTemplateModuleDescriptions();
  const instructions = await getTemplateAiInstructions();
  return NextResponse.json({
    descriptions,
    defaults: DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS,
    instructions,
    instructionDefaults: DEFAULT_TEMPLATE_AI_INSTRUCTIONS
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse({
    descriptions: normalizeTemplateModuleDescriptions(
      body && typeof body === "object" ? (body as { descriptions?: unknown }).descriptions : null
    ),
    instructions: normalizeTemplateAiInstructions(
      body && typeof body === "object" ? (body as { instructions?: unknown }).instructions : null
    )
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await Promise.all([
    prisma.siteSetting.upsert({
      where: { key: TEMPLATE_MODULE_DESCRIPTION_KEY },
      create: {
        key: TEMPLATE_MODULE_DESCRIPTION_KEY,
        value: JSON.stringify(parsed.data.descriptions)
      },
      update: {
        value: JSON.stringify(parsed.data.descriptions)
      }
    }),
    prisma.siteSetting.upsert({
      where: { key: TEMPLATE_AI_INSTRUCTIONS_KEY },
      create: {
        key: TEMPLATE_AI_INSTRUCTIONS_KEY,
        value: parsed.data.instructions
      },
      update: {
        value: parsed.data.instructions
      }
    })
  ]);

  return NextResponse.json({
    ok: true,
    descriptions: parsed.data.descriptions,
    instructions: parsed.data.instructions
  });
}
