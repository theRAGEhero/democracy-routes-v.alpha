import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await prisma.remoteWorkerJob.create({
    data: {
      sourceType: "DEMO",
      sourceId: `demo-${Date.now()}`,
      status: "PENDING",
      provider: "BROWSER",
      model: "placeholder",
      language: "en",
      payloadJson: JSON.stringify({
        title: "Demo worker job",
        instructions: "This is a placeholder claimed by the browser worker while the real chunk pipeline is being built."
      })
    },
    select: {
      id: true,
      sourceType: true,
      createdAt: true
    }
  });

  await postEventHubEvent({
    source: "dr-app",
    type: "remote_worker_demo_job_created",
    severity: "info",
    message: "Demo remote worker job created",
    actorId: session.user.id,
    payload: { jobId: job.id }
  });

  return NextResponse.json({ ok: true, job });
}
