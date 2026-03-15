import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RemoteWorkersAdminClient } from "./RemoteWorkersAdminClient";

export default async function AdminRemoteWorkersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const [workers, jobs] = await Promise.all([
    prisma.remoteWorker.findMany({
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        user: { select: { email: true } }
      }
    }),
    prisma.remoteWorkerJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        claimedByWorker: {
          include: {
            user: { select: { email: true } }
          }
        }
      }
    })
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Remote Workers
          </h1>
          <p className="text-sm text-slate-600">Observe browser workers, queue state, and demo jobs.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="dr-button-outline px-4 py-2 text-sm">
            Back to admin
          </Link>
          <Link href="/remote-worker" className="dr-button-outline px-4 py-2 text-sm">
            Open worker page
          </Link>
        </div>
      </div>

      <RemoteWorkersAdminClient
        workers={workers.map((worker) => ({
          id: worker.id,
          status: worker.status,
          label: worker.label,
          lastSeenAt: worker.lastSeenAt ? worker.lastSeenAt.toISOString() : null,
          user: { email: worker.user.email }
        }))}
        jobs={jobs.map((job) => ({
          id: job.id,
          status: job.status,
          sourceType: job.sourceType,
          provider: job.provider,
          language: job.language,
          error: job.error,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
          claimedByWorker: job.claimedByWorker
            ? { user: { email: job.claimedByWorker.user.email } }
            : null
        }))}
      />
    </div>
  );
}
