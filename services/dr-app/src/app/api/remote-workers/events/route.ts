import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

export async function POST(request: Request) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);
  if (!payload?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const severity =
    body?.severity === "error" || body?.severity === "warning" || body?.severity === "info"
      ? body.severity
      : "info";
  const eventPayload =
    body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload
      : {};

  if (!type) {
    return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  }

  const [worker, job] = await Promise.all([
    workerId
      ? prisma.remoteWorker.findFirst({
          where: { id: workerId, userId: payload.uid },
          select: { id: true, userId: true }
        })
      : Promise.resolve(null),
    jobId
      ? prisma.remoteWorkerJob.findUnique({
          where: { id: jobId },
          select: { id: true, sourceId: true, provider: true }
        })
      : Promise.resolve(null)
  ]);

  if (workerId && !worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  await postEventHubEvent({
    source: "dr-remote-worker",
    type,
    severity,
    actorId: payload.uid,
    meetingId: job?.sourceId ?? null,
    message: message || null,
    payload: {
      workerId: worker?.id ?? workerId,
      jobId: job?.id ?? jobId,
      provider: job?.provider ?? null,
      ...eventPayload
    }
  });

  return NextResponse.json({ ok: true });
}
