import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobs = await prisma.transcriptionJob.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      meeting: { select: { id: true, title: true } },
      plan: { select: { id: true, title: true } },
      user: { select: { email: true } }
    }
  });

  const grouped = new Map<
    string,
    {
      latest: (typeof jobs)[number];
      attempts: number;
    }
  >();

  for (const job of jobs) {
    const key =
      job.kind === "MEETING" && job.meetingId
        ? `MEETING:${job.meetingId}`
        : job.kind === "MEDITATION" && job.planId
          ? `MEDITATION:${job.planId}:${job.meditationIndex ?? "unknown"}`
          : `${job.kind}:${job.id}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { latest: job, attempts: job.attempts });
    } else {
      existing.attempts += job.attempts;
      if (job.updatedAt > existing.latest.updatedAt) {
        existing.latest = job;
      }
    }
  }

  return NextResponse.json({
    jobs: Array.from(grouped.values())
      .sort((a, b) => b.latest.updatedAt.getTime() - a.latest.updatedAt.getTime())
      .map((entry) => ({
        id: entry.latest.id,
        kind: entry.latest.kind,
        status: entry.latest.status,
        provider: entry.latest.provider,
        roundId: entry.latest.roundId,
        meditationIndex: entry.latest.meditationIndex,
        attempts: entry.attempts,
        lastError: entry.latest.lastError,
        lastAttemptAt: entry.latest.lastAttemptAt ? entry.latest.lastAttemptAt.toISOString() : null,
        updatedAt: entry.latest.updatedAt.toISOString(),
        meeting: entry.latest.meeting,
        plan: entry.latest.plan,
        userEmail: entry.latest.user?.email ?? null
      }))
  });
}
