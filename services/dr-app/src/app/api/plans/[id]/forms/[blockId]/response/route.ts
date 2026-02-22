import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";

export async function GET(
  request: Request,
  { params }: { params: { id: string; blockId: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await prisma.planFormResponse.findUnique({
    where: {
      blockId_userId: {
        blockId: params.blockId,
        userId: viewer.user.id
      }
    },
    select: { choiceKey: true }
  });

  return NextResponse.json({ choiceKey: response?.choiceKey ?? null });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; blockId: string } }
) {
  const viewer = await getPlanViewer(request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const block = await prisma.planBlock.findFirst({
    where: { id: params.blockId, planId: params.id },
    select: { type: true, formChoicesJson: true }
  });

  if (!block || block.type !== "FORM") {
    return NextResponse.json({ error: "Form block not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const choiceKey = typeof body?.choiceKey === "string" ? body.choiceKey : null;
  if (!choiceKey) {
    return NextResponse.json({ error: "Choice is required." }, { status: 400 });
  }

  let choices: Array<{ key: string; label: string }> = [];
  try {
    choices = block.formChoicesJson ? JSON.parse(block.formChoicesJson) : [];
  } catch {
    choices = [];
  }

  if (!choices.find((choice) => choice.key === choiceKey)) {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }

  await prisma.planFormResponse.upsert({
    where: {
      blockId_userId: {
        blockId: params.blockId,
        userId: viewer.user.id
      }
    },
    create: {
      planId: params.id,
      blockId: params.blockId,
      userId: viewer.user.id,
      choiceKey
    },
    update: {
      choiceKey
    }
  });

  return NextResponse.json({ ok: true, choiceKey });
}
