import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  getSegmentAtTime,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import crypto from "crypto";

function generateRoomId(language: string, transcriptionProvider: string) {
  const providerLabel =
    transcriptionProvider === "VOSK"
      ? "VOSK"
      : transcriptionProvider === "DEEPGRAMLIVE"
        ? "DEEPGRAMLIVE"
        : "DEEPGRAM";
  const base = crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
  return `${base}-${language}-${providerLabel}`;
}

function makeGroups(
  userIds: string[],
  maxParticipantsPerRoom: number,
  allowOddGroup: boolean
) {
  const list = [...userIds];
  if (maxParticipantsPerRoom === 2 && list.length % 2 === 1) {
    if (allowOddGroup && list.length >= 3) {
      const groups: Array<string[]> = [];
      for (let i = 0; i < list.length - 3; i += 2) {
        groups.push(list.slice(i, i + 2));
      }
      groups.push(list.slice(list.length - 3));
      return groups;
    }
    list.push("__break__");
  }

  const groups: Array<string[]> = [];
  for (let i = 0; i < list.length; i += maxParticipantsPerRoom) {
    groups.push(list.slice(i, i + maxParticipantsPerRoom));
  }
  return groups;
}

function getFormBlockByRound(
  blocks: Array<{ type: string; id: string }>,
  roundNumber: number
) {
  let roundCounter = 0;
  let pendingForm: { id: string } | null = null;
  for (const block of blocks) {
    if (block.type === "FORM") {
      pendingForm = { id: block.id };
    }
    if (block.type === "ROUND") {
      roundCounter += 1;
      if (roundCounter === roundNumber) {
        return pendingForm;
      }
      pendingForm = null;
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const requestUrl = new URL(_request.url);
  const includeMeetings = requestUrl.searchParams.get("include_meetings") === "1";
  const viewer = await getPlanViewer(_request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const plan = isAdmin
    ? await prisma.plan.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          title: true,
          startAt: true,
          roundsCount: true,
          roundDurationMinutes: true,
          createdById: true,
          dataspaceId: true,
          maxParticipantsPerRoom: true,
          allowOddGroup: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true,
          meditationAtStart: true,
          meditationBetweenRounds: true,
          meditationAtEnd: true,
          meditationDurationMinutes: true,
          participants: {
            where: { status: "APPROVED" },
            select: { userId: true }
          },
          blocks: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              durationSeconds: true,
              roundNumber: true,
              roundMaxParticipants: true,
              posterId: true
            }
          }
        }
      })
    : await prisma.plan.findFirst({
        where: {
          id: params.id,
          OR: [
            {
              rounds: {
                some: {
                  pairs: {
                    some: {
                      OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
                    }
                  }
                }
              }
            },
            {
              participants: {
                some: {
                  userId: viewer.user.id,
                  status: "APPROVED"
                }
              }
            }
          ]
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          roundsCount: true,
          roundDurationMinutes: true,
          createdById: true,
          dataspaceId: true,
          maxParticipantsPerRoom: true,
          allowOddGroup: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true,
          meditationAtStart: true,
          meditationBetweenRounds: true,
          meditationAtEnd: true,
          meditationDurationMinutes: true,
          participants: {
            where: { status: "APPROVED" },
            select: { userId: true }
          },
          blocks: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              durationSeconds: true,
              roundNumber: true,
              roundMaxParticipants: true,
              posterId: true
            }
          }
        }
      });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = block.type as PlanBlockType;
      if (!["ROUND", "MEDITATION", "POSTER", "TEXT", "RECORD", "FORM"].includes(type)) {
        return acc;
      }
      acc.push({
        id: block.id,
        type,
        durationSeconds: block.durationSeconds,
        roundNumber: block.roundNumber ?? null,
        roundMaxParticipants: block.roundMaxParticipants ?? null,
        posterId: block.posterId ?? null
      });
      return acc;
    },
    []
  );

  const now = new Date();
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

  const nowMs = now.getTime();
  const elapsed = nowMs - plan.startAt.getTime();
  const currentSegment = getSegmentAtTime(schedule.segments, nowMs);
  const currentRoundIndex =
    currentSegment?.type === "ROUND"
      ? currentSegment?.roundNumber ?? 1
      : currentSegment?.roundAfter ?? 1;
  const roundBlocks = normalizedBlocks.filter((block) => block.type === "ROUND");

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && nowMs < schedule.totalEndMs) {
    status = "active";
  } else if (nowMs >= schedule.totalEndMs) {
    status = "done";
  }

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), plan.roundsCount);
  let currentRoundMeetings: Array<{ roomId: string; meetingId: string }> = [];

  if (status === "active" && currentSegment?.type === "ROUND") {
    const formBlock = getFormBlockByRound(plan.blocks, currentRound);
    const roundMax =
      roundBlocks[currentRound - 1]?.roundMaxParticipants ?? plan.maxParticipantsPerRoom;
    const allowOddGroup = Boolean(plan.allowOddGroup);
    const round = await prisma.planRound.findUnique({
      where: {
        planId_roundNumber: {
          planId: plan.id,
          roundNumber: currentRound
        }
      },
      include: {
        pairs: true
      }
    });

    if (round) {
      let pairs = round.pairs;
      if (formBlock) {
        const hasMeeting = pairs.some((pair: (typeof pairs)[number]) => pair.meetingId);
        if (!hasMeeting) {
          const participantIds = Array.from(
            new Set(plan.participants.map((participant) => participant.userId))
          ).sort();
          const fallbackParticipants =
            participantIds.length === 0
              ? Array.from(
                  new Set(
                    pairs
                      .flatMap((pair) => [pair.userAId, pair.userBId].filter(Boolean))
                      .filter((id): id is string => typeof id === "string")
                  )
                ).sort()
              : participantIds;
          const responses = await prisma.planFormResponse.findMany({
            where: { planId: plan.id, blockId: formBlock.id },
            select: { userId: true, choiceKey: true }
          });
          const responseMap = new Map(
            responses.map((response: (typeof responses)[number]) => [
              response.userId,
              response.choiceKey
            ])
          );
          const grouped = new Map<string, string[]>();
          fallbackParticipants.forEach((userId) => {
            const key = responseMap.get(userId) ?? "__no_response__";
            const list = grouped.get(key) ?? [];
            list.push(userId);
            grouped.set(key, list);
          });

          const recomputedPairs: Array<{ roomId: string; userAId: string; userBId: string | null }> =
            [];
          const groupEntries = Array.from(grouped.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
          );
          for (const [, groupUsers] of groupEntries) {
            const orderedUsers = [...groupUsers].sort();
            const groups = makeGroups(orderedUsers, roundMax, allowOddGroup);
            for (const group of groups) {
              const roomId = generateRoomId(plan.language, plan.transcriptionProvider);
              for (let index = 0; index < group.length; index += 2) {
                const userAId = group[index];
                if (userAId === "__break__") continue;
                const userBId = group[index + 1] ?? null;
                recomputedPairs.push({
                  roomId,
                  userAId,
                  userBId: userBId === "__break__" ? null : userBId
                });
              }
            }
          }

          await prisma.$transaction([
            prisma.planPair.deleteMany({ where: { planRoundId: round.id } }),
            ...(recomputedPairs.length
              ? [
                  prisma.planPair.createMany({
                    data: recomputedPairs.map((pair) => ({
                      planRoundId: round.id,
                      roomId: pair.roomId,
                      userAId: pair.userAId,
                      userBId: pair.userBId
                    }))
                  })
                ]
              : [])
          ]);
          pairs = recomputedPairs.map((pair) => ({
            ...pair,
            meetingId: null
          })) as typeof round.pairs;
        }
      }
      const roundStart = new Date(currentSegment.startAtMs);
      const roundEnd = new Date(currentSegment.endAtMs);
      const rooms = new Map<string, Set<string>>();

      pairs.forEach((pair: (typeof round.pairs)[number]) => {
        if (!rooms.has(pair.roomId)) {
          rooms.set(pair.roomId, new Set());
        }
        const set = rooms.get(pair.roomId);
        set?.add(pair.userAId);
        if (pair.userBId) {
          set?.add(pair.userBId);
        }
      });

      for (const [roomId, userIds] of rooms.entries()) {
        if (userIds.size < 2) {
          continue;
        }

        let meeting = await prisma.meeting.findUnique({
          where: { roomId }
        });

        if (!meeting) {
          meeting = await prisma.meeting.create({
            data: {
              title: `${plan.title} - Round ${currentRound}`,
              roomId,
              createdById: plan.createdById,
              scheduledStartAt: roundStart,
              expiresAt: roundEnd,
              language: plan.language,
              transcriptionProvider: plan.transcriptionProvider,
              dataspaceId: plan.dataspaceId ?? null,
              isHidden: true,
              members: {
                create: Array.from(userIds).map((userId) => ({
                  userId,
                  role: "GUEST"
                }))
              }
            }
          });
        } else {
          const existingMembers = await prisma.meetingMember.findMany({
            where: {
              meetingId: meeting.id,
              userId: { in: Array.from(userIds) }
            },
            select: { userId: true }
          });
          const existingIds = new Set(
            existingMembers.map(
              (member: (typeof existingMembers)[number]) => member.userId
            )
          );
          for (const userId of userIds) {
            if (existingIds.has(userId)) continue;
            await prisma.meetingMember.create({
              data: {
                meetingId: meeting.id,
                userId,
                role: "GUEST"
              }
            });
          }
        }

        await prisma.planPair.updateMany({
          where: {
            planRoundId: round.id,
            roomId,
            meetingId: null
          },
          data: {
            meetingId: meeting.id
          }
        });

        currentRoundMeetings.push({ roomId, meetingId: meeting.id });
      }
    }
  }

  let assignment: {
    roundNumber: number;
    roomId: string;
    meetingId: string | null;
    isBreak: boolean;
  } | null = null;

  if (status === "active" && currentSegment?.type === "ROUND") {
    const meetingIdByRoom = new Map(
      currentRoundMeetings.map((item: (typeof currentRoundMeetings)[number]) => [
        item.roomId,
        item.meetingId
      ])
    );
    const round = await prisma.planRound.findUnique({
      where: {
        planId_roundNumber: {
          planId: plan.id,
          roundNumber: currentRound
        }
      },
      include: {
        pairs: true
      }
    });
    const pair = round?.pairs.find(
      (pairItem: (typeof round.pairs)[number]) =>
        pairItem.userAId === viewer.user.id || pairItem.userBId === viewer.user.id
    );
    if (pair) {
      assignment = {
        roundNumber: currentRound,
        roomId: pair.roomId,
        meetingId: meetingIdByRoom.get(pair.roomId) ?? pair.meetingId ?? null,
        isBreak: !pair.userBId
      };
    }
  }

  return NextResponse.json({
    serverNow: now.toISOString(),
    status,
    currentRound,
    segmentType: currentSegment?.type ?? "ROUND",
    meditationIndex: currentSegment?.meditationIndex ?? null,
    roundAfter: currentSegment?.roundAfter ?? null,
    segmentStartsAt: currentSegment?.startAtMs
      ? new Date(currentSegment.startAtMs).toISOString()
      : null,
    segmentEndsAt: currentSegment?.endAtMs
      ? new Date(currentSegment.endAtMs).toISOString()
      : null,
    currentRoundMeetings: includeMeetings ? currentRoundMeetings : undefined,
    assignment
  });
}
