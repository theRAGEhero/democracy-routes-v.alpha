"use client";

import { useState } from "react";
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
};

type Props = {
  meetingRows: Parameters<typeof MeetingsTable>[0]["initialMeetings"];
  planRows: Parameters<typeof MeetingsTable>[0]["flows"];
  textRows: Parameters<typeof MeetingsTable>[0]["texts"];
  dataspaceOptions: Parameters<typeof MeetingsTable>[0]["dataspaceOptions"];
  recentItems: RecentItem[];
  upcomingItems: UpcomingItem[];
  upcomingInvites: InviteRow[];
  calendarEvents: Parameters<typeof CalendarPanel>[0]["events"];
};

const TABS = ["Overview", "Meetings", "Templates", "Invites", "Calendar"] as const;
type TabKey = (typeof TABS)[number];

export function DashboardTabs({
  meetingRows,
  planRows,
  textRows,
  dataspaceOptions,
  recentItems,
  upcomingItems,
  upcomingInvites,
  calendarEvents
}: Props) {
  const [tab, setTab] = useState<TabKey>(
    upcomingInvites.length > 0 ? "Invites" : "Overview"
  );
  const [selectedDataspaces, setSelectedDataspaces] = useState<string[]>([]);

  const activeDataspaceKeys = selectedDataspaces.length > 0 ? new Set(selectedDataspaces) : null;
  const includeByDataspace = (key: string) =>
    !activeDataspaceKeys || activeDataspaceKeys.has(key);

  const scopedMeetings = meetingRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedPlans = planRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedTexts = textRows.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedRecent = recentItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedUpcoming = upcomingItems.filter((row) => includeByDataspace(row.dataspaceKey));
  const scopedCalendar = calendarEvents.filter((row) => includeByDataspace(row.dataspaceKey));

  function toggleDataspace(key: string) {
    setSelectedDataspaces((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <aside className="order-2 lg:order-1 lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:w-20 lg:flex-shrink-0 lg:self-start">
        <div className="dr-card flex h-full min-h-0 flex-col p-1.5">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 px-1">
              <p className="text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Dataspaces
              </p>
            </div>
            <div className="flex flex-1 gap-1.5 overflow-x-auto px-0.5 lg:flex-col lg:items-center lg:overflow-y-auto lg:overflow-x-hidden">
              <button
                type="button"
                onClick={() => setSelectedDataspaces([])}
                className={`group flex min-w-fit flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center transition ${
                  selectedDataspaces.length === 0
                    ? "bg-slate-900/6 text-slate-950 ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="All dataspaces"
              >
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.35)] transition ${
                    selectedDataspaces.length === 0
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_0_12px_rgba(15,23,42,0.28)]"
                      : "border-slate-200 bg-white text-slate-600 group-hover:border-slate-300"
                  }`}
                >
                  <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/40" />
                  All
                </span>
                <span className="max-w-[52px] text-[8px] font-semibold leading-tight">
                  All
                </span>
              </button>
              {dataspaceOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleDataspace(option.key)}
                  className={`group flex min-w-fit flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center transition ${
                    selectedDataspaces.includes(option.key)
                      ? "bg-white/90 text-slate-950 ring-1 ring-slate-200 shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title={option.label}
                >
                  <span
                    className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-white transition ${
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
                  <span className="max-w-[52px] text-[8px] font-semibold leading-tight">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDataspaces([])}
              className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900"
            >
              Reset
            </button>
          </div>
        </div>
      </aside>

      <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2 lg:min-w-0">
        <div className="dr-card mb-4 overflow-x-auto px-2 py-2">
          <div className="flex min-w-max items-center gap-2">
            {TABS.map((key) => {
              const isInvites = key === "Invites";
              const hasInvites = upcomingInvites.length > 0;
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : hasInvites && isInvites
                        ? "border border-rose-200 bg-rose-50 text-rose-700 hover:text-rose-900"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{key}</span>
                  {hasInvites && isInvites ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {upcomingInvites.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        {tab === "Overview" ? (
          <div className="h-full overflow-auto">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="dr-card p-6">
                <h2 className="text-sm font-semibold uppercase text-slate-500">Recent activity</h2>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {scopedRecent.length === 0 ? (
                    <p className="text-slate-500">No recent activity yet.</p>
                  ) : (
                    scopedRecent.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            {item.dataspaceColor ? (
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-white/70 shadow-sm"
                                style={{ backgroundColor: item.dataspaceColor }}
                              />
                            ) : null}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                              {item.type}
                            </span>
                            <p className="font-medium text-slate-900">{item.title}</p>
                          </div>
                          <p className="text-xs text-slate-500">{item.date}</p>
                        </div>
                        <Link href={item.href} className="text-xs font-semibold text-slate-700 hover:underline">
                          Open
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-6">
                <div className="dr-card p-6">
                  <h2 className="text-sm font-semibold uppercase text-slate-500">Upcoming events</h2>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    {scopedUpcoming.length === 0 ? (
                      <p className="text-slate-500">No upcoming events scheduled.</p>
                    ) : (
                      scopedUpcoming.map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
                        >
                        <div>
                            <div className="flex items-center gap-2">
                              {item.dataspaceColor ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-white/70 shadow-sm"
                                  style={{ backgroundColor: item.dataspaceColor }}
                                />
                              ) : null}
                              <p className="font-medium text-slate-900">{item.title}</p>
                            </div>
                            <p className="text-xs text-slate-500">{item.startsAt}</p>
                        </div>
                          <Link href={item.href} className="text-xs font-semibold text-slate-700 hover:underline">
                            Open
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <UpcomingInvites invites={upcomingInvites} />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Meetings" ? (
          <div className="h-full overflow-auto">
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
          </div>
        ) : null}

        {tab === "Templates" ? (
          <div className="h-full overflow-auto">
            <MeetingsTable
              initialMeetings={scopedMeetings}
              dataspaceOptions={dataspaceOptions}
              flows={scopedPlans}
              texts={scopedTexts}
              showCreatedBy={false}
              showFlagFilters={true}
              initialMode="PLANS"
              showModeTabs={false}
              hideDataspaceFilter={true}
            />
          </div>
        ) : null}

        {tab === "Invites" ? (
          <div className="h-full overflow-auto">
            <UpcomingInvites invites={upcomingInvites} />
          </div>
        ) : null}
        {tab === "Calendar" ? (
          <div className="h-full overflow-auto">
            <CalendarPanel events={scopedCalendar} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
