import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

function safeStringify(value: unknown) {
  try {
    if (value == null) return null;
    const text = JSON.stringify(value);
    return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) : "";
  const capabilitiesJson = safeStringify(body?.capabilities);
  const browserInfo = typeof body?.browserInfo === "string" ? body.browserInfo.slice(0, 1200) : null;

  const worker = await prisma.remoteWorker.create({
    data: {
      userId: payload.uid,
      label: label || null,
      status: "READY",
      capabilitiesJson,
      browserInfo,
      lastSeenAt: new Date()
    },
    select: {
      id: true,
      label: true,
      status: true,
      createdAt: true
    }
  });

  await postEventHubEvent({
    source: "dr-app",
    type: "remote_worker_registered",
    severity: "info",
    message: "Remote worker registered",
    actorId: payload.uid,
    payload: {
      workerId: worker.id,
      label: worker.label
    }
  });

  return NextResponse.json({ ok: true, worker });
}
