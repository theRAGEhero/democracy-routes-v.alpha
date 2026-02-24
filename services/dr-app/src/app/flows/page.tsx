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

  const flows = await prisma.planTemplate.findMany({
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

  const parsed = flows.map((flow) => {
    let blocks: TemplateBlock[] = [];
    try {
      blocks = JSON.parse(flow.blocksJson);
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
      ...flow,
      totalSeconds,
      types,
      updatedAt: flow.updatedAt.toISOString(),
      authorEmail: flow.createdBy?.email ?? "Unknown"
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Template library
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Public templates
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a template to start quickly or customize before saving.
          </p>
        </div>
        <Link href="/flows/new" className="dr-button px-4 py-2 text-sm">
          New template
        </Link>
      </div>

      {parsed.length === 0 ? (
        <div className="dr-card p-6 text-sm text-slate-600">No public templates yet.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {parsed.map((flow) => (
            <div key={flow.id} className="dr-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{flow.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {flow.description || "No description provided."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">By {flow.authorEmail}</p>
                </div>
                <div className="text-xs text-slate-500">
                  Updated {new Date(flow.updatedAt).toLocaleString()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-semibold">
                  {formatDuration(flow.totalSeconds)} total
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                  {flow.types.ROUND ?? 0} pairings
                </span>
                {flow.types.MEDITATION ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {flow.types.MEDITATION} pauses
                  </span>
                ) : null}
                {flow.types.RECORD ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {flow.types.RECORD} records
                  </span>
                ) : null}
                {flow.types.POSTER ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {flow.types.POSTER} prompts
                  </span>
                ) : null}
                {flow.types.TEXT ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {flow.types.TEXT} notes
                  </span>
                ) : null}
                {flow.types.FORM ? (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                    {flow.types.FORM} forms
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/flows/new?templateId=${flow.id}`}
                  className="dr-button px-4 py-2 text-sm"
                >
                  Use this template
                </Link>
                <Link
                  href={`/flows/new?templateId=${flow.id}&customize=1`}
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
