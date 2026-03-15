import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";

const summaryResponseSchema = z.object({
  summaryMarkdown: z.string().trim().min(1).max(12000),
  generatedTitle: z.string().trim().min(1).max(160).optional().nullable(),
  generatedDescription: z.string().trim().max(500).optional().nullable()
});

function computeTranscriptHash(transcriptText: string, transcriptJson: string | null) {
  return crypto
    .createHash("sha256")
    .update(transcriptText || "")
    .update("\n---\n")
    .update(transcriptJson || "")
    .digest("hex");
}

function shouldAutofillTitle(title: string | null | undefined) {
  const value = String(title || "").trim();
  return !value || /^untitled meeting$/i.test(value) || /^meeting$/i.test(value);
}

function shouldAutofillDescription(description: string | null | undefined) {
  return !String(description || "").trim();
}

function buildPrompt(args: {
  title: string;
  description: string | null;
  provider: string;
  language: string;
  transcriptText: string;
}) {
  return (
    `You summarize Democracy Routes meeting transcripts.\n\n` +
    `Return ONLY valid JSON with keys: summaryMarkdown, generatedTitle, generatedDescription.\n` +
    `summaryMarkdown must be concise markdown, structured with short sections and bullets.\n` +
    `generatedTitle must be a strong meeting title only if the current title is missing or placeholder.\n` +
    `generatedDescription must be a concise 1-2 sentence meeting description only if the current description is missing.\n` +
    `Do not include markdown fences.\n\n` +
    `Current meeting title: ${args.title}\n` +
    `Current meeting description: ${args.description || "(none)"}\n` +
    `Transcription provider: ${args.provider}\n` +
    `Language: ${args.language}\n\n` +
    `Transcript:\n${args.transcriptText.slice(0, 40000)}`
  );
}

function extractJson(text: string) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch {}
  const first = raw.indexOf("{");
  if (first === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = first; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(first, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function runMeetingSummaryAi(args: {
  title: string;
  description: string | null;
  provider: string;
  language: string;
  transcriptText: string;
}) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const model = String(process.env.GEMINI_SUMMARY_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(args) }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 3072,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "AI summary request failed");
  }

  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const extracted = extractJson(rawText);
  const parsed = summaryResponseSchema.safeParse(extracted);
  if (!parsed.success) {
    throw new Error("Meeting summary model did not return valid JSON");
  }

  return {
    model,
    raw: extracted,
    ...parsed.data
  };
}

export async function ensureMeetingAiSummary(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      aiSummary: true
    }
  });

  if (!meeting || !meeting.transcript?.transcriptText?.trim()) {
    return { ok: false as const, reason: "missing_transcript" as const };
  }

  if (meeting.transcriptionProvider === "DEEPGRAMLIVE") {
    return { ok: false as const, reason: "live_provider_excluded" as const };
  }

  const transcriptHash = computeTranscriptHash(
    meeting.transcript.transcriptText,
    meeting.transcript.transcriptJson ?? null
  );

  if (
    meeting.aiSummary?.status === "DONE" &&
    meeting.aiSummary.sourceTranscriptHash === transcriptHash &&
    meeting.aiSummary.summaryMarkdown
  ) {
    return { ok: true as const, reused: true };
  }

  await prisma.meetingAiSummary.upsert({
    where: { meetingId },
    update: {
      status: "RUNNING",
      error: null,
      sourceTranscriptHash: transcriptHash
    },
    create: {
      meetingId,
      status: "RUNNING",
      sourceTranscriptHash: transcriptHash
    }
  });

  await postEventHubEvent({
    source: "dr-app",
    type: "meeting_ai_summary_started",
    severity: "info",
    message: "Meeting AI summary started",
    meetingId,
    payload: {
      provider: meeting.transcriptionProvider,
      transcriptHash
    }
  }).catch(() => null);

  try {
    const ai = await runMeetingSummaryAi({
      title: meeting.title,
      description: meeting.description,
      provider: meeting.transcriptionProvider,
      language: meeting.language,
      transcriptText: meeting.transcript.transcriptText
    });

    const nextTitle = shouldAutofillTitle(meeting.title) ? ai.generatedTitle?.trim() || null : null;
    const nextDescription =
      shouldAutofillDescription(meeting.description) ? ai.generatedDescription?.trim() || null : null;

    await prisma.$transaction(async (tx) => {
      await tx.meetingAiSummary.upsert({
        where: { meetingId },
        update: {
          status: "DONE",
          providerModel: ai.model,
          summaryMarkdown: ai.summaryMarkdown,
          summaryJson: JSON.stringify(ai.raw),
          generatedTitle: ai.generatedTitle?.trim() || null,
          generatedDescription: ai.generatedDescription?.trim() || null,
          sourceTranscriptHash: transcriptHash,
          error: null
        },
        create: {
          meetingId,
          status: "DONE",
          providerModel: ai.model,
          summaryMarkdown: ai.summaryMarkdown,
          summaryJson: JSON.stringify(ai.raw),
          generatedTitle: ai.generatedTitle?.trim() || null,
          generatedDescription: ai.generatedDescription?.trim() || null,
          sourceTranscriptHash: transcriptHash,
          error: null
        }
      });

      if (nextTitle || nextDescription) {
        await tx.meeting.update({
          where: { id: meetingId },
          data: {
            ...(nextTitle ? { title: nextTitle } : {}),
            ...(nextDescription ? { description: nextDescription } : {})
          }
        });
      }
    });

    await postEventHubEvent({
      source: "dr-app",
      type: "meeting_ai_summary_succeeded",
      severity: "info",
      message: "Meeting AI summary completed",
      meetingId,
      payload: {
        model: ai.model,
        transcriptHash,
        autofilledTitle: Boolean(nextTitle),
        autofilledDescription: Boolean(nextDescription)
      }
    }).catch(() => null);

    return { ok: true as const, reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting AI summary failed";
    await prisma.meetingAiSummary.upsert({
      where: { meetingId },
      update: {
        status: "FAILED",
        error: message,
        sourceTranscriptHash: transcriptHash
      },
      create: {
        meetingId,
        status: "FAILED",
        error: message,
        sourceTranscriptHash: transcriptHash
      }
    });
    await postEventHubEvent({
      source: "dr-app",
      type: "meeting_ai_summary_failed",
      severity: "error",
      message: "Meeting AI summary failed",
      meetingId,
      payload: {
        transcriptHash,
        error: message
      }
    }).catch(() => null);
    return { ok: false as const, reason: "generation_failed" as const, error: message };
  }
}
