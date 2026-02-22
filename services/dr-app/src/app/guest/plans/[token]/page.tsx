import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ParticipantViewClient } from "@/app/plans/[id]/ParticipantViewClient";
import { normalizeCallBaseUrl } from "@/lib/callUrl";

export default async function GuestPlanPage({ params }: { params: { token: string } }) {
  const invite = await prisma.planGuestInvite.findUnique({
    where: { token: params.token },
    include: {
      plan: {
        include: {
          dataspace: {
            include: { members: { select: { userId: true } } }
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
      }
    }
  });

  if (!invite || (invite.expiresAt && invite.expiresAt < new Date()) || !invite.plan) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900">Invite not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invite link is invalid or expired.
        </p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-700 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  const plan = invite.plan;
  const userEmail = invite.email;

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
        if (pair.meetingId) {
          meetingByRoom.set(pair.roomId, pair.meetingId);
        }
      });

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
    }
  );

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
        if (pair.meetingId) {
          meetingByRoom.set(pair.roomId, pair.meetingId);
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
    }
  );

  const baseUrl = normalizeCallBaseUrl(process.env.DEMOCRACYROUTES_CALL_BASE_URL || "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Guest invite
          </p>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {plan.title}
          </h1>
          <p className="text-sm text-slate-600">
            You are invited as <span className="font-semibold">{userEmail}</span>.
          </p>
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
          type: block.type as "ROUND" | "MEDITATION" | "POSTER" | "TEXT" | "RECORD" | "FORM",
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
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null,
          poster: block.poster
            ? { id: block.poster.id, title: block.poster.title, content: block.poster.content }
            : null
        }))}
        roundGroups={roundGroups}
        assignments={assignments}
        baseUrl={baseUrl}
        userEmail={userEmail}
        guestToken={invite.token}
      />

      <p className="text-xs text-slate-500">
        Prefer to register?{" "}
        <Link href="/register" className="font-semibold text-slate-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
