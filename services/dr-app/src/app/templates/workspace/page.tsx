import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateWorkspaceClient } from "@/app/templates/workspace/TemplateWorkspaceClient";
import type { TemplateBlock, TemplateDraftSettings } from "@/lib/templateDraft";

type PageProps = {
  searchParams?: { mode?: string; templateId?: string };
};

export default async function TemplateWorkspacePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
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
      blocks = JSON.parse(template.blocksJson) as TemplateBlock[];
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

  const initialMode =
    searchParams?.mode === "ai" || searchParams?.mode === "structured" || searchParams?.mode === "modular"
      ? searchParams.mode
      : "ai";

  return (
    <div className="relative left-1/2 right-1/2 h-[calc(100dvh-24px)] w-screen -mx-[50vw] -mb-6 -mt-6 overflow-hidden px-1 sm:px-2">
      <TemplateWorkspaceClient
        templates={parsedTemplates}
        dataspaces={dataspaces}
        initialMode={initialMode}
        initialTemplateId={searchParams?.templateId ?? null}
      />
    </div>
  );
}
