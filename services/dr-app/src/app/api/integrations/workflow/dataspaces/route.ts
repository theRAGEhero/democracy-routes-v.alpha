import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const dataspaces = await prisma.dataspace.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isPrivate: true, personalOwnerId: true }
  });

  return NextResponse.json({
    dataspaces: dataspaces.map((space: (typeof dataspaces)[number]) => ({
      id: space.id,
      name: space.personalOwnerId ? "My Data Space" : space.name,
      isPrivate: space.isPrivate
    }))
  });
}
