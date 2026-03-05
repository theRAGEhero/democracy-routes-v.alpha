import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsSnippetSettings } from "@/app/admin/AnalyticsSnippetSettings";

function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;
  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    users7d,
    meetingsTotal,
    meetings7d,
    plansTotal,
    plans7d,
    transcriptsTotal,
    transcripts7d,
    analysesTotal,
    analyses7d,
    jobsTotal,
    jobsPending,
    jobsRunning,
    jobsDone,
    jobsError,
    appLogs24h,
    appErrors24h,
    recentJobs,
    recentErrors
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { isDeleted: false, createdAt: { gte: sevenDaysAgo } } }),
    prisma.meeting.count({ where: { isHidden: false } }),
    prisma.meeting.count({ where: { isHidden: false, createdAt: { gte: sevenDaysAgo } } }),
    prisma.plan.count(),
    prisma.plan.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.meetingTranscript.count(),
    prisma.meetingTranscript.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.planAnalysis.count(),
    prisma.planAnalysis.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.transcriptionJob.count(),
    prisma.transcriptionJob.count({ where: { status: "PENDING" } }),
    prisma.transcriptionJob.count({ where: { status: "RUNNING" } }),
    prisma.transcriptionJob.count({ where: { status: "DONE" } }),
    prisma.transcriptionJob.count({ where: { status: "ERROR" } }),
    prisma.appLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.appLog.count({ where: { createdAt: { gte: oneDayAgo }, level: "ERROR" } }),
    prisma.transcriptionJob.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        kind: true,
        status: true,
        provider: true,
        updatedAt: true,
        meeting: { select: { id: true, title: true } },
        plan: { select: { id: true, title: true } }
      }
    }),
    prisma.appLog.findMany({
      where: { level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, scope: true, message: true, createdAt: true }
    })
  ]);

  const summaryCards = [
    { label: "Users", value: usersTotal, trend: `+${users7d} in 7d` },
    { label: "Meetings", value: meetingsTotal, trend: `+${meetings7d} in 7d` },
    { label: "Templates", value: plansTotal, trend: `+${plans7d} in 7d` },
    { label: "Meeting transcripts", value: transcriptsTotal, trend: `+${transcripts7d} updates in 7d` },
    { label: "Template analyses", value: analysesTotal, trend: `+${analyses7d} in 7d` },
    { label: "App logs (24h)", value: appLogs24h, trend: `${appErrors24h} errors in 24h` }
  ];

  const queueCards = [
    { label: "Pending", value: jobsPending, color: "text-amber-700 bg-amber-100" },
    { label: "Running", value: jobsRunning, color: "text-blue-700 bg-blue-100" },
    { label: "Done", value: jobsDone, color: "text-emerald-700 bg-emerald-100" },
    { label: "Error", value: jobsError, color: "text-rose-700 bg-rose-100" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Analytics
          </h1>
          <p className="text-sm text-slate-600">Unified admin metrics for usage, jobs and system health.</p>
        </div>
        <Link href="/admin" className="dr-button-outline px-4 py-2 text-sm">
          Back to admin
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="dr-card p-5">
            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-600">{card.trend}</p>
          </div>
        ))}
      </div>

      <div className="dr-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Transcription queue</h2>
          <p className="text-xs text-slate-500">Total jobs: {jobsTotal}</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {queueCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{card.label}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${card.color}`}>
                  {percent(card.value, jobsTotal)}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dr-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Latest transcription jobs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Kind</th>
                  <th className="py-2 pr-4 font-medium">Context</th>
                  <th className="py-2 pr-0 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{job.status}</td>
                    <td className="py-2 pr-4">{job.kind}</td>
                    <td className="py-2 pr-4">{job.plan?.title ?? job.meeting?.title ?? "-"}</td>
                    <td className="py-2 pr-0">{job.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dr-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Latest application errors</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 pr-4 font-medium">Message</th>
                  <th className="py-2 pr-0 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{log.scope}</td>
                    <td className="py-2 pr-4">{log.message}</td>
                    <td className="py-2 pr-0">{log.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnalyticsSnippetSettings />
    </div>
  );
}
