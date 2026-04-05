import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import { FlowSettingsClient } from "@/app/flows/[id]/FlowSettingsClient";

function formatMatchingMode(mode: string | null | undefined) {
  const normalized = normalizeMatchingMode(mode);
  if (normalized === "anti") return "De-polarizing";
  if (normalized === "random") return "Random";
  return "Polarizing";
}

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          durationSeconds: true,
          roundNumber: true,
          roundMaxParticipants: true,
          matchingMode: true
        }
      }
    }
  });

  if (!plan) {
    return <p className="text-sm text-slate-500">Flow not found.</p>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const canEdit = isAdmin || plan.createdById === session.user.id;

  if (!canEdit) {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const dataspaces = await prisma.dataspace.findMany({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  const discussionBlocks = plan.blocks.filter((block) => block.type === "DISCUSSION");
  const matchingBlocks = plan.blocks.filter((block) => block.type === "GROUPING");
  const totalDiscussionMinutes = Math.round(
    discussionBlocks.reduce((sum, block) => sum + block.durationSeconds, 0) / 60
  );
  const matchingModes = Array.from(
    new Set(matchingBlocks.map((block) => formatMatchingMode(block.matchingMode)))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Flow settings
          </h1>
          <p className="text-sm text-slate-600">
            Runtime-only settings for this execution. Process logic remains defined by the template.
          </p>
        </div>
        <Link href={`/flows/${plan.id}`} className="dr-button-outline px-3 py-1 text-xs">
          Back to flow
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <FlowSettingsClient
          planId={plan.id}
          dataspaces={dataspaces}
          initialFlow={{
            title: plan.title,
            description: plan.description,
            startAt: plan.startAt.toISOString(),
            admissionMode: plan.admissionMode === "TIME_WINDOW" ? "TIME_WINDOW" : "ALWAYS_OPEN",
            joinOpensAt: plan.joinOpensAt?.toISOString() ?? null,
            joinClosesAt: plan.joinClosesAt?.toISOString() ?? null,
            lateJoinMinParticipants: plan.lateJoinMinParticipants ?? null,
            runtimeVersion: plan.runtimeVersion,
            timezone: plan.timezone ?? null,
            dataspaceId: plan.dataspaceId ?? null,
            isPublic: plan.isPublic,
            requiresApproval: plan.requiresApproval,
            capacity: plan.capacity ?? null
          }}
        />

        <div className="dr-card space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              From template
            </p>
            <h2
              className="mt-2 text-lg font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Process logic
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              These values are inherited from the template and are intentionally read-only here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Discussion rounds
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {discussionBlocks.length}
              </p>
              <p className="text-xs text-slate-600">{totalDiscussionMinutes} minutes total</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Grouping strategy
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {matchingModes.length > 0 ? matchingModes.join(", ") : "No grouping block"}
              </p>
              <p className="text-xs text-slate-600">
                Defined in the template builder
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Room size default
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {plan.maxParticipantsPerRoom} per room
              </p>
              <p className="text-xs text-slate-600">
                {plan.allowOddGroup ? "Odd groups allowed" : "Odd groups become breaks"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Transcription provider
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {plan.transcriptionProvider}
              </p>
              <p className="text-xs text-slate-600">Inherited from the flow definition</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Language
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">{plan.language}</p>
              <p className="text-xs text-slate-600">Inherited from the template</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
