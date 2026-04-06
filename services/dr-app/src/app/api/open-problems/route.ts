import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { OPEN_PROBLEM_VISIBLE_STATUSES } from "@/lib/openProblemStatus";

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  dataspaceId: z.string().trim().cuid().nullable().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        text: z.string().trim().min(1).max(4000)
      })
    )
    .max(40)
    .default([])
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const problems = await prisma.openProblem.findMany({
    where: {
      status: { in: [...OPEN_PROBLEM_VISIBLE_STATUSES] },
      OR: [
        { dataspaceId: null },
        { dataspace: { members: { some: { userId: session.user.id } } } }
      ]
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { email: true } },
      joins: { select: { userId: true } },
      dataspace: { select: { id: true, name: true, color: true } }
    }
  });

  return NextResponse.json({
    problems: problems.map((problem) => ({
      id: problem.id,
      title: problem.title,
      description: problem.description,
      status: problem.status,
      createdAt: problem.createdAt.toISOString(),
      updatedAt: problem.updatedAt.toISOString(),
      createdByEmail: problem.createdBy.email,
      createdByMe: problem.createdById === session.user.id,
      joinCount: problem.joins.length,
      joinedByMe: problem.joins.some((join) => join.userId === session.user.id),
      dataspaceId: problem.dataspace?.id ?? null,
      dataspaceName: problem.dataspace?.name ?? null,
      dataspaceColor: problem.dataspace?.color ?? null
    }))
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const normalizedDataspaceId = payload.dataspaceId ?? null;
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

  const created = await prisma.openProblem.create({
    data: {
      title: payload.title,
      description: payload.description,
      status: "TODO",
      createdById: session.user.id,
      dataspaceId: normalizedDataspaceId,
      joins: {
        create: {
          userId: session.user.id
        }
      },
      messages: payload.messages.length
        ? {
            create: payload.messages.map((message) => ({
              role: message.role,
              text: message.text
            }))
          }
        : undefined
    },
    include: {
      createdBy: { select: { email: true } },
      joins: { select: { userId: true } },
      dataspace: { select: { id: true, name: true, color: true } }
    }
  });

  return NextResponse.json({
    id: created.id,
    title: created.title,
    description: created.description,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    createdByEmail: created.createdBy.email,
    createdByMe: true,
    joinCount: created.joins.length,
    joinedByMe: true,
    dataspaceId: created.dataspace?.id ?? null,
    dataspaceName: created.dataspace?.name ?? null,
    dataspaceColor: created.dataspace?.color ?? null
  });
}
