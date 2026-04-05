import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModularBuilderClient } from "@/app/modular/ModularBuilderClient";
import type { TemplateBlock, TemplateDraftSettings } from "@/lib/templateDraft";
import { normalizeBlockRecords } from "@/lib/blockType";

type PageProps = {
  searchParams?: { templateId?: string };
};

export default async function ModularBuilderPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [templates, dataspaces] = await Promise.all([
    prisma.planTemplate.findMany({
      where: {
        OR: [{ isPublic: true }, { createdById: session.user.id }]
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        blocksJson: true,
        settingsJson: true,
        updatedAt: true,
        isPublic: true,
        createdById: true
      }
    }),
    prisma.dataspace.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  const parsedTemplates = templates.map((template) => {
    let blocks: TemplateBlock[] = [];
    let settings: TemplateDraftSettings | null = null;
    try {
      blocks = normalizeBlockRecords(JSON.parse(template.blocksJson) as TemplateBlock[]) as TemplateBlock[];
    } catch {
      blocks = [];
    }
    try {
      settings = template.settingsJson ? (JSON.parse(template.settingsJson) as TemplateDraftSettings) : null;
    } catch {
      settings = null;
    }
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      updatedAt: template.updatedAt.toISOString(),
      isPublic: template.isPublic,
      createdById: template.createdById,
      blocks,
      settings
    };
  });

  return (
    <div className="relative left-1/2 right-1/2 h-[calc(100dvh-72px)] w-screen -mx-[50vw] overflow-hidden px-2">
      <ModularBuilderClient
        templates={parsedTemplates}
        dataspaces={dataspaces}
        initialTemplateId={searchParams?.templateId ?? null}
      />
    </div>
  );
}
