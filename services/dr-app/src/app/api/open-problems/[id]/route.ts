import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { OPEN_PROBLEM_BOARD_STATUSES } from "@/lib/openProblemStatus";

type RouteContext = {
  params: {
    id: string;
  };
};

const updateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(10).max(4000).optional(),
    dataspaceId: z.string().trim().cuid().nullable().optional(),
    status: z.enum(OPEN_PROBLEM_BOARD_STATUSES).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.dataspaceId !== undefined ||
      value.status !== undefined,
    { message: "Provide at least one field to update." }
  );

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

  const joined = await prisma.openProblemJoin.findUnique({
    where: {
      problemId_userId: {
        problemId: existing.id,
        userId: session.user.id
      }
    },
    select: { id: true }
  });

  const canEditDetails = existing.createdById === session.user.id;
  const canMoveStatus = canEditDetails || Boolean(joined);

  const wantsDetailEdit =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.dataspaceId !== undefined;

  if (wantsDetailEdit && !canEditDetails) {
    return NextResponse.json({ error: "Only the original poster can edit this open problem." }, { status: 403 });
  }

  if (parsed.data.status !== undefined && !canMoveStatus) {
    return NextResponse.json({ error: "Join this open problem before changing its status." }, { status: 403 });
  }

  const updateData: {
    title?: string;
    description?: string;
    dataspaceId?: string | null;
    status?: (typeof OPEN_PROBLEM_BOARD_STATUSES)[number];
  } = {};

  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title;
  }

  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }

  if (parsed.data.dataspaceId !== undefined) {
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
    updateData.dataspaceId = normalizedDataspaceId;
  }

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
  }

  const updated = await prisma.openProblem.update({
    where: { id: params.id },
    data: updateData,
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
