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
import { TEMPLATE_BLOCK_TYPES } from "@/lib/templateDraft";

const payloadSchema = z.object(
  Object.fromEntries(
    TEMPLATE_BLOCK_TYPES.map((type) => [type, z.string().trim().min(1).max(1200)])
  ) as Record<(typeof TEMPLATE_BLOCK_TYPES)[number], z.ZodString>
);

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const descriptions = await getTemplateModuleDescriptions();
  return NextResponse.json({
    descriptions,
    defaults: DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const normalized = normalizeTemplateModuleDescriptions(body);
  const parsed = payloadSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.siteSetting.upsert({
    where: { key: TEMPLATE_MODULE_DESCRIPTION_KEY },
    create: {
      key: TEMPLATE_MODULE_DESCRIPTION_KEY,
      value: JSON.stringify(parsed.data)
    },
    update: {
      value: JSON.stringify(parsed.data)
    }
  });

  return NextResponse.json({ ok: true, descriptions: parsed.data });
}
