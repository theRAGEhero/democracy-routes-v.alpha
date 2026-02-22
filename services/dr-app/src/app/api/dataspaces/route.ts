import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createDataspaceSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDataspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dataspace = await prisma.dataspace.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdById: session.user.id,
      members: {
        create: {
          userId: session.user.id
        }
      }
    }
  });

  return NextResponse.json({ id: dataspace.id });
}
