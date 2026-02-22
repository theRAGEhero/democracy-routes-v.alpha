import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const baseUrl = process.env.LIVE_BRIDGE_BASE_URL;
  const wsUrl = process.env.LIVE_BRIDGE_WS_URL;
  const apiKey = process.env.LIVE_BRIDGE_API_KEY;
  if (!baseUrl || !wsUrl || !apiKey) {
    return NextResponse.json({ error: "Live bridge not configured" }, { status: 500 });
  }

  const base = baseUrl.replace(/\/$/, "");
  const rootBase = base.replace(/\/recSyncBridge$/, "");
  const candidateUrls = Array.from(
    new Set([
      `${base}/fileName?room=${encodeURIComponent(roomId)}`,
      `${rootBase}/recSyncBridge/fileName?room=${encodeURIComponent(roomId)}`,
      `${rootBase}/fileName?room=${encodeURIComponent(roomId)}`
    ])
  );

  let payload: any = null;
  let lastStatus = 500;
  let lastError: string | null = null;

  for (const url of candidateUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    lastStatus = response.status;
    payload = await response.json().catch(() => null);
    if (response.ok) {
      break;
    }
    lastError = payload?.error ?? `HTTP ${response.status}`;
  }

  if (!payload || !payload?.fileName) {
    return NextResponse.json(
      { error: lastError ?? "Unable to fetch live session" },
      { status: lastStatus }
    );
  }

  const fileName = payload?.fileName;

  const socketUrl = `${wsUrl}?fileName=${encodeURIComponent(fileName)}&onlyNonEmpty=1&apiKey=${encodeURIComponent(apiKey)}`;

  return NextResponse.json({ fileName, wsUrl: socketUrl });
}
