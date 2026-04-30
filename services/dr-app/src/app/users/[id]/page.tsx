import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { pickDataspaceColor } from "@/lib/dataspaceColor";

type PageProps = {
  params: { id: string };
};

type ActivityEntry = {
  dayKey: string;
  count: number;
  meetingCount: number;
  templateCount: number;
  openProblemCount: number;
};

function dayKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function labelDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function monthLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short"
  });
}

function activityTone(count: number) {
  if (count <= 0) return "bg-slate-100 border-slate-200";
  if (count === 1) return "bg-emerald-100 border-emerald-200";
  if (count <= 3) return "bg-emerald-300 border-emerald-300";
  if (count <= 5) return "bg-emerald-500 border-emerald-500";
  return "bg-emerald-700 border-emerald-700";
}

function buildActivityGrid(entries: ActivityEntry[]) {
  const entryByDay = new Map(entries.map((entry) => [entry.dayKey, entry]));
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 364);

  const startWeek = new Date(start);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());

  const cells: Array<{
    date: Date;
    dayKey: string;
      count: number;
      meetingCount: number;
      templateCount: number;
      openProblemCount: number;
      inRange: boolean;
  }> = [];

  for (let cursor = new Date(startWeek); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const current = new Date(cursor);
    const key = dayKeyFromDate(current);
    const entry = entryByDay.get(key);
    cells.push({
      date: current,
      dayKey: key,
      count: entry?.count ?? 0,
      meetingCount: entry?.meetingCount ?? 0,
      templateCount: entry?.templateCount ?? 0,
      openProblemCount: entry?.openProblemCount ?? 0,
      inRange: current >= start && current <= end
    });
  }

  const weeks: typeof cells[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const monthMarkers = weeks.map((week, index) => {
    const firstInRange = week.find((cell) => cell.inRange);
    if (!firstInRange) return "";
    const month = monthLabel(firstInRange.date);
    if (index === 0) return month;
    const previous = weeks[index - 1]?.find((cell) => cell.inRange);
    return previous && monthLabel(previous.date) === month ? "" : month;
  });

  return { weeks, monthMarkers };
}

export default async function UserProfilePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      avatarUrl: true,
      personalDescription: true,
      telegramHandle: true,
      calComLink: true,
      websiteUrl: true,
      xUrl: true,
      blueskyUrl: true,
      linkedinUrl: true,
      fediverseUrl: true,
      createdAt: true,
      role: true,
      memberships: {
        select: {
          createdAt: true,
          meeting: {
            select: {
              id: true,
              dataspaceId: true,
              dataspace: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          }
        }
      },
      planParticipations: {
        select: {
          createdAt: true,
          plan: {
            select: {
              id: true,
              dataspaceId: true,
              dataspace: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          }
        }
      },
      openProblemsCreated: {
        select: {
          createdAt: true,
          dataspace: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        }
      },
      openProblemJoins: {
        select: {
          createdAt: true,
          problem: {
            select: {
              id: true,
              dataspace: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          }
        }
      },
      _count: {
        select: {
          meetingsCreated: true,
          plansCreated: true,
          dataspacesCreated: true,
          texts: true,
          memberships: true,
          dataspaceMemberships: true,
          planParticipations: true,
          openProblemsCreated: true,
          openProblemJoins: true
        }
      }
    }
  });

  if (!user || user.id === "" || user.email === "") {
    notFound();
  }

  const initials = user.email.slice(0, 2).toUpperCase();
  const activityMap = new Map<string, ActivityEntry>();

  for (const membership of user.memberships) {
    const key = dayKeyFromDate(membership.createdAt);
    const current = activityMap.get(key) ?? {
      dayKey: key,
      count: 0,
      meetingCount: 0,
      templateCount: 0,
      openProblemCount: 0
    };
    current.count += 1;
    current.meetingCount += 1;
    activityMap.set(key, current);
  }

  for (const participation of user.planParticipations) {
    const key = dayKeyFromDate(participation.createdAt);
    const current = activityMap.get(key) ?? {
      dayKey: key,
      count: 0,
      meetingCount: 0,
      templateCount: 0,
      openProblemCount: 0
    };
    current.count += 1;
    current.templateCount += 1;
    activityMap.set(key, current);
  }

  for (const problem of user.openProblemsCreated) {
    const key = dayKeyFromDate(problem.createdAt);
    const current = activityMap.get(key) ?? {
      dayKey: key,
      count: 0,
      meetingCount: 0,
      templateCount: 0,
      openProblemCount: 0
    };
    current.count += 1;
    current.openProblemCount += 1;
    activityMap.set(key, current);
  }

  for (const join of user.openProblemJoins) {
    const key = dayKeyFromDate(join.createdAt);
    const current = activityMap.get(key) ?? {
      dayKey: key,
      count: 0,
      meetingCount: 0,
      templateCount: 0,
      openProblemCount: 0
    };
    current.count += 1;
    current.openProblemCount += 1;
    activityMap.set(key, current);
  }

  const activityEntries = Array.from(activityMap.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const { weeks, monthMarkers } = buildActivityGrid(activityEntries);
  const activeDays = activityEntries.filter((entry) => entry.count > 0).length;
  const totalParticipation = activityEntries.reduce((sum, entry) => sum + entry.count, 0);

  const dataspaceMap = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      total: number;
      meetings: number;
      templates: number;
      openProblems: number;
    }
  >();

  for (const membership of user.memberships) {
    const dataspace = membership.meeting.dataspace;
    if (!dataspace) continue;
    const current = dataspaceMap.get(dataspace.id) ?? {
      id: dataspace.id,
      name: dataspace.name,
      color: pickDataspaceColor(dataspace.color),
      total: 0,
      meetings: 0,
      templates: 0,
      openProblems: 0
    };
    current.total += 1;
    current.meetings += 1;
    dataspaceMap.set(dataspace.id, current);
  }

  for (const participation of user.planParticipations) {
    const dataspace = participation.plan.dataspace;
    if (!dataspace) continue;
    const current = dataspaceMap.get(dataspace.id) ?? {
      id: dataspace.id,
      name: dataspace.name,
      color: pickDataspaceColor(dataspace.color),
      total: 0,
      meetings: 0,
      templates: 0,
      openProblems: 0
    };
    current.total += 1;
    current.templates += 1;
    dataspaceMap.set(dataspace.id, current);
  }

  for (const problem of user.openProblemsCreated) {
    const dataspace = problem.dataspace;
    if (!dataspace) continue;
    const current = dataspaceMap.get(dataspace.id) ?? {
      id: dataspace.id,
      name: dataspace.name,
      color: pickDataspaceColor(dataspace.color),
      total: 0,
      meetings: 0,
      templates: 0,
      openProblems: 0
    };
    current.total += 1;
    current.openProblems += 1;
    dataspaceMap.set(dataspace.id, current);
  }

  for (const join of user.openProblemJoins) {
    const dataspace = join.problem.dataspace;
    if (!dataspace) continue;
    const current = dataspaceMap.get(dataspace.id) ?? {
      id: dataspace.id,
      name: dataspace.name,
      color: pickDataspaceColor(dataspace.color),
      total: 0,
      meetings: 0,
      templates: 0,
      openProblems: 0
    };
    current.total += 1;
    current.openProblems += 1;
    dataspaceMap.set(dataspace.id, current);
  }

  const topDataspaces = Array.from(dataspaceMap.values()).sort((a, b) => b.total - a.total).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">User profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {user.email}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Member since {formatDateTime(user.createdAt, null)}
          </p>
        </div>
        <Link href="/dashboard" className="dr-button-outline px-4 py-2 text-sm">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.25fr]">
        <section className="dr-card p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/80 bg-white text-2xl font-semibold text-slate-600 shadow-[0_18px_34px_rgba(15,23,42,0.1)]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.email} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {user.role}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Democracy Routes
                </span>
              </div>
              <p className="mt-3 break-all text-sm font-semibold text-slate-900">{user.email}</p>
              {user.telegramHandle ? (
                <p className="mt-2 text-sm text-slate-600">Telegram: @{user.telegramHandle}</p>
              ) : null}
              {user.calComLink ? (
                <a
                  href={user.calComLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                >
                  Booking link
                </a>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {user.websiteUrl ? (
                  <a href={user.websiteUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    Website
                  </a>
                ) : null}
                {user.xUrl ? (
                  <a href={user.xUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    X
                  </a>
                ) : null}
                {user.blueskyUrl ? (
                  <a href={user.blueskyUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    Bluesky
                  </a>
                ) : null}
                {user.linkedinUrl ? (
                  <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    LinkedIn
                  </a>
                ) : null}
                {user.fediverseUrl ? (
                  <a href={user.fediverseUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    Fediverse
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Personal description
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {user.personalDescription?.trim() || "No personal description yet."}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meeting activity</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.memberships}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template activity</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.planParticipations}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active days</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{activeDays}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meetings created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.meetingsCreated}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Templates created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.plansCreated}</p>
            </div>
            <div className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dataspaces created</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{user._count.dataspacesCreated}</p>
            </div>
          </div>

          <div className="dr-card p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Participation activity</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Meetings and template runs from the last 365 days.
                </p>
              </div>
              <p className="text-sm text-slate-500">{totalParticipation} total participation events</p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="inline-flex min-w-max flex-col gap-2">
                <div className="grid gap-1" style={{ gridTemplateColumns: `32px repeat(${weeks.length}, 12px)` }}>
                  <div />
                  {monthMarkers.map((label, index) => (
                    <div key={`month-${index}`} className="text-[10px] text-slate-400">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid gap-1" style={{ gridTemplateColumns: `32px repeat(${weeks.length}, 12px)` }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, rowIndex) => (
                    <div key={`label-${day}-${rowIndex}`} className="contents">
                      <div className="flex h-3 items-center text-[10px] text-slate-400">{rowIndex % 2 === 1 ? day : ""}</div>
                      {weeks.map((week, weekIndex) => {
                        const cell = week[rowIndex] ?? {
                          date: new Date(0),
                          dayKey: `empty-${weekIndex}-${rowIndex}`,
                          count: 0,
                          meetingCount: 0,
                          templateCount: 0,
                          openProblemCount: 0,
                          inRange: false
                        };
                        const title = cell.inRange
                          ? `${labelDate(cell.date)} · ${cell.count} activities (${cell.meetingCount} meetings, ${cell.templateCount} templates, ${cell.openProblemCount} open problems)`
                          : "";
                        return (
                          <div
                            key={`${cell.dayKey}-${weekIndex}`}
                            title={title}
                            className={`h-3 w-3 rounded-[3px] border ${cell.inRange ? activityTone(cell.count) : "border-transparent bg-transparent"}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400">
                  <span>Less</span>
                  <span className="h-3 w-3 rounded-[3px] border border-slate-200 bg-slate-100" />
                  <span className="h-3 w-3 rounded-[3px] border border-emerald-200 bg-emerald-100" />
                  <span className="h-3 w-3 rounded-[3px] border border-emerald-300 bg-emerald-300" />
                  <span className="h-3 w-3 rounded-[3px] border border-emerald-500 bg-emerald-500" />
                  <span className="h-3 w-3 rounded-[3px] border border-emerald-700 bg-emerald-700" />
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dr-card p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Dataspace activity</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Where this user is most active across meetings, templates, and open problems.
                </p>
              </div>
            </div>

            {topDataspaces.length > 0 ? (
              <div className="mt-5 space-y-3">
                {topDataspaces.map((dataspace) => (
                  <Link
                    key={dataspace.id}
                    href={`/dataspace/${dataspace.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full border border-white/80 shadow-sm"
                        style={{ backgroundColor: dataspace.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{dataspace.name}</p>
                        <p className="text-xs text-slate-500">
                          {dataspace.meetings} meetings · {dataspace.templates} templates · {dataspace.openProblems} open problems
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">{dataspace.total}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">activity</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No dataspace-linked meeting or template participation yet.
              </p>
            )}
          </div>

          <div className="dr-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Profile visibility</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              This page is visible to signed-in Democracy Routes users. It is intended as a lightweight participant profile for meetings, templates, and dataspaces.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
