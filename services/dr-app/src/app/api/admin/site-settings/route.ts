import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getSiteSetting, setSiteSetting } from "@/lib/siteSettings";

const schema = z.object({
  analyticsSnippet: z.string().max(20000).optional().nullable(),
  analyticsEnabled: z.boolean().optional(),
  feedbackTranscriptionProvider: z.enum(["NONE", "DEEPGRAM", "VOSK"]).optional(),
  transcriptionLimitDeepgram: z.number().int().min(0).max(100).optional(),
  transcriptionLimitVosk: z.number().int().min(0).max(100).optional(),
  transcriptionLimitWhisperRemote: z.number().int().min(0).max(100).optional()
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [snippet, enabled, feedbackProvider, deepgramLimit, voskLimit, whisperRemoteLimit] = await Promise.all([
    getSiteSetting("analyticsSnippet"),
    getSiteSetting("analyticsEnabled"),
    getSiteSetting("feedbackTranscriptionProvider"),
    getSiteSetting("transcriptionLimitDeepgram"),
    getSiteSetting("transcriptionLimitVosk"),
    getSiteSetting("transcriptionLimitWhisperRemote")
  ]);

  return NextResponse.json({
    analyticsSnippet: snippet ?? "",
    analyticsEnabled: enabled === "true",
    feedbackTranscriptionProvider:
      feedbackProvider === "DEEPGRAM" || feedbackProvider === "VOSK" ? feedbackProvider : "NONE",
    transcriptionLimitDeepgram: Math.max(0, Number(deepgramLimit || 0) || 0),
    transcriptionLimitVosk: Math.max(0, Number(voskLimit || 0) || 0),
    transcriptionLimitWhisperRemote: Math.max(0, Number(whisperRemoteLimit || 0) || 0)
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
  const feedbackProvider = parsed.data.feedbackTranscriptionProvider ?? "NONE";
  const deepgramLimit = parsed.data.transcriptionLimitDeepgram ?? 0;
  const voskLimit = parsed.data.transcriptionLimitVosk ?? 0;
  const whisperRemoteLimit = parsed.data.transcriptionLimitWhisperRemote ?? 0;

  await Promise.all([
    setSiteSetting("analyticsSnippet", snippet),
    setSiteSetting("analyticsEnabled", enabled ? "true" : "false"),
    setSiteSetting("feedbackTranscriptionProvider", feedbackProvider),
    setSiteSetting("transcriptionLimitDeepgram", String(deepgramLimit)),
    setSiteSetting("transcriptionLimitVosk", String(voskLimit)),
    setSiteSetting("transcriptionLimitWhisperRemote", String(whisperRemoteLimit))
  ]);

  return NextResponse.json({ ok: true });
}
