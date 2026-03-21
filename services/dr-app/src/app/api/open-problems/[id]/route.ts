import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type RouteContext = {
  params: {
    id: string;
  };
};

const updateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  dataspaceId: z.string().trim().cuid().nullable().optional()
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.openProblem.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true, status: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Open problem not found" }, { status: 404 });
  }

  if (existing.createdById !== session.user.id) {
    return NextResponse.json({ error: "Only the original poster can edit this open problem." }, { status: 403 });
  }

  const normalizedDataspaceId = parsed.data.dataspaceId ?? null;
  if (normalizedDataspaceId) {
    const dataspace = await prisma.dataspace.findFirst({
      where: {
        id: normalizedDataspaceId,
        members: { some: { userId: session.user.id } }
      },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Selected dataspace is not available." }, { status: 400 });
    }
  }

  const updated = await prisma.openProblem.update({
    where: { id: params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      dataspaceId: normalizedDataspaceId
    },
    include: {
      createdBy: { select: { email: true } },
      joins: { select: { userId: true } },
      dataspace: { select: { id: true, name: true, color: true } }
    }
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    createdByEmail: updated.createdBy.email,
    createdByMe: updated.createdById === session.user.id,
    joinCount: updated.joins.length,
    joinedByMe: updated.joins.some((join) => join.userId === session.user.id),
    dataspaceId: updated.dataspace?.id ?? null,
    dataspaceName: updated.dataspace?.name ?? null,
    dataspaceColor: updated.dataspace?.color ?? null
  });
}
