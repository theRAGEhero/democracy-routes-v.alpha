import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";
import { extractWords, parseTranscriptJson } from "@/app/api/integrations/workflow/transcription";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const transcript = await prisma.meetingTranscript.findUnique({
    where: { meetingId: params.id },
    select: { transcriptJson: true }
  });

  if (!transcript?.transcriptJson) {
    return NextResponse.json({ error: "Transcription not found" }, { status: 404 });
  }

  try {
    const parsed = parseTranscriptJson(transcript.transcriptJson);
    return NextResponse.json({ words: extractWords(parsed) });
  } catch {
    return NextResponse.json({ error: "Invalid transcription data" }, { status: 500 });
  }
}
