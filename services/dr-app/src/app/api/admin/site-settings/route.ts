import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getSiteSetting, setSiteSetting } from "@/lib/siteSettings";

const schema = z.object({
  analyticsSnippet: z.string().max(20000).optional().nullable(),
  analyticsEnabled: z.boolean().optional()
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [snippet, enabled] = await Promise.all([
    getSiteSetting("analyticsSnippet"),
    getSiteSetting("analyticsEnabled")
  ]);

  return NextResponse.json({
    analyticsSnippet: snippet ?? "",
    analyticsEnabled: enabled === "true"
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const snippet = parsed.data.analyticsSnippet ?? "";
  const enabled = parsed.data.analyticsEnabled ?? false;

  await Promise.all([
    setSiteSetting("analyticsSnippet", snippet),
    setSiteSetting("analyticsEnabled", enabled ? "true" : "false")
  ]);

  return NextResponse.json({ ok: true });
}
