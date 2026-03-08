import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";
  const errorMessage =
    typeof body?.error === "string" && body.error.trim()
      ? body.error.trim().slice(0, 1200)
      : "Remote worker job failed";

  if (!workerId) {
    return NextResponse.json({ error: "workerId is required" }, { status: 400 });
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

  const job = await prisma.remoteWorkerJob.findFirst({
    where: {
      id: params.id,
      claimedByWorkerId: workerId
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const failedJob = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.remoteWorkerJob.update({
      where: { id: params.id },
      data: {
        status: "FAILED",
        error: errorMessage
      }
    });

    await tx.remoteWorker.update({
      where: { id: workerId },
      data: {
        lastSeenAt: new Date(),
        status: "READY"
      }
    });

    return updatedJob;
  });

  await postEventHubEvent({
    source: "dr-app",
    type: "remote_worker_job_failed",
    severity: "error",
    message: "Remote worker job failed",
    actorId: payload.uid,
    payload: {
      workerId,
      jobId: params.id,
      error: errorMessage
    }
  });

  return NextResponse.json({ ok: true, job: failedJob });
}
