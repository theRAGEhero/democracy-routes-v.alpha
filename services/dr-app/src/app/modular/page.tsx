import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModularBuilderClient } from "@/app/modular/ModularBuilderClient";

type PageProps = {
  searchParams?: { templateId?: string };
};

export default async function ModularBuilderPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const templates = await prisma.planTemplate.findMany({
    where: {
      OR: [{ isPublic: true }, { createdById: session.user.id }]
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      blocksJson: true,
      updatedAt: true,
      isPublic: true,
      createdById: true
    }
  });

  const parsedTemplates = templates.map((template) => {
    let blocks: Array<Record<string, unknown>> = [];
    try {
      blocks = JSON.parse(template.blocksJson);
    } catch {
      blocks = [];
    }
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      updatedAt: template.updatedAt.toISOString(),
      isPublic: template.isPublic,
      createdById: template.createdById,
      blocks
    };
  });

  return (
    <div className="relative left-1/2 right-1/2 h-[calc(100dvh-72px)] w-screen -mx-[50vw] overflow-hidden px-2">
      <ModularBuilderClient
        templates={parsedTemplates}
        initialTemplateId={searchParams?.templateId ?? null}
      />
    </div>
  );
}
