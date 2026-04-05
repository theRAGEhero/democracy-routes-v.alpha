import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Viewer = {
  user: {
    id: string | null;
    role: string;
    email: string;
  };
};

type PlanRecapEntry = {
  blockId: string;
  content: string;
  userEmail: string;
};

type PlanMeditationEntry = {
  meditationIndex: number;
  roundAfter: number | null;
  transcriptText: string;
  userEmail: string;
  createdAt: string;
};

type PlanMeetingTranscript = {
  meetingId: string;
  roundNumber: number;
  participants: string[];
  transcriptText: string;
};

type PlanRecordEntry = {
  blockId: string;
  transcriptText: string;
  userEmail: string;
  createdAt: string;
};

type PlanFormEntry = {
  blockId: string;
  choiceKey: string;
  userEmail: string;
  createdAt: string;
};

export type PlanRecapData = {
  plan: {
    id: string;
    title: string;
    startAt: string;
    timezone: string | null;
    roundsCount: number;
    roundDurationMinutes: number;
    language: string;
    transcriptionProvider: string;
  };
  recap: {
    textEntries: PlanRecapEntry[];
    meditationSessions: PlanMeditationEntry[];
    recordSessions: PlanRecordEntry[];
    formResponses: PlanFormEntry[];
    meetingTranscripts: PlanMeetingTranscript[];
    participants: string[];
  };
};

class PlanRecapError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractTranscriptText(raw: string | null) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const fromTopLevel = parsed?.contributions;
    const fromDeliberation = parsed?.deliberation?.contributions;
    const contributions = Array.isArray(fromTopLevel)
      ? fromTopLevel
      : Array.isArray(fromDeliberation)
        ? fromDeliberation
        : [];
    return contributions
      .map((entry: any) => entry?.text)
      .filter((text: any) => typeof text === "string")
      .join(" ");
  } catch {
    return "";
  }
}

type PlanRecapPlan = Prisma.PlanGetPayload<{
  include: {
    dataspace: {
      include: { members: { select: { userId: true } } };
    };
    rounds: {
      include: {
        pairs: {
          select: {
            userAId: true;
            userBId: true;
            meetingId: true;
            userA: { select: { email: true } };
            userB: { select: { email: true } };
          };
        };
      };
    };
  };
}>;

export async function getPlanRecapData(
  planId: string,
  viewer: Viewer
): Promise<PlanRecapData> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      dataspace: {
        include: { members: { select: { userId: true } } }
      },
      rounds: {
        include: {
          pairs: {
            select: {
              userAId: true,
              userBId: true,
              meetingId: true,
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    throw new PlanRecapError("Template not found", 404);
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const isPairParticipant = viewer.user.id
    ? plan.rounds.some(
        (round: (typeof plan.rounds)[number]) =>
          round.pairs.some(
            (pair: (typeof round.pairs)[number]) =>
              pair.userAId === viewer.user.id || pair.userBId === viewer.user.id
          )
      )
    : false;
  const participantRecord = viewer.user.id
    ? await prisma.planParticipant.findUnique({
        where: {
          planId_userId: {
            planId: plan.id,
            userId: viewer.user.id
          }
        },
        select: { status: true }
      })
    : null;
  const participantApproved = participantRecord?.status === "APPROVED";
  const isDataspaceMember = plan.dataspace
    ? plan.dataspace.members.some(
        (member: (typeof plan.dataspace.members)[number]) =>
          viewer.user.id ? member.userId === viewer.user.id : false
      )
    : false;

  if (!isAdmin && !isPairParticipant && !participantApproved && !(plan.isPublic && (plan.runtimeVersion === "ROOM_BASED" || isDataspaceMember))) {
    throw new PlanRecapError("Forbidden", 403);
  }

  return buildRecapFromPlan(plan);
}

export async function getPlanRecapDataForWorkflow(planId: string): Promise<PlanRecapData> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      dataspace: {
        include: { members: { select: { userId: true } } }
      },
      rounds: {
        include: {
          pairs: {
            select: {
              userAId: true,
              userBId: true,
              meetingId: true,
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    throw new PlanRecapError("Template not found", 404);
  }

  return buildRecapFromPlan(plan);
}

async function buildRecapFromPlan(plan: PlanRecapPlan): Promise<PlanRecapData> {

  const [textEntries, meditationSessions, recordSessions, formResponses] = await Promise.all([
    prisma.planTextEntry.findMany({
      where: { planId: plan.id },
      select: {
        blockId: true,
        content: true,
        user: { select: { email: true } }
      }
    }),
    prisma.planMeditationSession.findMany({
      where: { planId: plan.id },
      select: {
        meditationIndex: true,
        roundAfter: true,
        transcriptText: true,
        createdAt: true,
        user: { select: { email: true } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.planRecordSession.findMany({
      where: { planId: plan.id },
      select: {
        blockId: true,
        transcriptText: true,
        createdAt: true,
        user: { select: { email: true } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.planFormResponse.findMany({
      where: { planId: plan.id },
      select: {
        blockId: true,
        choiceKey: true,
        createdAt: true,
        user: { select: { email: true } }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const meetingPairs = plan.rounds.flatMap(
    (round: (typeof plan.rounds)[number]) =>
      round.pairs
        .filter((pair: (typeof round.pairs)[number]) => pair.meetingId)
        .map((pair: (typeof round.pairs)[number]) => ({
          roundNumber: round.roundNumber,
          meetingId: pair.meetingId as string,
          participants: [pair.userA?.email, pair.userB?.email].filter(Boolean) as string[]
        }))
  );
  const uniqueMeetingIds = Array.from(
    new Set(meetingPairs.map((pair: (typeof meetingPairs)[number]) => pair.meetingId))
  );
  const meetingTranscripts = uniqueMeetingIds.length
    ? await prisma.meetingTranscript.findMany({
        where: { meetingId: { in: uniqueMeetingIds } },
        select: {
          meetingId: true,
          transcriptText: true,
          transcriptJson: true
        }
      })
    : [];
  const transcriptByMeeting = new Map(
    meetingTranscripts.map((item: (typeof meetingTranscripts)[number]) => {
      const text = item.transcriptText && item.transcriptText.trim().length > 0
        ? item.transcriptText
        : extractTranscriptText(item.transcriptJson);
      return [item.meetingId, text ?? ""];
    })
  );

  const participantEmails = new Set<string>();
  plan.rounds.forEach((round: (typeof plan.rounds)[number]) => {
    round.pairs.forEach((pair: (typeof round.pairs)[number]) => {
      if (pair.userA?.email) participantEmails.add(pair.userA.email);
      if (pair.userB?.email) participantEmails.add(pair.userB.email);
    });
  });
  textEntries.forEach((entry: (typeof textEntries)[number]) => {
    if (entry.user?.email) participantEmails.add(entry.user.email);
  });
  meditationSessions.forEach((session: (typeof meditationSessions)[number]) => {
    if (session.user?.email) participantEmails.add(session.user.email);
  });
  recordSessions.forEach((session: (typeof recordSessions)[number]) => {
    if (session.user?.email) participantEmails.add(session.user.email);
  });
  formResponses.forEach((response: (typeof formResponses)[number]) => {
    if (response.user?.email) participantEmails.add(response.user.email);
  });
  const participants = Array.from(participantEmails);

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      startAt: plan.startAt.toISOString(),
      timezone: plan.timezone ?? null,
      roundsCount: plan.roundsCount,
      roundDurationMinutes: plan.roundDurationMinutes,
      language: plan.language,
      transcriptionProvider: plan.transcriptionProvider
    },
    recap: {
      textEntries: textEntries.map((entry: (typeof textEntries)[number]) => ({
        blockId: entry.blockId,
        content: entry.content,
        userEmail: entry.user.email
      })),
      meditationSessions: meditationSessions.map(
        (session: (typeof meditationSessions)[number]) => ({
          meditationIndex: session.meditationIndex,
          roundAfter: session.roundAfter,
          transcriptText: session.transcriptText ?? "",
          userEmail: session.user.email,
          createdAt: session.createdAt.toISOString()
        })
      ),
      recordSessions: recordSessions.map((session: (typeof recordSessions)[number]) => ({
        blockId: session.blockId,
        transcriptText: session.transcriptText ?? "",
        userEmail: session.user.email,
        createdAt: session.createdAt.toISOString()
      })),
      formResponses: formResponses.map((response: (typeof formResponses)[number]) => ({
        blockId: response.blockId,
        choiceKey: response.choiceKey,
        userEmail: response.user.email,
        createdAt: response.createdAt.toISOString()
      })),
      meetingTranscripts: meetingPairs.map((pair: (typeof meetingPairs)[number]) => ({
        meetingId: pair.meetingId,
        roundNumber: pair.roundNumber,
        participants: pair.participants,
        transcriptText: transcriptByMeeting.get(pair.meetingId) ?? ""
      })),
      participants
    }
  };
}

export function isPlanRecapError(error: unknown): error is PlanRecapError {
  return error instanceof PlanRecapError;
}
