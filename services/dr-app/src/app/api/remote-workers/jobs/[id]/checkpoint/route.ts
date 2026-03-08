import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

function parsePayload(text: string | null | undefined) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

  const job = await prisma.remoteWorkerJob.findFirst({
    where: {
      id: params.id,
      claimedByWorkerId: workerId
    },
    select: {
      id: true,
      payloadJson: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const payloadJson = parsePayload(job.payloadJson);
  const checkpoint = {
    chunkIndex: Number.isFinite(Number(body?.chunkIndex)) ? Math.max(0, Math.floor(Number(body.chunkIndex))) : 0,
    chunkStartSec: Number.isFinite(Number(body?.chunkStartSec)) ? Math.max(0, Number(body.chunkStartSec)) : 0,
    chunkEndSec: Number.isFinite(Number(body?.chunkEndSec)) ? Math.max(0, Number(body.chunkEndSec)) : 0,
    transcriptText: typeof body?.transcriptText === "string" ? body.transcriptText.slice(0, 4000) : "",
    transcriptSegments: Array.isArray(body?.transcriptSegments) ? body.transcriptSegments.slice(0, 500) : [],
    updatedAt: new Date().toISOString()
  };

  const checkpoints = Array.isArray(payloadJson?.checkpoints) ? payloadJson.checkpoints : [];
  const nextCheckpoints = [
    ...checkpoints.filter((entry: any) => Number(entry?.chunkIndex) !== checkpoint.chunkIndex),
    checkpoint
  ].sort((a: any, b: any) => Number(a?.chunkIndex || 0) - Number(b?.chunkIndex || 0));

  await prisma.remoteWorkerJob.update({
    where: { id: params.id },
    data: {
      payloadJson: JSON.stringify({
        ...payloadJson,
        checkpoints: nextCheckpoints,
        resumeFromChunkIndex: checkpoint.chunkIndex + 1,
        lastCheckpointAt: checkpoint.updatedAt
      })
    }
  });

  return NextResponse.json({
    ok: true,
    checkpoint: {
      chunkIndex: checkpoint.chunkIndex,
      resumeFromChunkIndex: checkpoint.chunkIndex + 1
    }
  });
}
