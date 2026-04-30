"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UpcomingInvites } from "@/app/dashboard/UpcomingInvites";
import { CalendarPanel } from "@/app/dashboard/CalendarPanel";

type DataspaceOption = {
  key: string;
  label: string;
  color?: string | null;
  imageUrl?: string | null;
};

type AttentionItem = {
  id: string;
  kind: "Notification" | "Meeting" | "Flow" | "Problem";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type LiveItem = {
  id: string;
  kind: "Meeting" | "Flow";
  title: string;
  detail: string;
  href: string;
  ctaLabel: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type UpcomingItem = {
  id: string;
  kind: "Meeting" | "Flow";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type WorkItem = {
  id: string;
  title: string;
  meta: string;
  description?: string | null;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type ActivityItem = {
  id: string;
  kind: "Meeting" | "Flow" | "Template" | "Problem" | "Text";
  title: string;
  detail: string;
  href: string;
  dataspaceKey: string;
  dataspaceColor?: string | null;
};

type InviteRow = {
  id: string;
  meetingId: string;
  title: string;
  hostEmail: string;
  scheduledStartAt: string | null;
  timezone: string | null;
  dataspaceKey: string;
};

type OpenProblemRow = {
  id: string;
  title: string;
  description: string;
  updatedLabel: string | null;
  createdByEmail: string;
  joinCount: number;
  joinedByMe: boolean;
  createdByMe: boolean;
  href: string;
  dataspaceLabel: string;
  dataspaceColor: string | null;
  dataspaceKey: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  type: "Meeting" | "Template" | "Text";
  startsAt: string;
  href: string;
  dataspaceKey: string;
};

type Props = {
  dataspaceOptions: DataspaceOption[];
  attentionItems: AttentionItem[];
  liveItems: LiveItem[];
  upcomingItems: UpcomingItem[];
  activityItems: ActivityItem[];
  upcomingInvites: InviteRow[];
  calendarEvents: CalendarEvent[];
  openProblemRows: OpenProblemRow[];
  meetingItems: WorkItem[];
  completedMeetingItems: WorkItem[];
  flowItems: WorkItem[];
  templateItems: WorkItem[];
  problemItems: WorkItem[];
  counts: {
    notifications: number;
    live: number;
    upcoming: number;
    openProblems: number;
  };
};

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-white/55 px-5 py-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}

function kindBadgeClass(kind: AttentionItem["kind"] | LiveItem["kind"] | UpcomingItem["kind"] | ActivityItem["kind"]) {
  switch (kind) {
    case "Meeting":
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
    case "Flow":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "Template":
      return "bg-violet-100 text-violet-800 ring-1 ring-violet-200";
    case "Problem":
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    case "Text":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
  }
}

function DataspaceDot({ color }: { color?: string | null }) {
  return color ? (
    <span
      className="h-2.5 w-2.5 rounded-full border border-white/80 shadow-sm"
      style={{ backgroundColor: color }}
    />
  ) : (
    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
  );
}

function OverviewCard({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dr-card overflow-hidden border-none bg-white/72 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="dr-button-outline px-3 py-1.5 text-xs">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function QuickActionGrid() {
  const actions = [
    { href: "/meetings/new", label: "New meeting", description: "Start a live or scheduled session." },
    { href: "/flows/new", label: "New flow", description: "Launch a citizen assembly or template execution." },
    { href: "/templates/workspace", label: "New template", description: "Open the modular builder and design a process." },
    { href: "/open-problems", label: "Open problem", description: "Capture a new problem or continue an existing one." }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="rounded-[24px] border border-slate-200/80 bg-white/82 px-4 py-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
        >
          <p className="text-sm font-semibold text-slate-950">{action.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
        </Link>
      ))}
    </div>
  );
}

function DataspaceFilterRail({
  options,
  selectedDataspaces,
  onReset,
  onToggle
}: {
  options: DataspaceOption[];
  selectedDataspaces: string[];
  onReset: () => void;
  onToggle: (key: string) => void;
}) {
  return (
    <aside className="order-2 lg:order-1 lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:w-24 lg:flex-shrink-0 lg:self-start">
      <div className="dr-card flex h-full min-h-0 flex-col p-1.5 lg:p-2">
        <div className="mb-2 hidden px-1 lg:block">
          <p className="text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Dataspaces
          </p>
        </div>
        <div className="flex min-h-0 flex-1 gap-1.5 overflow-x-auto px-0.5 lg:gap-2 lg:flex-col lg:items-center lg:overflow-y-auto lg:overflow-x-hidden">
          <button
            type="button"
            onClick={onReset}
            className={`group flex min-w-fit items-center gap-1 rounded-xl px-1.5 py-1 text-center transition lg:flex-col lg:gap-1 lg:rounded-2xl lg:px-1 lg:py-1.5 ${
              selectedDataspaces.length === 0
                ? "bg-slate-900/6 text-slate-950 ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="All dataspaces"
          >
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-[9px] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.35)] transition lg:h-10 lg:w-10 lg:text-[10px] ${
                selectedDataspaces.length === 0
                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_0_12px_rgba(15,23,42,0.28)]"
                  : "border-slate-200 bg-white text-slate-600 group-hover:border-slate-300"
              }`}
            >
              <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/40" />
              All
            </span>
            <span className="hidden max-w-[60px] text-[8px] font-semibold leading-tight lg:block">All</span>
          </button>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onToggle(option.key)}
              className={`group flex min-w-fit items-center gap-1 rounded-xl px-1.5 py-1 text-center transition lg:flex-col lg:gap-1 lg:rounded-2xl lg:px-1 lg:py-1.5 ${
                selectedDataspaces.includes(option.key)
                  ? "bg-white/90 text-slate-950 ring-1 ring-slate-200 shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title={option.label}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-white transition lg:h-10 lg:w-10 ${
                  selectedDataspaces.includes(option.key)
                    ? "border-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.45),0_0_14px_var(--glow-color)]"
                    : "border-slate-200 group-hover:border-slate-300"
                }`}
                style={
                  {
                    ["--glow-color" as any]: option.color
                      ? `${option.color}cc`
                      : "rgba(15,23,42,0.35)"
                  } as any
                }
              >
                {option.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.imageUrl} alt={option.label} className="h-full w-full object-cover" />
                ) : option.color ? (
                  <span
                    className="h-full w-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), ${option.color})`
                    }}
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-600">
                    {option.label.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    boxShadow: option.color
                      ? `inset 0 0 0 2px rgba(255,255,255,0.45), 0 0 16px ${option.color}99`
                      : "inset 0 0 0 2px rgba(255,255,255,0.35)"
                  }}
                />
              </span>
              <span className="hidden max-w-[60px] text-[8px] font-semibold leading-tight lg:block">
                {option.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="mt-1 hidden text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900 lg:block"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}

function PriorityList({
  items,
  emptyTitle,
  emptyDescription
}: {
  items: Array<AttentionItem | LiveItem | UpcomingItem>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.88))] px-4 py-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DataspaceDot color={item.dataspaceColor} />
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${kindBadgeClass(item.kind)}`}>
                {item.kind}
              </span>
              <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">{item.title}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm">{item.detail}</p>
          </div>
          <Link href={item.href} className="dr-button-outline px-3 py-1.5 text-xs">
            {"ctaLabel" in item ? item.ctaLabel : "Open"}
          </Link>
        </div>
      ))}
    </div>
  );
}

function WorkPanel({
  title,
  count,
  actionHref,
  actionLabel,
  items,
  emptyTitle,
  emptyDescription
}: {
  title: string;
  count: number;
  actionHref: string;
  actionLabel: string;
  items: WorkItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/78 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">{count} total in this view</p>
        </div>
        <Link href={actionHref} className="dr-button-outline px-3 py-1.5 text-xs">
          {actionLabel}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-[18px] border border-slate-200/80 bg-white/80 px-3 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <DataspaceDot color={item.dataspaceColor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="truncate text-xs text-slate-500">{item.meta}</p>
                {item.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeList({
  items
}: {
  items: Array<WorkItem & { kind: "Meeting" | "Flow" | "Template" | "Problem" }>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing Recent"
        description="Your most recently active meetings, flows, templates, and problems will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={`${item.kind}-${item.id}`}
          href={item.href}
          className="flex items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
        >
          <DataspaceDot color={item.dataspaceColor} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${kindBadgeClass(item.kind)}`}>
                {item.kind}
              </span>
              <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
            </div>
            <p className="mt-2 truncate text-xs text-slate-500">{item.meta}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No Recent Activity"
        description="New templates, flows, meetings, and problem updates will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="block rounded-[24px] border border-slate-200/80 bg-white/82 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
        >
          <div className="flex flex-wrap items-center gap-2">
            <DataspaceDot color={item.dataspaceColor} />
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${kindBadgeClass(item.kind)}`}>
              {item.kind}
            </span>
            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
        </Link>
      ))}
    </div>
  );
}

function OpenProblemsList({
  problems,
  joiningProblemId,
  onJoin
}: {
  problems: OpenProblemRow[];
  joiningProblemId: string | null;
  onJoin: (problemId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {problems.length === 0 ? (
        <EmptyState
          title="No Active Problems"
          description="Nothing is open for the current dataspace selection."
        />
      ) : (
        problems.map((problem) => (
          <div
            key={problem.id}
            className="rounded-[26px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DataspaceDot color={problem.dataspaceColor} />
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 ring-1 ring-amber-200">
                    Open Problem
                  </span>
                  <p className="text-base font-semibold text-slate-950">{problem.title}</p>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{problem.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {!problem.createdByMe && !problem.joinedByMe ? (
                  <button
                    type="button"
                    onClick={() => onJoin(problem.id)}
                    disabled={joiningProblemId === problem.id}
                    className="dr-button-outline px-3 py-1.5 text-xs"
                  >
                    {joiningProblemId === problem.id ? "Joining..." : "Join"}
                  </button>
                ) : null}
                <Link href={problem.href} className="dr-button px-3 py-1.5 text-xs">
                  Open
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{problem.updatedLabel ?? "Recently updated"}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{problem.dataspaceLabel}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{problem.joinCount} joined</span>
              {problem.joinedByMe ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                  You joined
                </span>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function DashboardTabs({
  dataspaceOptions,
  attentionItems,
  liveItems,
  upcomingItems,
  activityItems,
  upcomingInvites,
  calendarEvents,
  openProblemRows,
  meetingItems,
  completedMeetingItems,
  flowItems,
  templateItems,
  problemItems,
  counts: _counts
}: Props) {
  const [selectedDataspaces, setSelectedDataspaces] = useState<string[]>([]);
  const [openProblems, setOpenProblems] = useState<OpenProblemRow[]>(openProblemRows);
  const [joiningProblemId, setJoiningProblemId] = useState<string | null>(null);

  useEffect(() => {
    setOpenProblems(openProblemRows);
  }, [openProblemRows]);

  const activeDataspaceKeys = selectedDataspaces.length > 0 ? new Set(selectedDataspaces) : null;
  const includeByDataspace = (key: string) => !activeDataspaceKeys || activeDataspaceKeys.has(key);

  const scopedAttention = attentionItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedLive = liveItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedUpcoming = upcomingItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedActivity = activityItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedInvites = upcomingInvites.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedCalendar = calendarEvents.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedOpenProblems = openProblems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedMeetings = meetingItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedCompletedMeetings = completedMeetingItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedFlows = flowItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedTemplates = templateItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedProblems = problemItems.filter((row) => includeByDataspace(row.dataspaceKey));

  const resumeItems = useMemo(
    () =>
      [
        ...scopedMeetings.slice(0, 3).map((item) => ({ ...item, kind: "Meeting" as const })),
        ...scopedFlows.slice(0, 2).map((item) => ({ ...item, kind: "Flow" as const })),
        ...scopedTemplates.slice(0, 2).map((item) => ({ ...item, kind: "Template" as const })),
        ...scopedProblems.slice(0, 2).map((item) => ({ ...item, kind: "Problem" as const }))
      ].slice(0, 6),
    [scopedMeetings, scopedFlows, scopedTemplates, scopedProblems]
  );

  function toggleDataspace(key: string) {
    setSelectedDataspaces((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }

  async function handleJoinOpenProblem(problemId: string) {
    if (joiningProblemId) return;
    setJoiningProblemId(problemId);
    try {
      const response = await fetch(`/api/open-problems/${problemId}/join`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return;
      setOpenProblems((current) =>
        current.map((problem) =>
          problem.id === problemId
            ? {
                ...problem,
                joinedByMe: Boolean(payload?.joinedByMe ?? true),
                joinCount:
                  typeof payload?.joinCount === "number"
                    ? payload.joinCount
                    : problem.joinedByMe
                      ? problem.joinCount
                      : problem.joinCount + 1
              }
            : problem
        )
      );
    } finally {
      setJoiningProblemId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <DataspaceFilterRail
        options={dataspaceOptions}
        selectedDataspaces={selectedDataspaces}
        onReset={() => setSelectedDataspaces([])}
        onToggle={toggleDataspace}
      />

      <div className="order-1 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:order-2 lg:min-w-0">
        <div className="min-h-0 flex-1 overflow-auto pb-1">
          <div className="space-y-4">
            <OverviewCard title="Quick actions" subtitle="Create or launch without leaving the dashboard.">
              <QuickActionGrid />
            </OverviewCard>

            <OverviewCard
              title="Resume where you left off"
              subtitle="Jump back into the most recent work that is likely still relevant."
            >
              <ResumeList items={resumeItems} />
            </OverviewCard>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <OverviewCard title="Needs attention" subtitle="Things that require a response or decision right now.">
                <div className="space-y-5">
                  <PriorityList
                    items={scopedAttention}
                    emptyTitle="Nothing Urgent"
                    emptyDescription="No invites, approvals, or near-term actions need attention right now."
                  />
                  <div className="border-t border-slate-200/80 pt-4">
                    <UpcomingInvites invites={scopedInvites} title="Pending notifications" />
                  </div>
                </div>
              </OverviewCard>

              <OverviewCard title="Meetings and flows" subtitle="What is already running, and what is coming soon.">
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Live now
                    </p>
                    <PriorityList
                      items={scopedLive}
                      emptyTitle="Nothing Live"
                      emptyDescription="Active meetings and live flows will appear here."
                    />
                  </div>
                  <div className="border-t border-slate-200/80 pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Up next
                    </p>
                    <PriorityList
                      items={scopedUpcoming}
                      emptyTitle="Nothing Scheduled"
                      emptyDescription="Upcoming meetings and flows will appear here once they are scheduled."
                    />
                  </div>
                </div>
              </OverviewCard>
            </div>

            <OverviewCard
              title="Recent completed meetings"
              subtitle="Finished meetings still matter here because they contain transcripts, summaries, and useful decisions."
              actionHref="/meetings"
              actionLabel="All meetings"
            >
              <div className="grid gap-3 xl:grid-cols-2">
                {scopedCompletedMeetings.length === 0 ? (
                  <EmptyState
                    title="No Completed Meetings"
                    description="Closed meetings with transcripts and summaries will appear here for review."
                  />
                ) : (
                  scopedCompletedMeetings.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.9))] px-4 py-4 transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <DataspaceDot color={item.dataspaceColor} />
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                          Completed
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.meta}</p>
                      {item.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600/90">
                          {item.description}
                        </p>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </OverviewCard>

            <OverviewCard title="My work" subtitle="The main objects you are editing and running.">
              <div className="grid gap-4 xl:grid-cols-3">
                <WorkPanel
                  title="Meetings"
                  count={scopedMeetings.length}
                  actionHref="/meetings"
                  actionLabel="View all"
                  items={scopedMeetings.slice(0, 4)}
                  emptyTitle="No Meetings"
                  emptyDescription="Meetings you create or join will appear here."
                />
                <WorkPanel
                  title="Flows"
                  count={scopedFlows.length}
                  actionHref="/flows"
                  actionLabel="View all"
                  items={scopedFlows.slice(0, 4)}
                  emptyTitle="No Flows"
                  emptyDescription="Citizen assemblies and template executions will appear here."
                />
                <WorkPanel
                  title="Templates"
                  count={scopedTemplates.length}
                  actionHref="/templates/workspace"
                  actionLabel="Open workspace"
                  items={scopedTemplates.slice(0, 4)}
                  emptyTitle="No Templates"
                  emptyDescription="Reusable process templates will appear here."
                />
              </div>
            </OverviewCard>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <OverviewCard title="Dataspace activity" subtitle="A short feed of recent work across the platform.">
                <ActivityFeed items={scopedActivity.slice(0, 6)} />
              </OverviewCard>

              <OverviewCard title="Calendar snapshot" subtitle="A compact time-based view of upcoming work.">
                <CalendarPanel events={scopedCalendar} />
              </OverviewCard>
            </div>

            <OverviewCard
              title="Open problems"
              subtitle="Continue unresolved work and see where participation is building."
              actionHref="/open-problems"
              actionLabel="Browse all"
            >
              <OpenProblemsList
                problems={scopedOpenProblems.slice(0, 5)}
                joiningProblemId={joiningProblemId}
                onJoin={(problemId) => {
                  handleJoinOpenProblem(problemId).catch(() => null);
                }}
              />
            </OverviewCard>
          </div>
        </div>
      </div>
    </div>
  );
}
