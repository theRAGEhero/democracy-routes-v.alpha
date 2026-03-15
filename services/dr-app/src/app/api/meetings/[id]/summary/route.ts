import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ensureMeetingAiSummary } from "@/lib/meetingAiSummary";

function computeTranscriptHash(transcriptText: string, transcriptJson: string | null) {
  return crypto
    .createHash("sha256")
    .update(transcriptText || "")
    .update("\n---\n")
    .update(transcriptJson || "")
    .digest("hex");
}

type SummaryStatus =
  | {
      stage: "ready";
      label: string;
      detail: string;
      error?: null;
    }
  | {
      stage: "waiting_for_transcript" | "queued" | "running" | "failed" | "idle";
      label: string;
      detail: string;
      error?: string | null;
    };

function buildSummaryStatus(args: {
  hasTranscript: boolean;
  summary: {
    status: string;
    error: string | null;
  } | null;
  hasReadySummary: boolean;
}): SummaryStatus {
  if (args.hasReadySummary) {
    return {
      stage: "ready",
      label: "Summary ready",
      detail: "The cached AI summary is available.",
      error: null
    };
  }

  if (!args.hasTranscript) {
    return {
      stage: "waiting_for_transcript",
      label: "Waiting for transcript",
      detail: "The summary starts only after a post-call transcript is available.",
      error: null
    };
  }

  if (!args.summary) {
    return {
      stage: "queued",
      label: "Summary queued",
      detail: "The transcript is ready. AI summary generation will start shortly.",
      error: null
    };
  }

  if (args.summary.status === "RUNNING") {
    return {
      stage: "running",
      label: "Summary in progress",
      detail: "The AI is summarizing the transcript.",
      error: null
    };
  }

  if (args.summary.status === "FAILED") {
    return {
      stage: "failed",
      label: "Summary failed",
      detail: "The AI could not finish the summary.",
      error: args.summary.error || null
    };
  }

  return {
    stage: "idle",
    label: "Waiting to start",
    detail: "The summary has not started yet.",
    error: null
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const auto = url.searchParams.get("auto") === "1";

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      transcript: true,
      aiSummary: true,
      members: {
        where: { userId: session.user.id }
      },
      dataspace: {
        include: {
          members: {
            where: { userId: session.user.id }
          }
        }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" ||
    meeting.createdById === session.user.id ||
    meeting.members.length > 0 ||
    Boolean(meeting.isPublic && meeting.dataspace?.members.length);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transcriptText = String(meeting.transcript?.transcriptText || "").trim();
  const transcriptHash = transcriptText
    ? computeTranscriptHash(transcriptText, meeting.transcript?.transcriptJson ?? null)
    : null;
  const hasReadySummary =
    Boolean(meeting.aiSummary?.summaryMarkdown) &&
    meeting.aiSummary?.status === "DONE" &&
    Boolean(transcriptHash) &&
    meeting.aiSummary?.sourceTranscriptHash === transcriptHash;

  if (
    auto &&
    transcriptText &&
    meeting.transcriptionProvider !== "DEEPGRAMLIVE" &&
    (!meeting.aiSummary || !meeting.aiSummary.sourceTranscriptHash || meeting.aiSummary.sourceTranscriptHash !== transcriptHash)
  ) {
    void ensureMeetingAiSummary(meeting.id).catch(() => null);
  }

  return NextResponse.json({
    status: buildSummaryStatus({
      hasTranscript: Boolean(transcriptText),
      summary: meeting.aiSummary
        ? {
            status: meeting.aiSummary.status,
            error: meeting.aiSummary.error
          }
        : null,
      hasReadySummary
    }),
    summary: hasReadySummary
      ? {
          markdown: meeting.aiSummary?.summaryMarkdown || "",
          generatedTitle: meeting.aiSummary?.generatedTitle || null,
          generatedDescription: meeting.aiSummary?.generatedDescription || null,
          providerModel: meeting.aiSummary?.providerModel || null,
          updatedAt: meeting.aiSummary?.updatedAt || null
        }
      : null
  });
}
