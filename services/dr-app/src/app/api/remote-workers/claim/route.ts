import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";
import { canStartProviderWork } from "@/lib/transcriptionLimits";
import { parseAutoRemoteAssignment } from "@/lib/autoRemoteAssignment";

function parsePayloadJson(payloadJson: string | null) {
  try {
    return JSON.parse(payloadJson || "{}") as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export async function POST(request: Request) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";

  if (!workerId) {
    return NextResponse.json({ error: "workerId is required" }, { status: 400 });
  }

  const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
  const staleWorkers = await prisma.remoteWorker.findMany({
    where: {
      status: "RUNNING",
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleThreshold } }]
    },
    select: { id: true }
  });
  if (staleWorkers.length > 0) {
    const staleClaimedJobs = await prisma.remoteWorkerJob.findMany({
      where: {
        status: "CLAIMED",
        claimedByWorkerId: { in: staleWorkers.map((item) => item.id) }
      },
      select: {
        id: true,
        sourceType: true,
        payloadJson: true
      }
    });
    await prisma.remoteWorkerJob.updateMany({
      where: {
        status: "CLAIMED",
        claimedByWorkerId: { in: staleWorkers.map((item) => item.id) }
      },
      data: {
        status: "PENDING",
        claimedByWorkerId: null,
        claimedAt: null
      }
    });
    const staleUploadJobIds = staleClaimedJobs
      .filter((job) => job.sourceType === "MEETING_UPLOAD")
      .map((job) => {
        const parsed = parsePayloadJson(job.payloadJson);
        return typeof parsed.transcriptionJobId === "string" ? parsed.transcriptionJobId : null;
      })
      .filter((value): value is string => Boolean(value));
    if (staleUploadJobIds.length > 0) {
      await prisma.transcriptionJob.updateMany({
        where: { id: { in: staleUploadJobIds } },
        data: {
          status: "PENDING",
          lastError: "Waiting for remote worker"
        }
      });
    }
    await prisma.remoteWorker.updateMany({
      where: { id: { in: staleWorkers.map((item) => item.id) } },
      data: { status: "READY" }
    });
  }

  const worker = await prisma.remoteWorker.findFirst({
    where: {
      id: workerId,
      userId: payload.uid
    },
    select: { id: true }
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const claimedJob = await prisma.$transaction(async (tx) => {
    const whisperCapacity = await canStartProviderWork("WHISPERREMOTE");
    const autoRemoteCapacity = await canStartProviderWork("AUTOREMOTE");
    const jobs = await tx.remoteWorkerJob.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        chunkIndex: true,
        status: true,
        provider: true,
        model: true,
        language: true,
        payloadJson: true,
        audioUrl: true,
        createdAt: true
      }
    });

    const job =
      jobs.find((candidate) => {
        if (candidate.provider === "WHISPERREMOTE") return whisperCapacity.allowed;
        if (candidate.provider === "AUTOREMOTE") {
          if (!autoRemoteCapacity.allowed) return false;
          const assignment = parseAutoRemoteAssignment(candidate.payloadJson);
          if (!assignment) return false;
          return assignment.assignedUserId === payload.uid;
        }
        return true;
      }) || null;

    if (!job) {
      return null;
    }

    const updated = await tx.remoteWorkerJob.updateMany({
      where: {
        id: job.id,
        status: "PENDING"
      },
      data: {
        status: "CLAIMED",
        claimedByWorkerId: workerId,
        claimedAt: new Date(),
        attempts: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      return null;
    }

    if (job.sourceType === "MEETING_UPLOAD") {
      const parsed = parsePayloadJson(job.payloadJson);
      const transcriptionJobId =
        typeof parsed.transcriptionJobId === "string" ? parsed.transcriptionJobId : null;
      if (transcriptionJobId) {
        await tx.transcriptionJob.update({
          where: { id: transcriptionJobId },
          data: {
            status: "RUNNING",
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
            lastError: null
          }
        });
      }
    }

    await tx.remoteWorker.update({
      where: { id: workerId },
      data: {
        lastSeenAt: new Date(),
        lastClaimAt: new Date(),
        status: "RUNNING"
      }
    });

    return tx.remoteWorkerJob.findUnique({
      where: { id: job.id },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        chunkIndex: true,
        status: true,
        provider: true,
        model: true,
        language: true,
        payloadJson: true,
        audioUrl: true,
        createdAt: true
      }
    });
  });

  if (claimedJob) {
    await postEventHubEvent({
      source: "dr-app",
      type: "remote_worker_job_claimed",
      severity: "info",
      message: "Remote worker claimed a job",
      actorId: payload.uid,
      payload: {
        workerId,
        jobId: claimedJob.id,
        sourceType: claimedJob.sourceType
      }
    });
  }

  return NextResponse.json({
    ok: true,
    worker: {
      id: payload.uid,
      email: payload.email
    },
    job: claimedJob
      ? {
          ...claimedJob,
          audioUrl:
            claimedJob.sourceType === "MEETING_RECORDING" || claimedJob.sourceType === "MEETING_UPLOAD"
              ? `/api/remote-workers/jobs/${claimedJob.id}/audio?workerId=${encodeURIComponent(workerId)}`
              : claimedJob.audioUrl
        }
      : null,
    message: claimedJob ? "Job claimed." : "No jobs available."
  });
}
