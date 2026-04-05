import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanBuilderClient } from "@/app/flows/new/PlanBuilderClient";
import { FlowFromTemplateClient } from "@/app/flows/new/FlowFromTemplateClient";
import { normalizeBlockRecords } from "@/lib/blockType";

type PageProps = {
  searchParams?: { mode?: string; templateId?: string };
};

export default async function PlanBuilderPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (searchParams?.mode === "template") {
    const params = new URLSearchParams();
    params.set("mode", "modular");
    if (searchParams?.templateId) {
      params.set("templateId", searchParams.templateId);
    }
    redirect(`/templates/workspace?${params.toString()}`);
  }

  const [users, dataspaces] = await Promise.all([
    prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true }
    }),
    prisma.dataspace.findMany({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  if (searchParams?.templateId) {
    const templateRecord = await prisma.planTemplate.findFirst({
      where: {
        id: searchParams.templateId,
        OR: [{ createdById: session.user.id }, { isPublic: true }]
      },
      select: {
        id: true,
        name: true,
        description: true,
        blocksJson: true,
        settingsJson: true,
        updatedAt: true,
        createdBy: {
          select: {
            email: true
          }
        }
      }
    });

    if (!templateRecord) {
      notFound();
    }

    let blocks: any[] = [];
    let settings: Record<string, unknown> | null = null;

    try {
      blocks = normalizeBlockRecords(JSON.parse(templateRecord.blocksJson));
    } catch {
      blocks = [];
    }

    try {
      settings = templateRecord.settingsJson ? JSON.parse(templateRecord.settingsJson) : null;
    } catch {
      settings = null;
    }

    return (
      <FlowFromTemplateClient
        users={users}
        dataspaces={dataspaces}
        currentUserId={session.user.id}
        template={{
          id: templateRecord.id,
          name: templateRecord.name,
          description: templateRecord.description,
          blocks: (Array.isArray(blocks) ? blocks : []) as any[],
          settings: settings as any,
          createdByEmail: templateRecord.createdBy.email,
          updatedAt: templateRecord.updatedAt.toISOString()
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">
          Build a rotation plan and generate participant links.
        </p>
      </div>
      <PlanBuilderClient users={users} dataspaces={dataspaces} />
    </div>
  );
}
