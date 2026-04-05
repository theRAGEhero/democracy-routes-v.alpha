import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const flowSettingsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  startAt: z.string().datetime(),
  timezone: z.string().trim().max(120).nullable().optional(),
  dataspaceId: z.string().trim().min(1).nullable().optional(),
  isPublic: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  capacity: z.number().int().positive().max(10000).nullable().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      createdById: true
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Flow not found." }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && plan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = flowSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time." }, { status: 400 });
  }

  const dataspaceId = parsed.data.dataspaceId?.trim() || null;
  if (dataspaceId) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: dataspaceId },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found." }, { status: 404 });
    }
    const membership = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!membership) {
      return NextResponse.json({ error: "Invalid dataspace selection." }, { status: 403 });
    }
  }

  if (parsed.data.isPublic && !dataspaceId) {
    return NextResponse.json(
      { error: "Public flows require a dataspace." },
      { status: 400 }
    );
  }

  const updated = await prisma.plan.update({
    where: { id: params.id },
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      startAt,
      timezone: parsed.data.timezone?.trim() || null,
      dataspaceId,
      isPublic: parsed.data.isPublic,
      requiresApproval: parsed.data.requiresApproval,
      capacity: parsed.data.capacity ?? null
    },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      timezone: true,
      dataspaceId: true,
      isPublic: true,
      requiresApproval: true,
      capacity: true
    }
  });

  return NextResponse.json({
    flow: {
      ...updated,
      startAt: updated.startAt.toISOString()
    }
  });
}
