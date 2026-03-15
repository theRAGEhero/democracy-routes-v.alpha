import { NextResponse } from "next/server";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractRemoteWorkerToken, verifyRemoteWorkerToken } from "@/lib/remoteWorkerToken";

export async function GET(request: Request) {
  const token = extractRemoteWorkerToken(request);
  const payload = verifyRemoteWorkerToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await postEventHubEvent({
    source: "dr-app",
    type: "remote_worker_bootstrap",
    severity: "info",
    message: "Remote worker bootstrap completed",
    actorId: payload.uid,
    payload: { email: payload.email }
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: payload.uid,
      email: payload.email
    },
    capabilities: {
      workerMode: "browser",
      realJobsEnabled: true
    }
  });
}
