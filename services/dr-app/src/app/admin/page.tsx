import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegistrationSettings } from "@/app/admin/RegistrationSettings";
import { TranscriptionJobsTable } from "@/app/admin/TranscriptionJobsTable";
import { AdminInbox } from "@/app/admin/AdminInbox";
import { AdminFeedbackList } from "@/app/admin/AdminFeedbackList";
import { AdminBackupPanel } from "@/app/admin/AdminBackupPanel";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EventHubEvent = {
  id: number;
  createdAt: string;
  source: string;
  type: string;
  severity: string | null;
  message: string | null;
  actorId: string | null;
  dataspaceId: string | null;
  meetingId: string | null;
  templateId: string | null;
};

type EventHubSummary = {
  ok: boolean;
  hours: number;
  since: string;
  totals: {
    total: number;
    errors: number;
    warnings: number;
    sources: number;
  };
  bySource: Array<{ source: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
};

type ServiceStatus = {
  label: string;
  baseUrl: string;
  status: "online" | "offline" | "unknown";
  detail: string;
};

type AdminTab = "services" | "logs" | "messages" | "settings";

async function checkService(
  label: string,
  baseUrl: string | undefined,
  healthPath = "/health",
  headers?: Record<string, string>,
  displayBaseUrl?: string
): Promise<ServiceStatus> {
  if (!baseUrl) {
    return {
      label,
      baseUrl: displayBaseUrl ?? "",
      status: "unknown",
      detail: "Not configured"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${healthPath}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers
    });
    clearTimeout(timeout);
    if (response.ok) {
      return { label, baseUrl: displayBaseUrl ?? baseUrl, status: "online", detail: "OK" };
    }
    return {
      label,
      baseUrl: displayBaseUrl ?? baseUrl,
      status: "offline",
      detail: `HTTP ${response.status}`
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      label,
      baseUrl: displayBaseUrl ?? baseUrl,
      status: "offline",
      detail: "Unreachable"
    };
  }
}

export default async function AdminHomePage({
  searchParams
}: {
  searchParams?: { tab?: string; source?: string; severity?: string; q?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const callBaseRaw = process.env.DEMOCRACYROUTES_CALL_BASE_URL || "";
  const callBaseUrlForDisplay = callBaseRaw || "/video";
  const drVideoBaseUrl =
    callBaseRaw.startsWith("http://") || callBaseRaw.startsWith("https://")
      ? callBaseRaw
      : "http://dr-video:3020";

  const [
    usersCount,
    meetingsCount,
    drAppStatus,
    drVideoStatus,
    deepgramStatus,
    voskStatus,
    matchingStatus,
    hubStatus,
    eventHubStatus,
    thinkerStatus,
    jobs,
    eventHubEvents,
    eventHubSummary,
    drVideoMetrics,
    drVideoHealth,
    recentMeetings,
    recentPlans,
    recentTemplates,
    recentDataspaces,
    recentTexts,
    recentMeetingInvites,
    recentDataspaceInvites,
    recentMatchingRuns
  ] =
    await Promise.all([
    prisma.user.count(),
    prisma.meeting.count({ where: { isHidden: false } }),
    checkService("DR App", process.env.NEXTAUTH_URL, "/"),
    checkService("DR Video", drVideoBaseUrl, "/api/health", undefined, callBaseUrlForDisplay),
    checkService("Audio API Deepgram", process.env.DEEPGRAM_BASE_URL, "/api/rounds"),
    checkService("Audio API Vosk", process.env.VOSK_BASE_URL, "/api/rounds"),
    checkService("Matching API", process.env.DR_MATCHING_BASE_URL, "/api/health", undefined, "/matching-admin"),
    checkService(
      "Transcription Hub",
      process.env.TRANSCRIPTION_HUB_BASE_URL,
      "/api/health",
      undefined,
      process.env.TRANSCRIPTION_HUB_BASE_URL
    ),
    checkService(
      "Event Hub",
      process.env.EVENT_HUB_BASE_URL,
      "/api/health",
      { "x-api-key": String(process.env.EVENT_HUB_API_KEY || "") },
      process.env.EVENT_HUB_BASE_URL
    ),
    checkService("DR Thinker", process.env.ANALYZE_TABLES_API_URL, "/"),
    prisma.transcriptionJob.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        meeting: { select: { id: true, title: true } },
        plan: { select: { id: true, title: true } },
        user: { select: { email: true } }
      }
    }),
    fetch(
      `${String(process.env.EVENT_HUB_BASE_URL || "")
        .replace(/\/$/, "")}/api/events?limit=50${
          searchParams?.source ? `&source=${encodeURIComponent(searchParams.source)}` : ""
        }${
          searchParams?.severity ? `&severity=${encodeURIComponent(searchParams.severity)}` : ""
        }${
          searchParams?.q ? `&q=${encodeURIComponent(searchParams.q)}` : ""
        }`,
      {
        cache: "no-store",
        headers: {
          "x-api-key": String(process.env.EVENT_HUB_API_KEY || "")
        }
      }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => payload?.events ?? [])
      .catch(() => []),
    fetch(
      `${String(process.env.EVENT_HUB_BASE_URL || "").replace(/\/$/, "")}/api/events/summary?hours=24`,
      {
        cache: "no-store",
        headers: {
          "x-api-key": String(process.env.EVENT_HUB_API_KEY || "")
        }
      }
    )
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    fetch(`${drVideoBaseUrl.replace(/\/$/, "")}/api/metrics/hub`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    fetch(`${drVideoBaseUrl.replace(/\/$/, "")}/api/health`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, createdAt: true }
    }),
    prisma.plan.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, createdAt: true }
    }),
    prisma.planTemplate.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, createdAt: true }
    }),
    prisma.dataspace.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, createdAt: true }
    }),
    prisma.text.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, createdAt: true }
    }),
    prisma.meetingInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { createdAt: true, meeting: { select: { id: true, title: true } }, user: { select: { email: true } } }
    }),
    prisma.dataspaceInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { createdAt: true, dataspace: { select: { id: true, name: true } }, user: { select: { email: true } } }
    }),
    prisma.matchingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { createdAt: true, planId: true, plan: { select: { title: true } }, mode: true }
    })
  ]);

  const recentEvents = [
    ...recentMeetings.map((item) => ({
      id: `meeting-${item.id}`,
      title: `Meeting created: ${item.title}`,
      href: `/meetings/${item.id}`,
      at: item.createdAt
    })),
    ...recentPlans.map((item) => ({
      id: `plan-${item.id}`,
      title: `Template run created: ${item.title}`,
      href: `/flows/${item.id}`,
      at: item.createdAt
    })),
    ...recentTemplates.map((item) => ({
      id: `template-${item.id}`,
      title: `Template created: ${item.name}`,
      href: `/flows/new?templateId=${item.id}`,
      at: item.createdAt
    })),
    ...recentDataspaces.map((item) => ({
      id: `dataspace-${item.id}`,
      title: `Dataspace created: ${item.name}`,
      href: `/dataspace/${item.id}`,
      at: item.createdAt
    })),
    ...recentTexts.map((item) => ({
      id: `text-${item.id}`,
      title: "Text imported",
      href: `/texts/${item.id}`,
      at: item.createdAt
    })),
    ...recentMeetingInvites.map((item, index) => ({
      id: `meeting-invite-${index}`,
      title: `Meeting invite sent to ${item.user.email} (${item.meeting.title})`,
      href: `/meetings/${item.meeting.id}`,
      at: item.createdAt
    })),
    ...recentDataspaceInvites.map((item, index) => ({
      id: `dataspace-invite-${index}`,
      title: `Dataspace invite sent to ${item.user.email} (${item.dataspace.name})`,
      href: `/dataspace/${item.dataspace.id}`,
      at: item.createdAt
    })),
    ...recentMatchingRuns.map((item, index) => ({
      id: `matching-${index}`,
      title: `Matching run (${item.mode}) for ${item.plan?.title ?? item.planId}`,
      href: `/flows/${item.planId}`,
      at: item.createdAt
    }))
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  const globalAdminShortcuts = [
    { href: "/admin/users", label: "Users" },
    { href: "/admin/global-dashboard", label: "Global dashboard" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/remote-workers", label: "Remote workers" },
    { href: "/flows/new?mode=template", label: "Create template" },
    { href: "/tutorial", label: "Tutorial" }
  ];

  const serviceAdminLinks: Record<string, string | null> = {
    "DR App": null,
    "DR Video": null,
    "Audio API Deepgram": "/admin/audio/deepgram",
    "Audio API Vosk": "/admin/audio/vosk",
    "Matching API": "/admin/matching",
    "Transcription Hub": null,
    "Event Hub": null,
    "DR Thinker": "/admin/thinking"
  };

  const stackServices = [
    drAppStatus,
    drVideoStatus,
    deepgramStatus,
    voskStatus,
    matchingStatus,
    hubStatus,
    eventHubStatus,
    thinkerStatus
  ];

  const currentTab: AdminTab =
    searchParams?.tab === "logs" ||
    searchParams?.tab === "messages" ||
    searchParams?.tab === "settings"
      ? searchParams.tab
      : "services";
  const activeLogSource = String(searchParams?.source || "").trim();
  const activeLogSeverity = String(searchParams?.severity || "").trim();
  const activeLogQuery = String(searchParams?.q || "").trim();
  const tabs: Array<{ id: AdminTab; label: string; description: string }> = [
    { id: "services", label: "Services", description: "Stack status and admin entrypoints" },
    { id: "logs", label: "Logs", description: "Events, activity, and transcription jobs" },
    { id: "messages", label: "Messages", description: "Inbox and user feedback" },
    { id: "settings", label: "Settings", description: "Registration, backups, and admin actions" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Admin
        </h1>
        <p className="text-sm text-slate-600">Operations, monitoring, and platform controls.</p>
      </div>

      <div className="dr-card p-3 sm:p-4">
        <div className="grid gap-2 md:grid-cols-4">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/admin?tab=${tab.id}`}
                className={`rounded-2xl border px-4 py-3 transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                  {tab.description}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {currentTab === "services" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="dr-card p-6">
              <p className="text-xs font-semibold uppercase text-slate-500">Users</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{usersCount}</p>
              <Link href="/admin/users" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
                Manage users
              </Link>
            </div>
            <div className="dr-card p-6">
              <p className="text-xs font-semibold uppercase text-slate-500">Meetings</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{meetingsCount}</p>
              <Link
                href="/admin/global-dashboard"
                className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline"
              >
                View global dashboard
              </Link>
            </div>
          </div>
          <div className="dr-card p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Services</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Platform entrypoints and stack health.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {globalAdminShortcuts.length} actions · {stackServices.length} services
              </span>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Admin shortcuts
                    </p>
                    <p className="mt-1 text-sm text-slate-600">Core entrypoints not tied to a specific service.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
                    Quick access
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {globalAdminShortcuts.map((shortcut) => (
                    <Link
                      key={shortcut.href}
                      href={shortcut.href}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {shortcut.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Stack services
                    </p>
                    <p className="mt-1 text-sm text-slate-600">Health checks with service-specific admin actions inside each card.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
                    Live status
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {stackServices.map((service) => (
                    <div
                      key={service.label}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{service.label}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {service.baseUrl || "No base URL set"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase ${
                            service.status === "online"
                              ? "bg-emerald-100 text-emerald-700"
                              : service.status === "offline"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {service.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-600">Status: {service.detail}</p>
                        {serviceAdminLinks[service.label] ? (
                          <Link
                            href={serviceAdminLinks[service.label] as string}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-white"
                          >
                            Open admin
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {currentTab === "logs" ? (
        <>
          <div className="dr-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Centralized Events
                </h3>
                <p className="text-sm text-slate-600">Latest events from the stack.</p>
              </div>
              <span className="text-xs text-slate-500">
                {Array.isArray(eventHubEvents) ? eventHubEvents.length : 0} events
              </span>
            </div>
            {eventHubSummary ? (
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">24h events</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{(eventHubSummary as EventHubSummary).totals.total}</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">Errors</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-700">{(eventHubSummary as EventHubSummary).totals.errors}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Warnings</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-800">{(eventHubSummary as EventHubSummary).totals.warnings}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sources</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{(eventHubSummary as EventHubSummary).totals.sources}</div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin?tab=logs"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  !activeLogSeverity && !activeLogSource && !activeLogQuery
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                All
              </Link>
              <Link
                href="/admin?tab=logs&severity=error"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  activeLogSeverity === "error"
                    ? "border-rose-700 bg-rose-700 text-white"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                Errors
              </Link>
              <Link
                href="/admin?tab=logs&severity=warn"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  activeLogSeverity === "warn"
                    ? "border-amber-700 bg-amber-700 text-white"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                Warnings
              </Link>
              {((eventHubSummary as EventHubSummary | null)?.bySource || []).slice(0, 6).map((item) => (
                <Link
                  key={item.source}
                  href={`/admin?tab=logs&source=${encodeURIComponent(item.source)}`}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    activeLogSource === item.source
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item.source} · {item.count}
                </Link>
              ))}
            </div>
            <div className="mt-4">
              {Array.isArray(eventHubEvents) && eventHubEvents.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/70">
                  <table className="min-w-full text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Time</th>
                        <th className="px-3 py-2 text-left font-semibold">Source</th>
                        <th className="px-3 py-2 text-left font-semibold">Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Severity</th>
                        <th className="px-3 py-2 text-left font-semibold">Message</th>
                        <th className="px-3 py-2 text-left font-semibold">Refs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(eventHubEvents as EventHubEvent[]).map((event) => (
                        <tr key={event.id} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">
                            {formatDateTime(new Date(event.createdAt))}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                              {event.source}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                              {event.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {event.severity ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">
                                {event.severity}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[12px] text-slate-700">
                            {event.message || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">
                            {event.dataspaceId ? <div>DS: {event.dataspaceId}</div> : null}
                            {event.meetingId ? <div>MT: {event.meetingId}</div> : null}
                            {event.templateId ? <div>TP: {event.templateId}</div> : null}
                            {event.actorId ? <div>Actor: {event.actorId}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No events yet.</p>
              )}
            </div>
          </div>

          <div className="dr-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
            <p className="mt-2 text-sm text-slate-600">Latest events across meetings, templates, and dataspaces.</p>
            <div className="mt-4 space-y-3">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No recent activity yet.</p>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                  >
                    <Link href={event.href} className="text-sm font-semibold text-slate-900 hover:underline">
                      {event.title}
                    </Link>
                    <span className="text-xs text-slate-500">{formatDateTime(event.at, null)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <TranscriptionJobsTable
            initialJobs={jobs.map((job: (typeof jobs)[number]) => ({
              id: job.id,
              kind: job.kind,
              status: job.status,
              provider: job.provider,
              roundId: job.roundId,
              meditationIndex: job.meditationIndex,
              attempts: job.attempts,
              lastError: job.lastError,
              lastAttemptAt: job.lastAttemptAt ? job.lastAttemptAt.toISOString() : null,
              updatedAt: job.updatedAt.toISOString(),
              meeting: job.meeting,
              plan: job.plan,
              userEmail: job.user?.email ?? null
            }))}
            initialMetrics={{
              drVideo: {
                ok: drVideoStatus.status === "online",
                rooms: drVideoHealth?.rooms ?? 0,
                peers: drVideoHealth?.peers ?? 0
              },
              hub: {
                ok: Boolean(drVideoMetrics?.ok),
                hubConfigured: Boolean(drVideoMetrics?.hubConfigured),
                pendingQueueSize: drVideoMetrics?.pendingQueueSize ?? 0,
                metrics: drVideoMetrics?.metrics ?? null
              }
            }}
          />
        </>
      ) : null}

      {currentTab === "messages" ? (
        <>
          <AdminInbox />
          <AdminFeedbackList />
        </>
      ) : null}

      {currentTab === "settings" ? (
        <>
          <div className="dr-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Settings shortcuts</h2>
            <p className="mt-2 text-sm text-slate-600">Administrative controls and operational pages.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {globalAdminShortcuts.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {shortcut.label}
                </Link>
              ))}
            </div>
          </div>
          <AdminBackupPanel />
          <RegistrationSettings />
        </>
      ) : null}
    </div>
  );
}
