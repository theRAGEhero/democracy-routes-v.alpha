import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";
import { normalizeBlockType } from "@/lib/blockType";
import { normalizeMatchingMode } from "@/lib/matchingMode";
import { getFlowAdmissionState } from "@/lib/flowRuntime";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const guestName = String(body?.guestName || "").trim();
  const guestEmail = String(body?.guestEmail || "").trim().toLowerCase() || null;

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: true,
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
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  if (!plan.isPublic) {
    return NextResponse.json({ error: "Flow is not public" }, { status: 403 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = normalizeBlockType(block.type) as PlanBlockType | null;
      if (!type) return acc;
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
  const admission = getFlowAdmissionState({
    admissionMode: plan.admissionMode,
    joinOpensAt: plan.joinOpensAt,
    joinClosesAt: plan.joinClosesAt,
    now: new Date(),
    flowEndsAtMs: schedule.totalEndMs
  });
  if (admission.status === "upcoming") {
    return NextResponse.json(
      {
        error: "Flow is not open for joining yet.",
        admission: {
          status: admission.status,
          opensAt: admission.opensAt?.toISOString() ?? null,
          closesAt: admission.closesAt?.toISOString() ?? null
        }
      },
      { status: 400 }
    );
  }
  if (admission.status === "closed") {
    return NextResponse.json(
      {
        error: "Flow is closed to new participants.",
        admission: {
          status: admission.status,
          opensAt: admission.opensAt?.toISOString() ?? null,
          closesAt: admission.closesAt?.toISOString() ?? null
        }
      },
      { status: 400 }
    );
  }

  const isRoomBased = plan.runtimeVersion === "ROOM_BASED";
  const requiresMembership = !isRoomBased && Boolean(plan.dataspaceId);

  if (session?.user) {
    if (requiresMembership && plan.dataspaceId) {
      const dataspaceMembership = await prisma.dataspaceMember.findUnique({
        where: {
          dataspaceId_userId: {
            dataspaceId: plan.dataspaceId,
            userId: session.user.id
          }
        }
      });

      if (!dataspaceMembership) {
        return NextResponse.json({ error: "Not a dataspace member" }, { status: 403 });
      }
    }

    const existingParticipant = await prisma.planParticipant.findUnique({
      where: {
        planId_userId: {
          planId: plan.id,
          userId: session.user.id
        }
      }
    });

    const existingSession = await prisma.planParticipantSession.findUnique({
      where: {
        planId_userId: {
          planId: plan.id,
          userId: session.user.id
        }
      }
    });

    if (existingParticipant || existingSession) {
      return NextResponse.json({
        status: existingParticipant?.status ?? existingSession?.status ?? "APPROVED",
        guestToken: null
      });
    }

    if (plan.runtimeVersion === "LEGACY_PAIR") {
      const fixedParticipants = await prisma.planPair.findFirst({
        where: {
          planRound: { planId: plan.id },
          OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
        },
        select: { id: true }
      });

      if (fixedParticipants) {
        return NextResponse.json({ status: "APPROVED", guestToken: null });
      }
    }

    const participantCount =
      plan.runtimeVersion === "ROOM_BASED"
        ? await prisma.planParticipantSession.count({
            where: {
              planId: plan.id,
              status: "APPROVED"
            }
          })
        : await prisma.planParticipant.count({
            where: {
              planId: plan.id,
              status: "APPROVED"
            }
          });

    if (plan.capacity && participantCount >= plan.capacity) {
      return NextResponse.json({ error: "Flow is full" }, { status: 400 });
    }

    const status = plan.requiresApproval ? "PENDING" : "APPROVED";

    await prisma.$transaction([
      prisma.planParticipant.upsert({
        where: {
          planId_userId: {
            planId: plan.id,
            userId: session.user.id
          }
        },
        update: { status },
        create: {
          planId: plan.id,
          userId: session.user.id,
          status
        }
      }),
      prisma.planParticipantSession.upsert({
        where: {
          planId_userId: {
            planId: plan.id,
            userId: session.user.id
          }
        },
        update: {
          status,
          displayName: session.user.email ?? "Participant",
          isRegistered: true,
          lastSeenAt: new Date()
        },
        create: {
          planId: plan.id,
          userId: session.user.id,
          displayName: session.user.email ?? "Participant",
          isRegistered: true,
          status,
          lastSeenAt: new Date()
        }
      })
    ]);

    return NextResponse.json({ status, guestToken: null });
  }

  if (requiresMembership) {
    return NextResponse.json(
      { error: "Guest joining is not available for this flow." },
      { status: 403 }
    );
  }

  if (!isRoomBased) {
    return NextResponse.json(
      { error: "Guest joining is supported only for room-based public flows." },
      { status: 403 }
    );
  }

  if (!guestName) {
    return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
  }

  const approvedCount = await prisma.planParticipantSession.count({
    where: {
      planId: plan.id,
      status: "APPROVED"
    }
  });

  if (plan.capacity && approvedCount >= plan.capacity) {
    return NextResponse.json({ error: "Flow is full" }, { status: 400 });
  }

  const status = plan.requiresApproval ? "PENDING" : "APPROVED";
  const guestToken = crypto.randomBytes(24).toString("base64url");

  await prisma.planParticipantSession.create({
    data: {
      planId: plan.id,
      guestToken,
      guestName,
      guestEmail,
      displayName: guestName,
      isRegistered: false,
      status,
      lastSeenAt: new Date()
    }
  });

  return NextResponse.json({ status, guestToken });
}
