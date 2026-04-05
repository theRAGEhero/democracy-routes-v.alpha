import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateWorkspaceClient } from "@/app/templates/workspace/TemplateWorkspaceClient";
import type { TemplateBlock, TemplateDraftSettings } from "@/lib/templateDraft";
import { normalizeBlockRecords } from "@/lib/blockType";

type PageProps = {
  searchParams?: { mode?: string; templateId?: string };
};

export default async function TemplateWorkspacePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  if (searchParams?.mode === "structured") {
    const params = new URLSearchParams();
    params.set("mode", "modular");
    if (searchParams?.templateId) {
      params.set("templateId", searchParams.templateId);
    }
    redirect(`/templates/workspace?${params.toString()}`);
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

  const initialMode = "modular";

  return (
    <div className="h-[calc(100dvh-64px)] w-full overflow-hidden px-0 pb-0 pt-0">
      <TemplateWorkspaceClient
        templates={parsedTemplates}
        dataspaces={dataspaces}
        initialMode={initialMode}
        initialTemplateId={searchParams?.templateId ?? null}
      />
    </div>
  );
}
