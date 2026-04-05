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

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dr-card border-none bg-white/78 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="dr-button-outline px-3 py-1.5 text-sm">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  note,
  tone = "neutral"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "priority";
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 ${
        tone === "priority"
          ? "border-rose-200 bg-rose-50"
          : "border-slate-200 bg-white/85"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950" style={{ fontFamily: "var(--font-serif)" }}>
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function DataspacePicker({
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
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={onReset}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
          selectedDataspaces.length === 0
            ? "bg-slate-950 text-white"
            : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
        }`}
      >
        All dataspaces
      </button>
      {options.map((option) => {
        const active = selectedDataspaces.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-950 text-white"
                : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: option.color ?? "#94a3b8" }}
            />
            <span className="max-w-[180px] truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EventList({
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
          className="rounded-[22px] border border-slate-200 bg-white/90 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {item.dataspaceColor ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.dataspaceColor }}
                  />
                ) : null}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {item.type}
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {"date" in item ? item.date : item.startsAt}
              </p>
            </div>
            <Link href={item.href} className="dr-button-outline shrink-0 px-3 py-1.5 text-xs">
              Open
            </Link>
          </div>
        </div>
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
  if (problems.length === 0) {
    return (
      <EmptyState
        title="No Active Problems"
        description="Nothing in the selected dataspaces currently needs attention."
      />
    );
  }

  return (
    <div className="space-y-3">
      {problems.map((problem) => (
        <div key={problem.id} className="rounded-[22px] border border-slate-200 bg-white/90 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {problem.dataspaceColor ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: problem.dataspaceColor }}
                  />
                ) : null}
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200">
                  Open problem
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-950">{problem.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{problem.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{problem.dataspaceLabel}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{problem.joinCount} joined</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              {problem.updatedLabel ?? "Recently updated"}
            </span>
          </div>
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

  const nextUpcoming = scopedUpcoming.slice(0, 4);
  const latestActivity = scopedRecent.slice(0, 5);
  const highlightedProblems = scopedOpenProblems.slice(0, 3);

  const activeFocusLabel = useMemo(() => {
    if (selectedDataspaces.length === 0) {
      return "All dataspaces";
    }
    if (selectedDataspaces.length === 1) {
      return dataspaceOptions.find((option) => option.key === selectedDataspaces[0])?.label ?? "Selected dataspace";
    }
    return `${selectedDataspaces.length} dataspaces selected`;
  }, [dataspaceOptions, selectedDataspaces]);

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="dr-card border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.86))] px-4 py-4 shadow-[0_20px_54px_rgba(15,23,42,0.08)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Workspace Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
              Start with what needs action, then move into detail.
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Invitations and upcoming sessions are prioritized first. Historical activity and open problems stay visible, but secondary.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Current focus</p>
            <p className="mt-1 text-lg font-semibold">{activeFocusLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            label="Pending Invites"
            value={`${scopedInvites.length}`}
            note={scopedInvites.length > 0 ? "Needs response" : "No blocked invites"}
            tone={scopedInvites.length > 0 ? "priority" : "neutral"}
          />
          <SummaryTile
            label="Upcoming"
            value={`${nextUpcoming.length}`}
            note="Next meetings and templates"
          />
          <SummaryTile
            label="Open Problems"
            value={`${scopedOpenProblems.length}`}
            note="Issues needing collaboration"
          />
          <SummaryTile
            label="Library"
            value={`${scopedTexts.length}`}
            note="Texts in current scope"
          />
        </div>

        <div className="mt-4 border-t border-slate-200/80 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Filter By Dataspace
          </p>
          <DataspacePicker
            options={dataspaceOptions}
            selectedDataspaces={selectedDataspaces}
            onReset={() => setSelectedDataspaces([])}
            onToggle={toggleDataspace}
          />
        </div>
      </section>

      <div className="dr-card border-none bg-white/72 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((key) => {
            const isActive = tab === key;
            const badge = key === "Notifications" ? scopedInvites.length : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                }`}
              >
                {key}
                {badge ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${isActive ? "bg-white/15" : "bg-rose-100 text-rose-700"}`}>
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-1">
        {tab === "Overview" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <div className="space-y-4">
              <SectionCard
                eyebrow="Priority"
                title="Next actions"
                description="The most important items to respond to or join soon."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Invitations
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Respond first so collaboration does not stall.
                      </p>
                    </div>
                    <UpcomingInvites
                      invites={scopedInvites}
                      title="Pending invitations"
                      description="Accept or decline directly from here."
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Coming up
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        The nearest scheduled meetings and templates in the active scope.
                      </p>
                    </div>
                    <EventList
                      items={nextUpcoming}
                      emptyTitle="Nothing Scheduled"
                      emptyDescription="Upcoming meetings and templates will appear here."
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="Context"
                title="Recent activity"
                description="Use this to regain context after time away from the workspace."
              >
                <EventList
                  items={latestActivity}
                  emptyTitle="No Recent Activity"
                  emptyDescription="Newly updated meetings, templates, and texts will show up here."
                />
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard
                eyebrow="Secondary"
                title="Open problems"
                description="Visible issues that may need follow-up."
                actionHref="/open-problems"
                actionLabel="Browse all"
              >
                <OpenProblemsList
                  problems={highlightedProblems}
                  joiningProblemId={joiningProblemId}
                  onJoin={(problemId) => {
                    handleJoinOpenProblem(problemId).catch(() => null);
                  }}
                />
              </SectionCard>

              <SectionCard
                eyebrow="Drill Down"
                title="Calendar and records"
                description="Use the tabs above for the full meetings table, notification queue, and calendar view."
              >
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-[22px] border border-slate-200 bg-white/90 px-4 py-4">
                    <p className="font-semibold text-slate-950">{scopedMeetings.length} meetings</p>
                    <p className="mt-1">Open the Meetings tab for full search, filters, and management.</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white/90 px-4 py-4">
                    <p className="font-semibold text-slate-950">{scopedCalendar.length} calendar events</p>
                    <p className="mt-1">Switch to Calendar when you need time-based scanning instead of task-based scanning.</p>
                  </div>
                </div>
              </SectionCard>
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

        {tab === "Notifications" ? (
          <UpcomingInvites
            invites={scopedInvites}
            title="Invitation queue"
            description="Respond quickly to keep participation moving."
          />
        ) : null}

        {tab === "Calendar" ? <CalendarPanel events={scopedCalendar} /> : null}

        {tab === "Open Problems" ? (
          <SectionCard
            eyebrow="Problem Space"
            title="Open problems"
            description="Active issues visible in the currently selected dataspaces."
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
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
