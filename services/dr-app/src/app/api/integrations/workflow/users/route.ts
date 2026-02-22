import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const dataspaceId = url.searchParams.get("dataspace_id");

  if (!dataspaceId) {
    return NextResponse.json({ error: "dataspace_id is required" }, { status: 400 });
  }

  const members = await prisma.dataspaceMember.findMany({
    where: { dataspaceId },
    include: { user: { select: { id: true, email: true, isDeleted: true } } },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({
    users: members
      .filter((member: (typeof members)[number]) => !member.user.isDeleted)
      .map((member: (typeof members)[number]) => ({
        id: member.user.id,
        email: member.user.email
      }))
  });
}
