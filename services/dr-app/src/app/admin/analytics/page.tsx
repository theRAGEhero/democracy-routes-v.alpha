import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsSnippetSettings } from "@/app/admin/AnalyticsSnippetSettings";

export const dynamic = "force-dynamic";

async function fetchJson(url: string, headers: Record<string, string> = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers
    });
    clearTimeout(timer);
    if (!response.ok) {
      return null;
    }
    return await response.json().catch(() => null);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;
  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eventHubBase = String(process.env.EVENT_HUB_BASE_URL || "").replace(/\/$/, "");
  const eventHubKey = String(process.env.EVENT_HUB_API_KEY || "").trim();

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
    recentTranscripts,
    transcriptProviderCounts,
    eventSummary,
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
    prisma.meetingTranscript.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        provider: true,
        updatedAt: true,
        meeting: { select: { id: true, title: true, transcriptionProvider: true } }
      }
    }),
    prisma.meetingTranscript.groupBy({
      by: ["provider"],
      _count: { provider: true }
    }),
    eventHubBase && eventHubKey
      ? fetchJson(`${eventHubBase}/api/events/summary?hours=24`, { "x-api-key": eventHubKey })
      : null,
    eventHubBase && eventHubKey
      ? fetchJson(`${eventHubBase}/api/events?limit=12&severity=error`, { "x-api-key": eventHubKey })
      : null
  ]);

  const summaryCards = [
    { label: "Users", value: usersTotal, trend: `+${users7d} in 7d` },
    { label: "Meetings", value: meetingsTotal, trend: `+${meetings7d} in 7d` },
    { label: "Templates", value: plansTotal, trend: `+${plans7d} in 7d` },
    { label: "Meeting transcripts", value: transcriptsTotal, trend: `+${transcripts7d} updates in 7d` },
    { label: "Template analyses", value: analysesTotal, trend: `+${analyses7d} in 7d` },
    {
      label: "Stack events (24h)",
      value: Number(eventSummary?.totals?.total || 0),
      trend: `${Number(eventSummary?.totals?.errors || 0)} errors in 24h`
    }
  ];

  const providerCards = [
    { label: "Deepgram Live", value: transcriptProviderCounts.find((item) => item.provider === "DEEPGRAMLIVE")?._count.provider ?? 0 },
    { label: "Deepgram", value: transcriptProviderCounts.find((item) => item.provider === "DEEPGRAM")?._count.provider ?? 0 },
    { label: "Vosk", value: transcriptProviderCounts.find((item) => item.provider === "VOSK")?._count.provider ?? 0 },
    {
      label: "Remote",
      value:
        (transcriptProviderCounts.find((item) => item.provider === "WHISPERREMOTE")?._count.provider ?? 0) +
        (transcriptProviderCounts.find((item) => item.provider === "REMOTE_WORKER")?._count.provider ?? 0)
    }
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
          <h2 className="text-lg font-semibold text-slate-900">Transcription delivery</h2>
          <p className="text-xs text-slate-500">Canonical transcripts stored in the current stack.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {providerCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-800">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dr-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Latest transcription sessions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Context</th>
                  <th className="py-2 pr-0 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentTranscripts.map((entry) => (
                  <tr key={`${entry.meeting.id}-${entry.updatedAt.toISOString()}`} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{entry.provider}</td>
                    <td className="py-2 pr-4">{entry.meeting.title}</td>
                    <td className="py-2 pr-0">{entry.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dr-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Latest stack errors</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Message</th>
                  <th className="py-2 pr-0 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {(recentErrors?.events ?? []).length === 0 ? (
                  <tr className="border-b border-slate-100 text-slate-500">
                    <td className="py-3 pr-4" colSpan={3}>No recent stack errors.</td>
                  </tr>
                ) : (
                  (recentErrors?.events ?? []).map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-100 text-slate-700">
                      <td className="py-2 pr-4">{log.source}</td>
                      <td className="py-2 pr-4">{log.message ?? log.type}</td>
                      <td className="py-2 pr-0">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnalyticsSnippetSettings />
    </div>
  );
}
