"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { UpcomingInvites } from "@/app/dashboard/UpcomingInvites";
import { CalendarPanel } from "@/app/dashboard/CalendarPanel";

type RecentItem = {
  id: string;
  title: string;
  type: "Meeting" | "Template" | "Text";
  date: string;
  href: string;
  join?: { isPublic: boolean; joinStatus: "PENDING" | "JOINED" | "NONE"; canJoin: boolean };
  dataspaceColor?: string | null;
  dataspaceKey: string;
};

type UpcomingItem = {
  id: string;
  title: string;
  type: "Meeting" | "Template";
  startsAt: string;
  href: string;
  join?: { isPublic: boolean; joinStatus: "PENDING" | "JOINED" | "NONE"; canJoin: boolean };
  dataspaceColor?: string | null;
  dataspaceKey: string;
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

type Props = {
  meetingRows: Parameters<typeof MeetingsTable>[0]["initialMeetings"];
  planRows: Parameters<typeof MeetingsTable>[0]["flows"];
  textRows: Parameters<typeof MeetingsTable>[0]["texts"];
  openProblemRows: OpenProblemRow[];
  dataspaceOptions: Parameters<typeof MeetingsTable>[0]["dataspaceOptions"];
  recentItems: RecentItem[];
  upcomingItems: UpcomingItem[];
  upcomingInvites: InviteRow[];
  calendarEvents: Parameters<typeof CalendarPanel>[0]["events"];
};

const TABS = ["Overview", "Meetings", "Notifications", "Calendar", "Open Problems"] as const;
type TabKey = (typeof TABS)[number];

function overviewTypeBadgeClass(type: RecentItem["type"] | UpcomingItem["type"]) {
  switch (type) {
    case "Meeting":
      return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
    case "Template":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    default:
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  }
}

function getDataspaceLabel(key: string, options: Props["dataspaceOptions"]) {
  return options.find((option) => option.key === key)?.label ?? "Unknown dataspace";
}

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
          description="Nothing is open in the selected dataspaces right now."
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
                  {problem.dataspaceColor ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white/80 shadow-sm"
                      style={{ backgroundColor: problem.dataspaceColor }}
                    />
                  ) : null}
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
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {problem.createdByMe ? "Created by you" : `By ${problem.createdByEmail}`}
              </span>
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

function DataspaceFilterRail({
  options,
  selectedDataspaces,
  onReset,
  onToggle
}: {
  options: Props["dataspaceOptions"];
  selectedDataspaces: string[];
  onReset: () => void;
  onToggle: (key: string) => void;
}) {
  return (
    <aside className="min-h-0 xl:col-span-3">
      <div className="dr-card h-full overflow-hidden border-none bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] text-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
            Navigation
          </p>
          <h2 className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            Dataspaces
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Focus the dashboard on specific communities, or keep the full network in view.
          </p>
        </div>
        <div className="space-y-3 px-4 py-4">
          <button
            type="button"
            onClick={onReset}
            className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${
              selectedDataspaces.length === 0
                ? "border-white/20 bg-white text-slate-950 shadow-[0_12px_32px_rgba(255,255,255,0.16)]"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">
              Full Network
            </span>
            <span className="mt-1 block text-base font-semibold">All dataspaces</span>
          </button>
          <div className="max-h-[calc(100dvh-430px)] space-y-2 overflow-auto pr-1">
            {options.map((option) => {
              const active = selectedDataspaces.includes(option.key);
              const initials = option.label.slice(0, 2).toUpperCase();
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onToggle(option.key)}
                  className={`flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                    active
                      ? "border-white/20 bg-white text-slate-950 shadow-[0_16px_36px_rgba(255,255,255,0.16)]"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                  title={option.label}
                >
                  <span
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10"
                    style={
                      option.color
                        ? {
                            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), ${option.color})`
                          }
                        : undefined
                    }
                  >
                    {option.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.imageUrl} alt={option.label} className="h-full w-full object-cover" />
                    ) : !option.color ? (
                      <span className={`text-sm font-semibold ${active ? "text-slate-950" : "text-white"}`}>
                        {initials}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{option.label}</span>
                    <span className={`block text-xs ${active ? "text-slate-500" : "text-slate-300"}`}>
                      {active ? "Included" : "Tap to filter"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SummaryMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "dark" | "light" | "accent";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-slate-950 text-white"
      : tone === "accent"
        ? "bg-amber-300 text-slate-950"
        : "bg-white/70 text-slate-950";

  return (
    <div className={`rounded-[28px] border border-slate-200/70 px-4 py-4 shadow-sm ${toneClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tone === "dark" ? "text-white/70" : "text-slate-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
        {value}
      </p>
    </div>
  );
}

function OverviewCard({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dr-card overflow-hidden border-none bg-white/72 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="dr-button-outline px-4 py-2 text-sm">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function ActivityList({
  items,
  emptyTitle,
  emptyDescription
}: {
  items: Array<RecentItem | UpcomingItem>;
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
          key={`${item.type}-${item.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.88))] px-4 py-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.dataspaceColor ? (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/80 shadow-sm"
                  style={{ backgroundColor: item.dataspaceColor }}
                />
              ) : null}
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${overviewTypeBadgeClass(item.type)}`}
              >
                {item.type}
              </span>
              <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">{item.title}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
              {"date" in item ? item.date : item.startsAt}
            </p>
          </div>
          <Link href={item.href} className="dr-button-outline px-3 py-1.5 text-xs">
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}

export function DashboardTabs({
  meetingRows,
  planRows,
  textRows,
  openProblemRows,
  dataspaceOptions,
  recentItems,
  upcomingItems,
  upcomingInvites,
  calendarEvents
}: Props) {
  const [tab, setTab] = useState<TabKey>(
    upcomingInvites.length > 0 ? "Notifications" : "Overview"
  );
  const [selectedDataspaces, setSelectedDataspaces] = useState<string[]>([]);
  const [openProblems, setOpenProblems] = useState<OpenProblemRow[]>(openProblemRows);
  const [joiningProblemId, setJoiningProblemId] = useState<string | null>(null);

  const activeDataspaceKeys = selectedDataspaces.length > 0 ? new Set(selectedDataspaces) : null;
  const includeByDataspace = (key: string) => !activeDataspaceKeys || activeDataspaceKeys.has(key);

  const scopedMeetings = meetingRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedPlans = planRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedTexts = textRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedOpenProblems = openProblems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedRecent = recentItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedUpcoming = upcomingItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedInvites = upcomingInvites.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedCalendar = calendarEvents.filter((row) => includeByDataspace(row.dataspaceKey));

  const activeDataspaceLabels = useMemo(() => {
    if (selectedDataspaces.length === 0) {
      return "All dataspaces";
    }
    return selectedDataspaces.map((key) => getDataspaceLabel(key, dataspaceOptions)).join(", ");
  }, [dataspaceOptions, selectedDataspaces]);

  const metrics = useMemo(
    () => [
      { label: "Meetings", value: `${scopedMeetings.length}`, tone: "dark" as const },
      { label: "Templates", value: `${scopedPlans.length}`, tone: "light" as const },
      { label: "Invites", value: `${scopedInvites.length}`, tone: "accent" as const },
      { label: "Open Problems", value: `${scopedOpenProblems.length}`, tone: "light" as const }
    ],
    [scopedInvites.length, scopedMeetings.length, scopedOpenProblems.length, scopedPlans.length]
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
      if (!response.ok) {
        return;
      }
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
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-12">
      <DataspaceFilterRail
        options={dataspaceOptions}
        selectedDataspaces={selectedDataspaces}
        onReset={() => setSelectedDataspaces([])}
        onToggle={toggleDataspace}
      />

      <div className="flex min-h-0 flex-col gap-5 xl:col-span-9">
        <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,248,237,0.96),rgba(255,255,255,0.84)_48%,rgba(219,234,254,0.78))] px-5 py-6 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:px-6">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.16),transparent_58%)] lg:block" />
          <div className="relative">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Dashboard
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Coordination view for meetings, templates, and active work.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Filter by dataspace, review the next actions, and move between live collaboration surfaces without leaving the page.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                {metrics.map((metric) => (
                  <SummaryMetric
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    tone={metric.tone}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white/80 px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">
                Focus: {activeDataspaceLabels}
              </span>
              <span className="rounded-full bg-white/60 px-3 py-1.5 ring-1 ring-slate-200/80">
                {scopedCalendar.length} calendar events in scope
              </span>
              {scopedInvites.length > 0 ? (
                <span className="rounded-full bg-rose-100 px-3 py-1.5 font-semibold text-rose-700 ring-1 ring-rose-200">
                  {scopedInvites.length} pending invitations
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <div className="dr-card overflow-hidden border-none bg-white/70 p-2 shadow-[0_22px_56px_rgba(15,23,42,0.09)]">
          <div className="flex min-w-max flex-wrap gap-2">
            {TABS.map((key) => {
              const isActive = tab === key;
              const showCount = key === "Notifications" && scopedInvites.length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)]"
                      : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                  }`}
                >
                  {key}
                  {showCount ? (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-white/15" : "bg-rose-100 text-rose-700"}`}>
                      {scopedInvites.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pb-1">
          {tab === "Overview" ? (
            <div className="space-y-5">
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <OverviewCard
                  eyebrow="Signal"
                  title="Recent activity"
                  description="Latest changes across meetings, templates, and texts in the current scope."
                >
                  <ActivityList
                    items={scopedRecent.slice(0, 6)}
                    emptyTitle="No Recent Activity"
                    emptyDescription="Once people start creating or updating content, it will appear here."
                  />
                </OverviewCard>

                <div className="space-y-3">
                  <div className="px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Action Queue
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950" style={{ fontFamily: "var(--font-serif)" }}>
                      Upcoming invitations
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                      Respond to invitations without leaving the dashboard.
                    </p>
                  </div>
                  <UpcomingInvites invites={scopedInvites} />
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <OverviewCard
                  eyebrow="Schedule"
                  title="Upcoming events"
                  description="The next meetings and templates approaching in the selected dataspaces."
                >
                  <ActivityList
                    items={scopedUpcoming.slice(0, 6)}
                    emptyTitle="No Upcoming Events"
                    emptyDescription="When future items are scheduled, they will be highlighted here."
                  />
                </OverviewCard>

                <OverviewCard
                  eyebrow="Work In Progress"
                  title="Open problems"
                  description="Problems requiring attention across the selected network."
                  actionHref="/open-problems"
                  actionLabel="Browse all"
                >
                  <OpenProblemsList
                    problems={scopedOpenProblems.slice(0, 4)}
                    joiningProblemId={joiningProblemId}
                    onJoin={(problemId) => {
                      handleJoinOpenProblem(problemId).catch(() => null);
                    }}
                  />
                </OverviewCard>
              </div>
            </div>
          ) : null}

          {tab === "Meetings" ? (
            <MeetingsTable
              initialMeetings={scopedMeetings}
              dataspaceOptions={dataspaceOptions}
              flows={scopedPlans}
              texts={scopedTexts}
              showCreatedBy={false}
              showFlagFilters={true}
              initialMode="MEETINGS"
              showModeTabs={false}
              hideDataspaceFilter={true}
            />
          ) : null}

          {tab === "Notifications" ? <UpcomingInvites invites={scopedInvites} /> : null}

          {tab === "Calendar" ? <CalendarPanel events={scopedCalendar} /> : null}

          {tab === "Open Problems" ? (
            <OverviewCard
              eyebrow="Problem Space"
              title="Open problems"
              description="Active problems visible in the selected dataspaces."
              actionHref="/open-problems"
              actionLabel="Browse all"
            >
              <OpenProblemsList
                problems={scopedOpenProblems}
                joiningProblemId={joiningProblemId}
                onJoin={(problemId) => {
                  handleJoinOpenProblem(problemId).catch(() => null);
                }}
              />
            </OverviewCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
