import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { getTranscriptionProviderLabel } from "@/lib/transcriptionProviders";
import { BoxFeedClient } from "./BoxFeedClient";

type ReelProblem = {
  id: string;
  title: string;
  description: string;
  status: string;
  dataspaceName: string | null;
  dataspaceColor: string | null;
  creatorEmail: string;
};

type ReelItemWithSort = {
  id: string;
  type: "summary" | "placeholder";
  problemId: string;
  problem: ReelProblem;
  headline: string;
  subheadline: string | null;
  body: string;
  meetingId: string | null;
  language: string | null;
  transcriptionProviderLabel: string | null;
  scheduledLabel: string | null;
  updatedLabel: string | null;
  statusLabel: string;
  statusTone: "live" | "ready" | "waiting";
  sortAt: Date;
};

function stripMarkdown(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryExcerpt(markdown: string | null | undefined, limit = 520) {
  const clean = stripMarkdown(markdown);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trim()}...`;
}

export default async function BoxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const problems = await prisma.openProblem.findMany({
    where: {
      OR: [{ createdById: session.user.id }, { joins: { some: { userId: session.user.id } } }]
    },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { email: true } },
      dataspace: { select: { name: true, color: true } },
      meetings: {
        where: {
          isHidden: false,
          aiSummary: { is: { status: "DONE" } }
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          scheduledStartAt: true,
          timezone: true,
          language: true,
          transcriptionProvider: true,
          isActive: true,
          expiresAt: true,
          aiSummary: {
            select: {
              summaryMarkdown: true,
              updatedAt: true,
              generatedTitle: true,
              generatedDescription: true
            }
          }
        }
      }
    }
  });

  const items: ReelItemWithSort[] = problems.flatMap<ReelItemWithSort>((problem) => {
    const baseProblem = {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      status: problem.status,
      dataspaceName: problem.dataspace?.name ?? null,
      dataspaceColor: problem.dataspace?.color ?? null,
      creatorEmail: problem.createdBy.email
    };

    if (problem.meetings.length === 0) {
      return [
        {
          id: `problem-${problem.id}`,
          type: "placeholder" as const,
          problemId: problem.id,
          problem: baseProblem,
          headline: problem.title,
          subheadline: "No finished meeting summary yet",
          body:
            "This problem is in your feed, but there is no completed meeting summary attached to it yet. Join or launch a meeting from the open problem page to start building a discussion trail.",
          meetingId: null,
          language: null,
          transcriptionProviderLabel: null,
          scheduledLabel: null,
          updatedLabel: `Updated ${formatDateTime(problem.updatedAt)}`,
          statusLabel: "Waiting for summary",
          statusTone: "waiting" as const,
          sortAt: problem.updatedAt
        }
      ];
    }

    return problem.meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: "summary" as const,
      problemId: problem.id,
      problem: baseProblem,
      headline: meeting.aiSummary?.generatedTitle || meeting.title,
      subheadline: meeting.aiSummary?.generatedDescription || null,
      body: summaryExcerpt(meeting.aiSummary?.summaryMarkdown || meeting.description),
      meetingId: meeting.id,
      language: meeting.language,
      transcriptionProviderLabel: getTranscriptionProviderLabel(meeting.transcriptionProvider),
      scheduledLabel: formatDateTime(meeting.scheduledStartAt ?? meeting.createdAt, meeting.timezone),
      updatedLabel: `Updated ${formatDateTime(meeting.aiSummary?.updatedAt ?? meeting.updatedAt, meeting.timezone)}`,
      statusLabel: isMeetingActive(meeting) ? "Live now" : "Summary ready",
      statusTone: isMeetingActive(meeting) ? ("live" as const) : ("ready" as const),
      sortAt: meeting.aiSummary?.updatedAt ?? meeting.updatedAt
    }));
  });

  items.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  return <BoxFeedClient items={items.map(({ sortAt, ...item }) => item)} />;
}
