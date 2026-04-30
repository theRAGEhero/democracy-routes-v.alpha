import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";
import { guessMediaContentType } from "@/lib/meetingMediaUploads";

function getDrVideoBase() {
  return (process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

function parsePayload(payloadJson: string | null) {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = new URL(request.url).searchParams.get("workerId")?.trim() || "";
  if (!workerId) {
    return NextResponse.json({ error: "workerId is required" }, { status: 400 });
  }

  const job = await prisma.remoteWorkerJob.findFirst({
    where: {
      id: params.id,
      claimedByWorkerId: workerId,
      claimedByWorker: {
        userId: payload.uid
      }
    },
    select: {
      id: true,
      sourceType: true,
      payloadJson: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const parsed = parsePayload(job.payloadJson);
  if (job.sourceType === "MEETING_UPLOAD") {
    const transcriptionJobId =
      typeof parsed?.transcriptionJobId === "string" ? parsed.transcriptionJobId : "";
    if (!transcriptionJobId) {
      return NextResponse.json({ error: "Upload payload is incomplete" }, { status: 500 });
    }
    const transcriptionJob = await prisma.transcriptionJob.findUnique({
      where: { id: transcriptionJobId },
      select: { audioPath: true }
    });
    if (!transcriptionJob?.audioPath) {
      return NextResponse.json({ error: "Uploaded audio not found" }, { status: 404 });
    }
    const buffer = Buffer.from(await fs.readFile(transcriptionJob.audioPath));
    const filename = transcriptionJob.audioPath.split("/").pop() || "upload.webm";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": guessMediaContentType(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store"
      }
    });
  }

  if (job.sourceType !== "MEETING_RECORDING") {
    return NextResponse.json({ error: "No audio is available for this job type" }, { status: 400 });
  }

  const roomId = typeof parsed?.roomId === "string" ? parsed.roomId : "";
  const sessionId = typeof parsed?.sessionId === "string" ? parsed.sessionId : "";
  if (!roomId || !sessionId) {
    return NextResponse.json({ error: "Recording payload is incomplete" }, { status: 500 });
  }

  const response = await fetch(
    `${getDrVideoBase()}/api/recordings/file?roomId=${encodeURIComponent(roomId)}&sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  ).catch(() => null);

  if (!response || !response.ok) {
    return NextResponse.json({ error: "Unable to load recording audio" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "audio/webm";
  const buffer = Buffer.from(await response.arrayBuffer());

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store"
    }
  });
}
