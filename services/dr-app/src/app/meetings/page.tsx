import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { getTranscriptionProviderLabel } from "@/lib/transcriptionProviders";

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      isHidden: false,
      OR: [
        { createdById: session.user.id },
        { members: { some: { userId: session.user.id } } },
        {
          isPublic: true,
          dataspace: { members: { some: { userId: session.user.id } } }
        }
      ]
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { email: true } },
      dataspace: { select: { id: true, name: true, color: true, personalOwnerId: true } },
      transcript: { select: { id: true } },
      aiSummary: { select: { status: true } },
      _count: { select: { aiAgentMessages: true } }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Meetings
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Browse active and completed meetings, reopen transcripts and summaries, and continue from the meeting pages.
          </p>
        </div>
        <Link href="/meetings/new" className="dr-button px-4 py-2 text-sm">
          New meeting
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-white/55 px-5 py-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">No Meetings</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Meetings you create, join, or can access through your dataspaces will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {meetings.map((meeting) => {
            const active = isMeetingActive(meeting);
            const dataspaceLabel =
              meeting.dataspace?.personalOwnerId === session.user.id
                ? "My Data Space"
                : meeting.dataspace?.name ?? "No dataspace";
            const startLabel = formatDateTime(meeting.scheduledStartAt ?? meeting.createdAt, meeting.timezone);
            const endLabel = formatDateTime(meeting.expiresAt, meeting.timezone);
            const hasTranscript = Boolean(meeting.transcript?.id);
            const hasSummary = meeting.aiSummary?.status === "DONE";

            return (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="rounded-[28px] border border-slate-200/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      active
                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                    }`}
                  >
                    {active ? "Active" : "Completed"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {meeting.language}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {getTranscriptionProviderLabel(meeting.transcriptionProvider)}
                  </span>
                  {meeting.dataspace?.color ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/80 shadow-sm"
                        style={{ backgroundColor: meeting.dataspace.color }}
                      />
                      {dataspaceLabel}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {dataspaceLabel}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-lg font-semibold text-slate-950">{meeting.title}</h2>
                {meeting.description ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{meeting.description}</p>
                ) : null}

                <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Starts</p>
                    <p className="mt-1 text-sm text-slate-700">{startLabel}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Expires</p>
                    <p className="mt-1 text-sm text-slate-700">{endLabel}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Host</p>
                    <p className="mt-1 text-sm text-slate-700">{meeting.createdBy.email}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Artifacts</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {hasTranscript ? "Transcript" : "No transcript"}
                      {" · "}
                      {hasSummary ? "Summary" : "No summary"}
                      {meeting._count.aiAgentMessages > 0 ? " · AI notes" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
