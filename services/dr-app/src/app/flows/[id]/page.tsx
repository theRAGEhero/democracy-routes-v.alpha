import { getServerSession } from "next-auth";
import type { CSSProperties } from "react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ParticipantViewClient } from "@/app/flows/[id]/ParticipantViewClient";
import { PlanParticipation } from "@/app/flows/[id]/PlanParticipation";
import { PlanAnalysisPanel } from "@/app/flows/[id]/PlanAnalysisPanel";
import { StartNowButton } from "@/app/flows/[id]/StartNowButton";
import { MatchingPanel } from "@/app/flows/[id]/MatchingPanel";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import { normalizeCallBaseUrl } from "@/lib/callUrl";
import { buildVideoAccessToken } from "@/lib/videoAccess";
import Link from "next/link";
import { DEFAULT_DATASPACE_COLOR, getDataspaceTheme } from "@/lib/dataspaceColor";

export default async function PlanParticipantPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: {
        include: {
          members: { select: { userId: true } }
        }
      },
      blocks: {
        orderBy: { orderIndex: "asc" },
        include: {
          poster: { select: { id: true, title: true, content: true } }
        }
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          pairs: {
            include: {
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      },
      participants: {
        include: {
          user: { select: { email: true } }
        }
      }
    }
  });

  if (!plan) {
    return <p className="text-sm text-slate-600">Template not found.</p>;
  }

  let latestAnalysis: {
    analysis: string;
    prompt: string;
    provider: string;
    createdAt: Date;
  } | null = null;

  try {
    latestAnalysis = await prisma.planAnalysis.findFirst({
      where: { planId: plan.id },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      !["P2021", "P2022"].includes(error.code)
    ) {
      throw error;
    }
  }

  const isAdmin = session.user.role === "ADMIN";
  const isPairParticipant = plan.rounds.some(
    (round: (typeof plan.rounds)[number]) =>
      round.pairs.some(
        (pair: (typeof round.pairs)[number]) =>
          pair.userAId === session.user.id || pair.userBId === session.user.id
      )
  );
  const participantApproved = plan.participants.some(
    (participant: (typeof plan.participants)[number]) =>
      participant.userId === session.user.id && participant.status === "APPROVED"
  );
  const isDataspaceMember = plan.dataspace
    ? plan.dataspace.members.some(
        (member: (typeof plan.dataspace.members)[number]) =>
          member.userId === session.user.id
      )
    : false;

  if (!isAdmin && !isPairParticipant && !participantApproved && !(plan.isPublic && isDataspaceMember)) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = block.type as PlanBlockType;
      if (!["PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "HARMONICA", "MATCHING"].includes(type)) {
        return acc;
      }
        acc.push({
          id: block.id,
          type,
          durationSeconds: block.durationSeconds,
          roundNumber: block.roundNumber ?? null,
          posterId: block.posterId ?? null,
          embedUrl: block.embedUrl ?? null,
          matchingMode: normalizeMatchingMode(block.matchingMode)
        });
      return acc;
    },
    []
  );
  const schedule =
    normalizedBlocks.length > 0
      ? buildPlanSegmentsFromBlocks(plan.startAt, normalizedBlocks)
      : buildLegacySegments({
          startAt: plan.startAt,
          roundsCount: plan.roundsCount,
          roundDurationMinutes: plan.roundDurationMinutes,
          meditationEnabled: plan.meditationEnabled,
          meditationAtStart: plan.meditationAtStart,
          meditationBetweenRounds: plan.meditationBetweenRounds,
          meditationAtEnd: plan.meditationAtEnd,
          meditationDurationMinutes: plan.meditationDurationMinutes
        });
  const { totalEndMs } = schedule;
  const isOwner = plan.createdById === session.user.id;
  const canEdit = (isAdmin || isOwner) && Date.now() <= totalEndMs;
  const canStartNow = (isAdmin || isOwner) && plan.startAt.getTime() > Date.now();

  const participantRecord = plan.participants.find(
    (participant: (typeof plan.participants)[number]) =>
      participant.userId === session.user.id
  );
  const pendingRequests = plan.participants
    .filter(
      (participant: (typeof plan.participants)[number]) =>
        participant.status === "PENDING"
    )
    .map((participant: (typeof plan.participants)[number]) => ({
      id: participant.id,
      email: participant.user.email
    }));

  const allRoomIds = Array.from(
    new Set(
      plan.rounds.flatMap((round) =>
        round.pairs.map((pair) => pair.roomId).filter(Boolean)
      )
    )
  ) as string[];
  const meetingsByRoomId = allRoomIds.length
    ? await prisma.meeting.findMany({
        where: { roomId: { in: allRoomIds } },
        select: { id: true, roomId: true }
      })
    : [];
  const meetingIdByRoom = new Map(
    meetingsByRoomId.map((meeting) => [meeting.roomId, meeting.id])
  );
  const accessTokensByRoomId = new Map(
    allRoomIds.map((roomId) => [
      roomId,
      buildVideoAccessToken({
        roomId,
        meetingId: meetingIdByRoom.get(roomId) ?? null,
        userId: session.user.id,
        userEmail: session.user.email
      })
    ])
  );

  const assignments = plan.rounds.map(
    (round: (typeof plan.rounds)[number]) => {
    const rooms = new Map<string, string[]>();
    const meetingByRoom = new Map<string, string>();
    round.pairs.forEach((pair: (typeof round.pairs)[number]) => {
      if (!rooms.has(pair.roomId)) {
        rooms.set(pair.roomId, []);
      }
      const list = rooms.get(pair.roomId) ?? [];
      if (pair.userA?.email) list.push(pair.userA.email);
      if (pair.userB?.email) list.push(pair.userB.email);
      rooms.set(pair.roomId, list);
      const meetingId = pair.meetingId ?? meetingIdByRoom.get(pair.roomId) ?? null;
      if (meetingId) {
        meetingByRoom.set(pair.roomId, meetingId);
      }
    });

    const userEmail = session.user.email;
    let assignedRoomId = "";
    let partnerLabel = "Break";
    let isBreak = true;

    for (const [roomId, participants] of rooms.entries()) {
      if (participants.includes(userEmail)) {
        assignedRoomId = roomId;
        const partners = participants.filter((email) => email !== userEmail);
        partnerLabel = partners.length ? partners.join(", ") : "Break";
        isBreak = partners.length === 0;
        break;
      }
    }

    return {
      roundNumber: round.roundNumber,
      roomId: assignedRoomId,
      partnerLabel,
      isBreak,
      meetingId: assignedRoomId ? meetingByRoom.get(assignedRoomId) ?? null : null
    };
  });

  const roundGroups = plan.rounds.map(
    (round: (typeof plan.rounds)[number]) => {
    const rooms = new Map<string, string[]>();
    const meetingByRoom = new Map<string, string>();
    round.pairs.forEach((pair: (typeof round.pairs)[number]) => {
      if (!rooms.has(pair.roomId)) {
        rooms.set(pair.roomId, []);
      }
      const list = rooms.get(pair.roomId) ?? [];
      if (pair.userA?.email) list.push(pair.userA.email);
      if (pair.userB?.email) list.push(pair.userB.email);
      rooms.set(pair.roomId, list);
      const meetingId = pair.meetingId ?? meetingIdByRoom.get(pair.roomId) ?? null;
      if (meetingId) {
        meetingByRoom.set(pair.roomId, meetingId);
      }
    });
    return {
      roundNumber: round.roundNumber,
      rooms: Array.from(rooms.entries()).map(([roomId, participants]) => ({
        roomId,
        participants,
        meetingId: meetingByRoom.get(roomId) ?? null
      }))
    };
  });

  const meditationBlocks = plan.blocks.filter(
    (block: (typeof plan.blocks)[number]) => block.type === "PAUSE"
  );
  const meditationTotalMinutes = meditationBlocks.length
    ? Math.max(
        1,
        Math.round(
          meditationBlocks.reduce(
            (sum: number, block: (typeof meditationBlocks)[number]) =>
              sum + block.durationSeconds,
            0
          ) / 60
        )
      )
    : 0;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true }
  });
  const participantCallDisplayName =
    String(currentUser?.email || "").trim() || session.user.email;
  const theme = getDataspaceTheme(plan.dataspace?.color ?? DEFAULT_DATASPACE_COLOR);

  return (
    <div className="dataspace-theme" style={theme as CSSProperties}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Template Participant View
          </h1>
          <p className="text-sm text-slate-600">Personalized call link and pairing status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canStartNow ? <StartNowButton planId={plan.id} /> : null}
          {canEdit ? (
            <Link href={`/flows/${plan.id}/edit`} className="dr-button-outline px-3 py-1 text-xs">
              Edit plan
            </Link>
          ) : null}
        </div>
      </div>
      <ParticipantViewClient
        planId={plan.id}
        planTitle={plan.title}
        language={plan.language}
        transcriptionProvider={plan.transcriptionProvider}
        startAt={plan.startAt.toISOString()}
        roundDurationMinutes={plan.roundDurationMinutes}
        roundsCount={plan.roundsCount}
        syncMode={plan.syncMode === "CLIENT" ? "CLIENT" : "SERVER"}
        meditationEnabled={plan.meditationEnabled}
        meditationAtStart={plan.meditationAtStart}
        meditationBetweenRounds={plan.meditationBetweenRounds}
        meditationAtEnd={plan.meditationAtEnd}
        meditationDurationMinutes={plan.meditationDurationMinutes}
        meditationAnimationId={plan.meditationAnimationId}
        meditationAudioUrl={plan.meditationAudioUrl}
        blocks={plan.blocks.map((block: (typeof plan.blocks)[number]) => ({
          id: block.id,
          type: block.type as PlanBlockType,
          durationSeconds: block.durationSeconds,
          roundNumber: block.roundNumber,
          formQuestion: block.formQuestion ?? null,
          formChoices: (() => {
            if (!block.formChoicesJson) return null;
            try {
              return JSON.parse(block.formChoicesJson) as Array<{ key: string; label: string }>;
            } catch {
              return null;
            }
          })(),
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: normalizeMatchingMode(block.matchingMode),
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null,
          poster: block.poster
            ? { id: block.poster.id, title: block.poster.title, content: block.poster.content }
            : null
        }))}
        roundGroups={roundGroups}
        assignments={assignments}
        baseUrl={normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "")}
        accessTokens={Object.fromEntries(accessTokensByRoomId)}
        userEmail={session.user.email}
        callDisplayName={participantCallDisplayName}
        canSkip={isOwner}
      />
      <MatchingPanel planId={plan.id} canRun={isAdmin || isOwner} />
      <PlanAnalysisPanel
        planId={plan.id}
        initialAnalysis={
          latestAnalysis
            ? {
                analysis: latestAnalysis.analysis,
                prompt: latestAnalysis.prompt,
                provider: latestAnalysis.provider,
                createdAt: latestAnalysis.createdAt.toISOString()
              }
            : null
        }
      />
      {plan.isPublic ? (
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Template rules</h2>
          {plan.description ? (
            <p className="mt-2 text-sm text-slate-700">{plan.description}</p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Pairings</p>
              <p>{plan.roundsCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Minutes per pairing</p>
              <p>{plan.roundDurationMinutes}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Switching mode</p>
              <p>{plan.syncMode === "CLIENT" ? "Client-driven" : "Server-driven"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Max per room</p>
              <p>{plan.maxParticipantsPerRoom}</p>
            </div>
            {plan.capacity ? (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Capacity</p>
                <p>{plan.capacity}</p>
              </div>
            ) : null}
            {meditationBlocks.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Pause blocks</p>
                <p>
                  {meditationBlocks.length} · {meditationTotalMinutes} min total
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <PlanParticipation
        planId={plan.id}
        isPublic={plan.isPublic}
        requiresApproval={plan.requiresApproval}
        capacity={plan.capacity}
        isDataspaceMember={isDataspaceMember}
        isFixedParticipant={isPairParticipant}
        participantStatus={participantRecord?.status ?? null}
        pendingRequests={pendingRequests}
        canManageRequests={isAdmin || plan.createdById === session.user.id}
      />
      </div>
    </div>
  );
}
