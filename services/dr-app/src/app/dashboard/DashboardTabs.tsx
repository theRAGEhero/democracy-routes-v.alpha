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
};

type UpcomingItem = {
  id: string;
  title: string;
  type: "Meeting" | "Template";
  startsAt: string;
  href: string;
  join?: { isPublic: boolean; joinStatus: "PENDING" | "JOINED" | "NONE"; canJoin: boolean };
  dataspaceColor?: string | null;
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

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">Everything you run or participate in, in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((key) => {
          const isInvites = key === "Invites";
          const hasInvites = upcomingInvites.length > 0;
          const isActive = tab === key;
          const baseClass =
            "rounded-full px-4 py-1 text-sm font-semibold transition";
          const activeClass = "bg-slate-900 text-white";
          const idleClass = hasInvites && isInvites
            ? "border border-rose-200 bg-rose-50 text-rose-700 hover:text-rose-900"
            : "border border-slate-200 bg-white/70 text-slate-600 hover:text-slate-900";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`${baseClass} ${isActive ? activeClass : idleClass}`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "Overview" ? (
          <div className="h-full overflow-auto">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="dr-card p-6">
                <h2 className="text-sm font-semibold uppercase text-slate-500">Recent activity</h2>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {recentItems.length === 0 ? (
                    <p className="text-slate-500">No recent activity yet.</p>
                  ) : (
                    recentItems.map((item) => (
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
                    {upcomingItems.length === 0 ? (
                      <p className="text-slate-500">No upcoming events scheduled.</p>
                    ) : (
                      upcomingItems.map((item) => (
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
              initialMeetings={meetingRows}
              dataspaceOptions={dataspaceOptions}
              flows={planRows}
              texts={textRows}
              showCreatedBy={false}
              showFlagFilters={true}
              initialMode="MEETINGS"
              showModeTabs={false}
            />
          </div>
        ) : null}

        {tab === "Templates" ? (
          <div className="h-full overflow-auto">
            <MeetingsTable
              initialMeetings={meetingRows}
              dataspaceOptions={dataspaceOptions}
              flows={planRows}
              texts={textRows}
              showCreatedBy={false}
              showFlagFilters={true}
              initialMode="PLANS"
              showModeTabs={false}
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
            <CalendarPanel events={calendarEvents} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
