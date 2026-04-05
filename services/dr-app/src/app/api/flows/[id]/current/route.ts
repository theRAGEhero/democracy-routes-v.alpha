import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  getSegmentAtTime,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import crypto from "crypto";
import { normalizeBlockType } from "@/lib/blockType";
import { generateFlowRoomId } from "@/lib/flowRuntime";
import { getFlowAdmissionState } from "@/lib/flowRuntime";
import { buildVideoAccessToken } from "@/lib/videoAccess";
import { getRoomProviderSuffix } from "@/lib/transcriptionProviders";

function generateRoomId(language: string, transcriptionProvider: string) {
  const providerLabel = getRoomProviderSuffix(transcriptionProvider);
  const base = crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
  return `${base}-${language}-${providerLabel}`;
}

function shuffleSessionIds(sessionIds: string[]) {
  const list = [...sessionIds];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = crypto.randomInt(0, index + 1);
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list;
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
    if (block.type === "DISCUSSION") {
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
          runtimeVersion: true,
          admissionMode: true,
          joinOpensAt: true,
          joinClosesAt: true,
          lateJoinMinParticipants: true,
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
              posterId: true,
              embedUrl: true,
              harmonicaUrl: true,
              matchingMode: true
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
            },
            {
              participantSessions: {
                some: viewer.participantSessionId
                  ? { id: viewer.participantSessionId }
                  : viewer.user.id
                    ? {
                        userId: viewer.user.id,
                        status: "APPROVED"
                      }
                    : { id: "__never__" }
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
          runtimeVersion: true,
          admissionMode: true,
          joinOpensAt: true,
          joinClosesAt: true,
          lateJoinMinParticipants: true,
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
              posterId: true,
              embedUrl: true,
              harmonicaUrl: true,
              matchingMode: true
            }
          }
        }
      });

  if (!plan) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = normalizeBlockType(block.type) as PlanBlockType | null;
      if (!type || !["START", "PARTICIPANTS", "DISCUSSION", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "GROUPING", "BREAK", "HARMONICA", "DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(type)) {
        return acc;
      }
      acc.push({
        id: block.id,
        type,
        durationSeconds: block.durationSeconds,
        roundNumber: block.roundNumber ?? null,
        roundMaxParticipants: block.roundMaxParticipants ?? null,
        posterId: block.posterId ?? null,
        embedUrl: block.embedUrl ?? null,
        harmonicaUrl: block.harmonicaUrl ?? null,
        matchingMode: normalizeMatchingMode(block.matchingMode)
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
  const admission = getFlowAdmissionState({
    admissionMode: plan.admissionMode,
    joinOpensAt: plan.joinOpensAt,
    joinClosesAt: plan.joinClosesAt,
    now,
    flowEndsAtMs: schedule.totalEndMs
  });
  const currentRoundIndex =
    currentSegment?.type === "DISCUSSION"
      ? currentSegment?.roundNumber ?? 1
      : currentSegment?.roundAfter ?? 1;
  const roundBlocks = normalizedBlocks.filter((block) => block.type === "DISCUSSION");

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && nowMs < schedule.totalEndMs) {
    status = "active";
  } else if (nowMs >= schedule.totalEndMs) {
    status = "done";
  }

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), plan.roundsCount);
  let currentRoundMeetings: Array<{ roomId: string; meetingId: string; accessToken: string }> = [];
  let waitingRoom: {
    waitingCount: number;
    minParticipantsToStart: number;
    roomSize: number;
    participantsNeeded: number;
    participantWaiting: boolean;
  } | null = null;

  if (plan.runtimeVersion === "ROOM_BASED") {
    const activeParticipantSession =
      viewer.participantSessionId
        ? await prisma.planParticipantSession.findUnique({
            where: { id: viewer.participantSessionId },
            select: {
              id: true,
              userId: true,
              displayName: true,
              guestEmail: true,
              status: true
            }
          })
        : viewer.user.id
          ? await prisma.planParticipantSession.findUnique({
              where: {
                planId_userId: {
                  planId: plan.id,
                  userId: viewer.user.id
                }
              },
              select: {
                id: true,
                userId: true,
                displayName: true,
                guestEmail: true,
                status: true
              }
            })
          : null;

    if (status === "active" && currentSegment?.type === "DISCUSSION") {
      const roundMax =
        roundBlocks[currentRound - 1]?.roundMaxParticipants ?? plan.maxParticipantsPerRoom;
      let round = await prisma.planRound.findUnique({
        where: {
          planId_roundNumber: {
            planId: plan.id,
            roundNumber: currentRound
          }
        },
        include: {
          rooms: {
            include: {
              members: {
                include: {
                  participantSession: {
                    select: {
                      id: true,
                      userId: true,
                      displayName: true,
                      guestEmail: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (round && round.rooms.length === 0) {
        const sessions = await prisma.planParticipantSession.findMany({
          where: {
            planId: plan.id,
            status: "APPROVED"
          },
          orderBy: { joinedAt: "asc" },
          select: { id: true }
        });
        const shuffledIds = shuffleSessionIds(sessions.map((session) => session.id));
        const groups = makeGroups(shuffledIds, roundMax, Boolean(plan.allowOddGroup));

        await prisma.$transaction(async (tx) => {
          for (const group of groups) {
            const memberIds = group.filter((id) => id !== "__break__");
            if (memberIds.length < 2) {
              continue;
            }
            const room = await tx.planRoom.create({
              data: {
                planId: plan.id,
                planRoundId: round!.id,
                blockId: currentSegment.blockId ?? null,
                roomId: generateFlowRoomId(plan.language, plan.transcriptionProvider),
                groupingMode: "random"
              }
            });
            await tx.planRoomMember.createMany({
              data: memberIds.map((participantSessionId) => ({
                planRoomId: room.id,
                participantSessionId
              }))
            });
          }
        });

        round = await prisma.planRound.findUnique({
          where: {
            planId_roundNumber: {
              planId: plan.id,
              roundNumber: currentRound
            }
          },
          include: {
            rooms: {
              include: {
                members: {
                  include: {
                    participantSession: {
                      select: {
                        id: true,
                        userId: true,
                        displayName: true,
                        guestEmail: true
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }

      if (round) {
        const assignedSessionIds = new Set(
          round.rooms.flatMap((room) =>
            room.members.map((member) => member.participantSession.id)
          )
        );
        const threshold = Math.max(
          2,
          Math.min(plan.lateJoinMinParticipants ?? 3, roundMax)
        );
        const waitingSessions = await prisma.planParticipantSession.findMany({
          where: {
            planId: plan.id,
            status: "APPROVED",
            id: { notIn: Array.from(assignedSessionIds) }
          },
          orderBy: { joinedAt: "asc" },
          select: { id: true }
        });

        if (waitingSessions.length >= threshold) {
          const groups = makeGroups(
            waitingSessions.map((session) => session.id),
            roundMax,
            Boolean(plan.allowOddGroup)
          );
          const groupsToCreate = groups
            .map((group) => group.filter((id) => id !== "__break__"))
            .filter((group) => group.length >= threshold);

          if (groupsToCreate.length > 0) {
            await prisma.$transaction(async (tx) => {
              for (const group of groupsToCreate) {
                const room = await tx.planRoom.create({
                  data: {
                    planId: plan.id,
                    planRoundId: round!.id,
                    blockId: currentSegment.blockId ?? null,
                    roomId: generateFlowRoomId(plan.language, plan.transcriptionProvider),
                    groupingMode: "random"
                  }
                });
                await tx.planRoomMember.createMany({
                  data: group.map((participantSessionId) => ({
                    planRoomId: room.id,
                    participantSessionId
                  }))
                });
              }
            });

            round = await prisma.planRound.findUnique({
              where: {
                planId_roundNumber: {
                  planId: plan.id,
                  roundNumber: currentRound
                }
              },
              include: {
                rooms: {
                  include: {
                    members: {
                      include: {
                        participantSession: {
                          select: {
                            id: true,
                            userId: true,
                            displayName: true,
                            guestEmail: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            });
          }
        }
      }

      if (round) {
        for (const room of round.rooms) {
          let meetingId = room.meetingId ?? null;
          if (!meetingId) {
            const registeredMembers = room.members
              .map((member) => member.participantSession.userId)
              .filter((userId): userId is string => Boolean(userId));

            const meeting = await prisma.meeting.create({
              data: {
                title: `${plan.title} - Round ${currentRound}`,
                roomId: room.roomId,
                createdById: plan.createdById,
                scheduledStartAt: new Date(currentSegment.startAtMs),
                expiresAt: new Date(currentSegment.endAtMs),
                language: plan.language,
                transcriptionProvider: plan.transcriptionProvider,
                dataspaceId: plan.dataspaceId ?? null,
                isHidden: true,
                members: {
                  create: registeredMembers.map((userId) => ({
                    userId,
                    role: "GUEST"
                  }))
                }
              }
            });
            meetingId = meeting.id;
            await prisma.planRoom.update({
              where: { id: room.id },
              data: { meetingId }
            });
          }
          currentRoundMeetings.push({
            roomId: room.roomId,
            meetingId,
            accessToken: buildVideoAccessToken({
              roomId: room.roomId,
              meetingId,
              userId: activeParticipantSession?.userId ?? viewer.user.id ?? null,
              userEmail:
                activeParticipantSession?.guestEmail ??
                viewer.user.email ??
                activeParticipantSession?.displayName ??
                null
            })
          });
        }
      }
    }

    let assignment: {
      roundNumber: number;
      roomId: string;
      meetingId: string | null;
      isBreak: boolean;
    } | null = null;
    let activeRound: Prisma.PlanRoundGetPayload<{
      include: {
        rooms: {
          include: {
            members: {
              include: {
                participantSession: {
                  select: {
                    id: true;
                  };
                };
              };
            };
          };
        };
      };
    }> | null = null;

    if (status === "active" && currentSegment?.type === "DISCUSSION" && activeParticipantSession) {
      const roomMember = await prisma.planRoomMember.findFirst({
        where: {
          participantSessionId: activeParticipantSession.id,
          planRoom: {
            planId: plan.id,
            planRound: {
              roundNumber: currentRound
            }
          }
        },
        select: {
          planRoom: {
            select: {
              roomId: true,
              meetingId: true
            }
          }
        }
      });

      assignment = roomMember
        ? {
            roundNumber: currentRound,
            roomId: roomMember.planRoom.roomId,
            meetingId: roomMember.planRoom.meetingId ?? null,
            isBreak: false
          }
        : {
            roundNumber: currentRound,
            roomId: "",
            meetingId: null,
            isBreak: true
      };
    }

    if (status === "active" && currentSegment?.type === "DISCUSSION") {
      activeRound = await prisma.planRound.findUnique({
        where: {
          planId_roundNumber: {
            planId: plan.id,
            roundNumber: currentRound
          }
        },
        include: {
          rooms: {
            include: {
              members: {
                include: {
                  participantSession: {
                    select: {
                      id: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    if (status === "active" && currentSegment?.type === "DISCUSSION" && activeRound) {
      const assignedSessionIds = new Set(
        activeRound.rooms.flatMap((room) =>
          room.members.map((member) => member.participantSession.id)
        )
      );
      const waitingCount = await prisma.planParticipantSession.count({
        where: {
          planId: plan.id,
          status: "APPROVED",
          id: { notIn: Array.from(assignedSessionIds) }
        }
      });
      const roomSize =
        roundBlocks[currentRound - 1]?.roundMaxParticipants ?? plan.maxParticipantsPerRoom;
      const minParticipantsToStart = Math.max(
        2,
        Math.min(plan.lateJoinMinParticipants ?? 3, roomSize)
      );
      waitingRoom = {
        waitingCount,
        minParticipantsToStart,
        roomSize,
        participantsNeeded: Math.max(0, minParticipantsToStart - waitingCount),
        participantWaiting: Boolean(
          activeParticipantSession && !assignedSessionIds.has(activeParticipantSession.id)
        )
      };
    }

    return NextResponse.json({
      serverNow: now.toISOString(),
      status,
      currentRound,
      segmentType: currentSegment?.type ?? "DISCUSSION",
      meditationIndex: currentSegment?.meditationIndex ?? null,
      roundAfter: currentSegment?.roundAfter ?? null,
      segmentStartsAt: currentSegment?.startAtMs
        ? new Date(currentSegment.startAtMs).toISOString()
        : null,
      segmentEndsAt: currentSegment?.endAtMs
        ? new Date(currentSegment.endAtMs).toISOString()
        : null,
      admission: {
        mode: admission.mode,
        status: admission.status,
        opensAt: admission.opensAt?.toISOString() ?? null,
        closesAt: admission.closesAt?.toISOString() ?? null
      },
      waitingRoom,
      currentRoundMeetings: includeMeetings ? currentRoundMeetings : undefined,
      assignment
    });
  }

  if (status === "active" && currentSegment?.type === "DISCUSSION") {
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

        currentRoundMeetings.push({
          roomId,
          meetingId: meeting.id,
          accessToken: buildVideoAccessToken({
            roomId,
            meetingId: meeting.id,
            userId: viewer.user.id,
            userEmail: viewer.user.email
          })
        });
      }
    }
  }

  let assignment: {
    roundNumber: number;
    roomId: string;
    meetingId: string | null;
    isBreak: boolean;
  } | null = null;

  if (status === "active" && currentSegment?.type === "DISCUSSION") {
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
    segmentType: currentSegment?.type ?? "DISCUSSION",
    meditationIndex: currentSegment?.meditationIndex ?? null,
    roundAfter: currentSegment?.roundAfter ?? null,
    segmentStartsAt: currentSegment?.startAtMs
      ? new Date(currentSegment.startAtMs).toISOString()
      : null,
    segmentEndsAt: currentSegment?.endAtMs
      ? new Date(currentSegment.endAtMs).toISOString()
      : null,
    admission: {
      mode: admission.mode,
      status: admission.status,
      opensAt: admission.opensAt?.toISOString() ?? null,
      closesAt: admission.closesAt?.toISOString() ?? null
    },
    waitingRoom,
    currentRoundMeetings: includeMeetings ? currentRoundMeetings : undefined,
    assignment
  });
}
