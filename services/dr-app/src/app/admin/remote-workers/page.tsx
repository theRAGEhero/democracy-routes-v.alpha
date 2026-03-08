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

      <RemoteWorkersAdminClient />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dr-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Workers</h2>
            <span className="text-xs text-slate-500">{workers.length} visible</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Last seen</th>
                  <th className="py-2 pr-0 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{worker.user.email}</td>
                    <td className="py-2 pr-4">{worker.status}</td>
                    <td className="py-2 pr-4">{worker.lastSeenAt ? worker.lastSeenAt.toLocaleString() : "-"}</td>
                    <td className="py-2 pr-0">{worker.label ?? "-"}</td>
                  </tr>
                ))}
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500">
                      No workers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dr-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Queue</h2>
            <span className="text-xs text-slate-500">{jobs.length} jobs</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Claimed by</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-0 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{job.status}</td>
                    <td className="py-2 pr-4">{job.sourceType}</td>
                    <td className="py-2 pr-4">{job.claimedByWorker?.user.email ?? "-"}</td>
                    <td className="py-2 pr-4">{job.createdAt.toLocaleString()}</td>
                    <td className="py-2 pr-0">{job.completedAt ? job.completedAt.toLocaleString() : "-"}</td>
                  </tr>
                ))}
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-slate-500">
                      No jobs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
