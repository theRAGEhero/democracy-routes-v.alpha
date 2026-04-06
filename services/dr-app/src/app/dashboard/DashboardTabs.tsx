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
    <aside className="order-2 lg:order-1 lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:w-24 lg:flex-shrink-0 lg:self-start">
      <div className="dr-card flex h-full min-h-0 flex-col p-2">
        <div className="mb-2 px-1">
          <p className="text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Dataspaces
          </p>
        </div>
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-0.5 lg:flex-col lg:items-center lg:overflow-y-auto lg:overflow-x-hidden">
          <button
            type="button"
            onClick={onReset}
            className={`group flex min-w-fit flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center transition ${
              selectedDataspaces.length === 0
                ? "bg-slate-900/6 text-slate-950 ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="All dataspaces"
          >
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.35)] transition ${
                selectedDataspaces.length === 0
                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_0_12px_rgba(15,23,42,0.28)]"
                  : "border-slate-200 bg-white text-slate-600 group-hover:border-slate-300"
              }`}
            >
              <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/40" />
              All
            </span>
            <span className="max-w-[60px] text-[8px] font-semibold leading-tight">All</span>
          </button>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onToggle(option.key)}
              className={`group flex min-w-fit flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center transition ${
                selectedDataspaces.includes(option.key)
                  ? "bg-white/90 text-slate-950 ring-1 ring-slate-200 shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title={option.label}
            >
              <span
                className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-white transition ${
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
                  <img
                    src={option.imageUrl}
                    alt={option.label}
                    className="h-full w-full object-cover"
                  />
                ) : option.color ? (
                  <span
                    className="h-full w-full"
                    style={{
                      background:
                        `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), ${option.color})`
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
              <span className="max-w-[60px] text-[8px] font-semibold leading-tight">
                {option.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900"
        >
          Reset
        </button>
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
    <div className={`rounded-[26px] border border-slate-200/70 px-4 py-4 shadow-sm ${toneClass}`}>
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
  title,
  actionHref,
  actionLabel,
  children
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dr-card overflow-hidden border-none bg-white/72 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-semibold text-slate-950" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h3>
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
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <DataspaceFilterRail
        options={dataspaceOptions}
        selectedDataspaces={selectedDataspaces}
        onReset={() => setSelectedDataspaces([])}
        onToggle={toggleDataspace}
      />

      <div className="order-1 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:order-2 lg:min-w-0">
        <section className="dr-card border-none bg-[linear-gradient(135deg,rgba(255,248,237,0.96),rgba(255,255,255,0.84)_48%,rgba(219,234,254,0.78))] px-4 py-4 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Dashboard
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">
                {activeDataspaceLabels}
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
        </section>

        <div className="dr-card flex-shrink-0 overflow-x-auto border-none bg-white/70 p-2 shadow-[0_22px_56px_rgba(15,23,42,0.09)]">
          <div className="flex min-w-max items-center gap-2">
            {TABS.map((key) => {
              const isActive = tab === key;
              const showCount = key === "Notifications" && scopedInvites.length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : showCount
                        ? "border border-rose-200 bg-rose-50 text-rose-700 hover:text-rose-900"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{key}</span>
                  {showCount ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
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
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <OverviewCard title="Recent activity">
                  <ActivityList
                    items={scopedRecent.slice(0, 6)}
                    emptyTitle="No Recent Activity"
                    emptyDescription="Recent meetings, templates, and texts will appear here."
                  />
                </OverviewCard>

                <OverviewCard title="Upcoming invitations">
                  <UpcomingInvites invites={scopedInvites} />
                </OverviewCard>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <OverviewCard title="Upcoming events">
                  <ActivityList
                    items={scopedUpcoming.slice(0, 6)}
                    emptyTitle="No Upcoming Events"
                    emptyDescription="Scheduled meetings and templates will appear here."
                  />
                </OverviewCard>

                <OverviewCard
                  title="Open problems"
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
              title="Open problems"
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
