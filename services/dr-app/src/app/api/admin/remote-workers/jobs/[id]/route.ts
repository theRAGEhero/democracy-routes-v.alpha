import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.remoteWorkerJob.findUnique({
    where: { id: params.id },
    include: {
      claimedByWorker: {
        include: {
          user: { select: { email: true } }
        }
      },
      results: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          worker: {
            include: {
              user: { select: { email: true } }
            }
          }
        }
      }
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const payloadJson = job.payloadJson ? JSON.parse(job.payloadJson) : null;
  const recentEvents = process.env.EVENT_HUB_BASE_URL && process.env.EVENT_HUB_API_KEY
    ? await fetch(
        `${String(process.env.EVENT_HUB_BASE_URL).replace(/\/$/, "")}/api/events?limit=20&source=dr-remote-worker&q=${encodeURIComponent(job.id)}`,
        {
          headers: {
            "x-api-key": String(process.env.EVENT_HUB_API_KEY)
          },
          cache: "no-store"
        }
      )
        .then((res) => res.json().catch(() => []))
        .catch(() => [])
    : [];

  return NextResponse.json({
    job: {
      ...job,
      payloadJson,
      results: job.results.map((result) => ({
        ...result,
        transcriptPreview: result.transcriptText ? result.transcriptText.slice(0, 1200) : ""
      }))
    },
    recentEvents: Array.isArray(recentEvents) ? recentEvents : []
  });
}
