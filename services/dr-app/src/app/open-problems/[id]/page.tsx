import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { getTranscriptionProviderLabel } from "@/lib/transcriptionProviders";
import { UserProfileLink } from "@/components/UserProfileLink";
import { OpenProblemAnalysisPanel } from "@/app/open-problems/[id]/OpenProblemAnalysisPanel";

function extractTranscriptLength(transcriptText: string | null, transcriptJson: string | null) {
  if (transcriptText?.trim()) return transcriptText.trim().length;
  if (!transcriptJson) return 0;
  try {
    const parsed = JSON.parse(transcriptJson);
    const contributions = Array.isArray(parsed?.contributions)
      ? parsed.contributions
      : Array.isArray(parsed?.deliberation?.contributions)
        ? parsed.deliberation.contributions
        : [];
    return contributions
      .map((entry: any) => String(entry?.text || ""))
      .join(" ")
      .trim().length;
  } catch {
    return 0;
  }
}

export default async function OpenProblemDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const openProblem = await prisma.openProblem.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, email: true } },
      joins: { include: { user: { select: { id: true, email: true } } } },
      dataspace: { select: { id: true, name: true, color: true } },
      meetings: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          language: true,
          transcriptionProvider: true,
          scheduledStartAt: true,
          timezone: true,
          createdAt: true,
          isActive: true,
          expiresAt: true,
          createdBy: { select: { email: true } },
          members: { select: { user: { select: { email: true } } } },
          transcript: { select: { transcriptText: true, transcriptJson: true, updatedAt: true } },
          aiSummary: { select: { status: true, updatedAt: true } }
        }
      },
      plans: {
        orderBy: { startAt: "desc" },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true }
          },
          participants: { select: { status: true } },
          participantSessions: { select: { id: true } }
        }
      }
    }
  });

  if (!openProblem) {
    return <p className="text-sm text-slate-600">Open problem not found.</p>;
  }

  const canAccess =
    session.user.role === "ADMIN" ||
    openProblem.createdById === session.user.id ||
    openProblem.joins.some((join) => join.userId === session.user.id) ||
    (!openProblem.dataspaceId
      ? true
      : Boolean(
          await prisma.dataspaceMember.findUnique({
            where: {
              dataspaceId_userId: {
                dataspaceId: openProblem.dataspaceId,
                userId: session.user.id
              }
            },
            select: { id: true }
          })
        ));

  if (!canAccess) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  const theme = {
    ["--dataspace-accent" as any]: openProblem.dataspace?.color ?? "var(--accent)"
  } as CSSProperties;

  return (
    <div style={theme} className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="h-11 w-11 rounded-full border border-white/70 shadow-sm"
              style={{
                background:
                  `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.92), ${openProblem.dataspace?.color ?? "#f59e0b"})`
              }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Open problem</p>
              <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                {openProblem.title}
              </h1>
            </div>
          </div>
          <p className="max-w-4xl text-sm leading-7 text-slate-600">{openProblem.description}</p>
          <p className="text-xs text-slate-500">
            Created by{" "}
            <UserProfileLink
              userId={openProblem.createdBy.id}
              email={openProblem.createdBy.email}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
            />{" "}
            · {formatDateTime(openProblem.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">{openProblem.status}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {openProblem.dataspace?.name ?? "No dataspace"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {openProblem.joins.length} joined
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {openProblem.meetings.length} meetings
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {openProblem.plans.length} flows
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/open-problems"
            className="dr-button-outline px-4 py-2 text-sm"
          >
            All open problems
          </Link>
          <Link
            href={`/meetings/new?openProblemId=${openProblem.id}${openProblem.dataspaceId ? `&dataspaceId=${openProblem.dataspaceId}` : ""}`}
            className="dr-button px-4 py-2 text-sm"
          >
            New meeting
          </Link>
          <Link
            href={`/flows/new?openProblemId=${openProblem.id}${openProblem.dataspaceId ? `&dataspaceId=${openProblem.dataspaceId}` : ""}`}
            className="dr-button-outline px-4 py-2 text-sm"
          >
            New flow
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-6">
          <section className="dr-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Meetings</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Associated meetings
                </h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {openProblem.meetings.length === 0 ? (
                <p className="text-sm text-slate-500">No meetings are linked to this open problem yet.</p>
              ) : (
                openProblem.meetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${isMeetingActive(meeting) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                            {isMeetingActive(meeting) ? "Active" : "Inactive"}
                          </span>
                          <p className="truncate text-base font-semibold text-slate-950">{meeting.title}</p>
                        </div>
                        {meeting.description ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{meeting.description}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {getTranscriptionProviderLabel(meeting.transcriptionProvider)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{meeting.language}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {formatDateTime(meeting.scheduledStartAt ?? meeting.createdAt, meeting.timezone)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Transcript {extractTranscriptLength(meeting.transcript?.transcriptText ?? null, meeting.transcript?.transcriptJson ?? null) > 0 ? "available" : "empty"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Summary {meeting.aiSummary?.status ?? "none"}
                          </span>
                        </div>
                      </div>
                      <Link href={`/meetings/${meeting.id}`} className="dr-button-outline px-3 py-1.5 text-xs">
                        Open
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="dr-card p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flows</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Associated flows
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {openProblem.plans.length === 0 ? (
                <p className="text-sm text-slate-500">No flows are linked to this open problem yet.</p>
              ) : (
                openProblem.plans.map((plan) => (
                  <div key={plan.id} className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-slate-950">{plan.title}</p>
                        {plan.description ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {formatDateTime(plan.startAt, plan.timezone)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {plan.roundsCount} rounds
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            room size {plan.maxParticipantsPerRoom}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {getTranscriptionProviderLabel(plan.transcriptionProvider)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{plan.language}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            participants {plan.participantSessions.length || plan.participants.length}
                          </span>
                          {plan.analyses[0] ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                              analysis {formatDateTime(plan.analyses[0].createdAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Link href={`/flows/${plan.id}`} className="dr-button-outline px-3 py-1.5 text-xs">
                        Open
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <OpenProblemAnalysisPanel openProblemId={openProblem.id} />
      </div>
    </div>
  );
}
