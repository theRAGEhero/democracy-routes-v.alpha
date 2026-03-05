"use client";

import { useMemo } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  type: "Meeting" | "Template" | "Text";
  startsAt: string;
  href: string;
};

type Props = {
  events: CalendarEvent[];
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function CalendarPanel({ events }: Props) {
  const now = useMemo(() => new Date(), []);
  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);
  }, [now]);
  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(now);
  }, [now]);

  const normalizedEvents = useMemo(() => {
    return events
      .map((event) => {
        const date = new Date(event.startsAt);
        return {
          ...event,
          dateKey: formatDateKey(date),
          timeLabel: formatTime(date)
        };
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof normalizedEvents>();
    normalizedEvents.forEach((event) => {
      if (!map.has(event.dateKey)) {
        map.set(event.dateKey, []);
      }
      map.get(event.dateKey)?.push(event);
    });
    return map;
  }, [normalizedEvents]);

  const days = useMemo(() => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startWeekday = startOfMonth.getDay();
    const totalDays = endOfMonth.getDate();
    const cells: Array<{ date: Date; isOutside: boolean }> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      const date = new Date(startOfMonth);
      date.setDate(date.getDate() - (startWeekday - i));
      cells.push({ date, isOutside: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push({ date: new Date(now.getFullYear(), now.getMonth(), day), isOutside: false });
    }

    const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let i = 0; i < remaining; i += 1) {
      const date = new Date(endOfMonth);
      date.setDate(endOfMonth.getDate() + i + 1);
      cells.push({ date, isOutside: true });
    }

    return cells;
  }, [now]);

  return (
    <section className="dr-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Community calendar
          </p>
          <h2 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {monthLabel}
          </h2>
          <p className="text-xs text-slate-500">Today: {todayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            Today
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500/70" />
            Meeting
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            Template
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500/70" />
            Text
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-[11px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day} className="text-center">{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map(({ date, isOutside }) => {
              const key = formatDateKey(date);
              const dayEvents = eventsByDate.get(key) ?? [];
              const isToday = key === formatDateKey(now);
              return (
                <div
                  key={key}
                  className={`min-h-[96px] rounded-2xl border border-slate-200/70 bg-white/70 p-2 text-sm shadow-sm transition sm:min-h-[110px] sm:p-3 ${isOutside ? "opacity-40" : ""} ${isToday ? "ring-2 ring-amber-300/70" : ""}`}
                >
                  <div className="text-sm font-semibold text-slate-700">{date.getDate()}</div>
                  <div className="mt-1.5 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <a
                        key={event.id}
                        href={event.href}
                        className={`block rounded-full px-2 py-1 text-[10px] font-semibold sm:text-[11px] ${
                          event.type === "Meeting"
                            ? "bg-sky-100 text-sky-700"
                            : event.type === "Template"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {event.title}
                      </a>
                    ))}
                    {dayEvents.length > 2 ? (
                      <p className="text-[10px] text-slate-400">+{dayEvents.length - 2} more</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm sm:p-5">
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Agenda feed
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Upcoming and recent activity.
          </p>
          <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1 text-sm">
            {normalizedEvents.length === 0 ? (
              <p className="text-slate-500">No events yet.</p>
            ) : (
              normalizedEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        event.type === "Meeting"
                          ? "bg-sky-100 text-sky-700"
                          : event.type === "Template"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      {event.type}
                    </span>
                    <a
                      href={event.href}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {event.title}
                    </a>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {event.dateKey} • {event.timeLabel}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
