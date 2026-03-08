import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

export async function POST(request: Request) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";

  if (workerId) {
    await prisma.remoteWorker.updateMany({
      where: {
        id: workerId,
        userId: payload.uid
      },
      data: {
        status: "RUNNING",
        lastSeenAt: new Date(),
        browserInfo: typeof body?.browser === "string" ? body.browser.slice(0, 1200) : undefined,
        capabilitiesJson:
          body && typeof body === "object"
            ? JSON.stringify({
                webgpu: body.webgpu ?? null,
                cores: body.cores ?? null,
                memoryGb: body.memoryGb ?? null,
                visibility: body.visibility ?? null
              })
            : undefined
      }
    });
  }

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    worker: {
      id: payload.uid,
      email: payload.email
    },
    workerId: workerId || null,
    received: body && typeof body === "object" ? body : null
  });
}
