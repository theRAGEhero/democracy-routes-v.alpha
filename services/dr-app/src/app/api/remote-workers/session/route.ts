import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createRemoteWorkerToken } from "@/lib/remoteWorkerToken";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, payload } = createRemoteWorkerToken({
    id: session.user.id,
    email: session.user.email
  });

  return NextResponse.json({
    token,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    embedUrl: `/remote-worker-app/?token=${encodeURIComponent(token)}`
  });
}
