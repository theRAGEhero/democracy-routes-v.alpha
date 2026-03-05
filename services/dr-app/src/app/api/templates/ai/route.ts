import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";

const blockSchema = z.object({
  type: z.enum(["PAIRING", "PAUSE", "PROMPT", "NOTES", "RECORD", "FORM", "EMBED", "MATCHING"]),
  durationSeconds: z.number().int().min(30).max(7200),
  roundMaxParticipants: z.number().int().min(2).max(12).optional().nullable(),
  formQuestion: z.string().trim().max(240).optional().nullable(),
  formChoices: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(120)
      })
    )
    .optional()
    .nullable(),
  posterId: z.string().optional().nullable(),
  embedUrl: z.string().trim().max(500).optional().nullable(),
  matchingMode: z.enum(["polar", "anti"]).optional().nullable(),
  meditationAnimationId: z.string().optional().nullable(),
  meditationAudioUrl: z.string().optional().nullable()
});

const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  blocks: z.array(blockSchema).min(1).max(24)
});

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000)
});

function buildSystemPrompt(userPrompt: string) {
  return `You are an assistant that outputs a single JSON object describing a Democracy Routes template.\n\n` +
    `Available modules and fields:\n` +
    `- PAIRING: durationSeconds (int, seconds), roundMaxParticipants (2-12)\n` +
    `- PAUSE: durationSeconds, meditationAnimationId (string or null), meditationAudioUrl (string or null)\n` +
    `- PROMPT: durationSeconds, posterId (string or null; if unknown, leave null)\n` +
    `- NOTES: durationSeconds\n` +
    `- RECORD: durationSeconds\n` +
    `- FORM: durationSeconds, formQuestion (string), formChoices (array of {key, label})\n` +
    `- EMBED: durationSeconds, embedUrl (string)\n` +
    `- MATCHING: durationSeconds, matchingMode ("polar" or "anti")\n\n` +
    `Output requirements:\n` +
    `- Output ONLY valid JSON with keys: name, description, isPublic, blocks.\n` +
    `- durationSeconds must be between 30 and 7200.\n` +
    `- blocks must be a single linear sequence, max 24 blocks.\n` +
    `- Do not include markdown or explanations.\n\n` +
    `User request: ${userPrompt}`;
}

function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildSystemPrompt(parsed.data.prompt) }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Gemini request failed", details: errorPayload },
      { status: response.status }
    );
  }

  const payload = await response.json();
  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const json = extractJson(rawText);
  if (!json) {
    return NextResponse.json(
      { error: "Model did not return valid JSON.", raw: rawText },
      { status: 400 }
    );
  }

  const validated = templateSchema.safeParse(json);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.flatten(), raw: rawText },
      { status: 400 }
    );
  }

  return NextResponse.json({ template: validated.data, raw: rawText });
}
