import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const analysisSchema = z.object({
  prompt: z.string().min(1).max(5000),
  provider: z.enum(["gemini", "ollama"]).optional()
});

function extractTranscriptText(rawText: string | null, rawJson: string | null) {
  if (rawText?.trim()) return rawText.trim();
  if (!rawJson) return "";
  try {
    const parsed = JSON.parse(rawJson);
    const contributions = Array.isArray(parsed?.contributions)
      ? parsed.contributions
      : Array.isArray(parsed?.deliberation?.contributions)
        ? parsed.deliberation.contributions
        : [];
    return contributions
      .map((entry: any) => entry?.text)
      .filter((text: any) => typeof text === "string")
      .join(" ")
      .trim();
  } catch {
    return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = analysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const openProblem = await prisma.openProblem.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { email: true } },
      joins: { include: { user: { select: { email: true } } } },
      dataspace: { select: { id: true, name: true } },
      meetings: {
        where: { isHidden: false },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          timezone: true,
          scheduledStartAt: true,
          language: true,
          transcriptionProvider: true,
          createdBy: { select: { email: true } },
          members: { select: { user: { select: { email: true } } } },
          transcript: { select: { transcriptText: true, transcriptJson: true } },
          aiSummary: { select: { summaryMarkdown: true, status: true } }
        }
      },
      plans: {
        select: {
          id: true,
          title: true,
          description: true,
          startAt: true,
          timezone: true,
          roundsCount: true,
          roundDurationMinutes: true,
          language: true,
          transcriptionProvider: true,
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { analysis: true }
          }
        }
      }
    }
  });

  if (!openProblem) {
    return NextResponse.json({ error: "Open problem not found" }, { status: 404 });
  }

  const isDataspaceMember = openProblem.dataspaceId
    ? Boolean(
        await prisma.dataspaceMember.findUnique({
          where: {
            dataspaceId_userId: {
              dataspaceId: openProblem.dataspaceId,
              userId: session.user.id
            }
          },
          select: { id: true }
        })
      )
    : true;

  const canAccess =
    session.user.role === "ADMIN" ||
    openProblem.createdById === session.user.id ||
    openProblem.joins.some((join) => join.userId === session.user.id) ||
    isDataspaceMember;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flowIds = openProblem.plans.map((plan) => plan.id);
  const [textEntries, meditationSessions, recordSessions] = await Promise.all([
    flowIds.length
      ? prisma.planTextEntry.findMany({
          where: { planId: { in: flowIds } },
          select: {
            blockId: true,
            content: true,
            user: { select: { email: true } }
          }
        })
      : [],
    flowIds.length
      ? prisma.planMeditationSession.findMany({
          where: { planId: { in: flowIds } },
          select: {
            meditationIndex: true,
            roundAfter: true,
            transcriptText: true,
            createdAt: true,
            user: { select: { email: true } }
          },
          orderBy: { createdAt: "asc" }
        })
      : [],
    flowIds.length
      ? prisma.planRecordSession.findMany({
          where: { planId: { in: flowIds } },
          select: {
            id: true,
            transcriptText: true,
            user: { select: { email: true } }
          }
        })
      : []
  ]);

  const recap = {
    textEntries: [
      {
        blockId: `open-problem:${openProblem.id}`,
        content: `${openProblem.title}\n${openProblem.description}`,
        userEmail: openProblem.createdBy.email
      },
      ...openProblem.meetings
        .map((meeting) => ({
          blockId: `meeting-summary:${meeting.id}`,
          content: meeting.aiSummary?.summaryMarkdown || meeting.description || "",
          userEmail: meeting.createdBy.email
        }))
        .filter((entry) => entry.content && entry.content.trim().length > 0),
      ...openProblem.plans
        .flatMap((plan) => [
          {
            blockId: `plan:${plan.id}`,
            content:
              `${plan.title}\n${plan.description ?? ""}\n${plan.analyses[0]?.analysis ?? ""}`.trim(),
            userEmail: openProblem.createdBy.email
          }
        ])
        .filter((entry) => entry.content && entry.content.trim().length > 0),
      ...textEntries.map((entry) => ({
        blockId: entry.blockId,
        content: entry.content,
        userEmail: entry.user.email
      })),
      ...recordSessions.map((entry) => ({
        blockId: `record:${entry.id}`,
        content: entry.transcriptText ?? "",
        userEmail: entry.user.email
      }))
    ].filter((entry) => entry.content.trim().length > 0),
    meditationSessions: meditationSessions.map((session) => ({
      meditationIndex: session.meditationIndex,
      roundAfter: session.roundAfter,
      transcriptText: session.transcriptText ?? "",
      userEmail: session.user.email,
      createdAt: session.createdAt.toISOString()
    })),
    meetingTranscripts: openProblem.meetings
      .map((meeting) => {
        const transcriptText = extractTranscriptText(
          meeting.transcript?.transcriptText ?? null,
          meeting.transcript?.transcriptJson ?? null
        );
        return {
          meetingId: meeting.id,
          roundNumber: 0,
          participants: Array.from(
            new Set(
              [meeting.createdBy.email, ...meeting.members.map((member) => member.user.email)].filter(Boolean)
            )
          ),
          transcriptText
        };
      })
      .filter((meeting) => meeting.transcriptText.length > 0),
    participants: Array.from(
      new Set([openProblem.createdBy.email, ...openProblem.joins.map((join) => join.user.email)])
    )
  };

  if (
    recap.textEntries.length === 0 &&
    recap.meditationSessions.length === 0 &&
    recap.meetingTranscripts.length === 0
  ) {
    return NextResponse.json({ error: "No linked meeting or flow material is available yet." }, { status: 400 });
  }

  const baseUrl = process.env.ANALYZE_TABLES_API_URL || "http://localhost:3001";
  const apiKey = process.env.ANALYZE_TABLES_API_KEY;
  const provider = parsed.data.provider ?? "gemini";

  const response = await fetch(`${baseUrl}/api/plan-analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify({
      plan: {
        id: openProblem.id,
        title: openProblem.title,
        startAt: openProblem.createdAt.toISOString(),
        timezone: null,
        roundsCount: openProblem.plans.length,
        roundDurationMinutes: 0,
        language: "MIXED",
        transcriptionProvider: "MIXED"
      },
      recap,
      prompt: parsed.data.prompt,
      provider
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Failed to analyze open problem", details: errorData },
      { status: response.status }
    );
  }

  const payload = await response.json();
  return NextResponse.json({
    analysis: payload.analysis,
    createdAt: new Date().toISOString(),
    metadata: payload.metadata ?? null
  });
}
