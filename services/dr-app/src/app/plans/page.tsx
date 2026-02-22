import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type TemplateBlock = {
  type: string;
  durationSeconds: number;
};

export default async function PlansLibraryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const templates = await prisma.planTemplate.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      blocksJson: true,
      updatedAt: true,
      createdBy: { select: { email: true } }
    }
  });

  const parsed = templates.map((template) => {
    let blocks: TemplateBlock[] = [];
    try {
      blocks = JSON.parse(template.blocksJson);
    } catch {
      blocks = [];
    }
    const totalSeconds = blocks.reduce(
      (sum, block) => sum + Math.max(1, Number(block.durationSeconds || 0)),
      0
    );
    const types = blocks.reduce<Record<string, number>>((acc, block) => {
      acc[block.type] = (acc[block.type] || 0) + 1;
      return acc;
    }, {});
    return {
      ...template,
      totalSeconds,
      types,
      updatedAt: template.updatedAt.toISOString(),
      authorEmail: template.createdBy?.email ?? "Unknown"
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Plans library
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Public plans
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a plan template to start quickly or customize before saving.
          </p>
        </div>
        <Link href="/plans/new" className="dr-button px-4 py-2 text-sm">
          New plan
        </Link>
      </div>

      {parsed.length === 0 ? (
        <div className="dr-card p-6 text-sm text-slate-600">No public plans yet.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {parsed.map((template) => (
            <div key={template.id} className="dr-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {template.description || "No description provided."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">By {template.authorEmail}</p>
                </div>
                <div className="text-xs text-slate-500">
                  Updated {new Date(template.updatedAt).toLocaleString()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold">
                  {formatDuration(template.totalSeconds)} total
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                  {template.types.ROUND ?? 0} pairings
                </span>
                {template.types.MEDITATION ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {template.types.MEDITATION} pauses
                  </span>
                ) : null}
                {template.types.RECORD ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {template.types.RECORD} records
                  </span>
                ) : null}
                {template.types.POSTER ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {template.types.POSTER} prompts
                  </span>
                ) : null}
                {template.types.TEXT ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {template.types.TEXT} notes
                  </span>
                ) : null}
                {template.types.FORM ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {template.types.FORM} forms
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/plans/new?templateId=${template.id}`}
                  className="dr-button px-4 py-2 text-sm"
                >
                  Use this plan
                </Link>
                <Link
                  href={`/plans/new?templateId=${template.id}&customize=1`}
                  className="dr-button-outline px-4 py-2 text-sm"
                >
                  Customize
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
