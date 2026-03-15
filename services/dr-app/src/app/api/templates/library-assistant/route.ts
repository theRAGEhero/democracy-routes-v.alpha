import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logger";

const templateSummarySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  authorEmail: z.string().trim().max(200),
  isPublic: z.boolean(),
  totalSeconds: z.number().int().min(0).max(86400),
  types: z.record(z.string(), z.number().int().min(0).max(999))
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  templates: z.array(templateSummarySchema).max(100),
  messages: z.array(messageSchema).max(30).optional().default([])
});

const responseSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(4000),
  recommendations: z
    .array(
      z.object({
        templateId: z.string().min(1).max(64),
        reason: z.string().trim().min(1).max(400)
      })
    )
    .max(6)
    .default([]),
  suggestStartFresh: z.boolean().default(false),
  freshReason: z.string().trim().max(300).nullable().default(null)
});

const MAX_CONTEXT_MESSAGES = 8;
const PRIMARY_TIMEOUT_MS = 20000;
const FALLBACK_TIMEOUT_MS = 30000;

function compactText(value: string, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildPrompt(
  prompt: string,
  templates: Array<z.infer<typeof templateSummarySchema>>,
  messages: Array<z.infer<typeof messageSchema>>,
  options?: { compact?: boolean }
) {
  const compact = Boolean(options?.compact);
  const templateLines = templates
    .slice(0, compact ? 20 : 30)
    .map((template) => {
      const typeSummary = Object.entries(template.types)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}:${count}`)
        .join(", ");
      return `- id=${template.id}; name=${template.name}; public=${template.isPublic}; durationMinutes=${Math.round(
        template.totalSeconds / 60
      )}; description=${compactText(template.description || "none", compact ? 90 : 180)}; blocks=${compactText(
        typeSummary || "none",
        compact ? 60 : 120
      )}; author=${template.authorEmail}`;
    })
    .join("\n");

  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const conversation = recentMessages.length
    ? `Recent conversation:\n${messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => `${message.role.toUpperCase()}: ${compactText(message.content, compact ? 220 : 500)}`)
        .join("\n")}\n\n`
    : "";

  return (
    `You are an AI helper inside the Democracy Routes Template Library.\n` +
    `Your job is to help the user decide whether to reuse an existing template or start fresh.\n\n` +
    `How this platform works:\n` +
    `- "Use this template" starts from an existing template.\n` +
    `- "Structured" opens a form-based builder for direct ordered editing.\n` +
    `- "Modular" opens the drag-and-drop builder.\n` +
    `- The user can also start from scratch if none of the existing templates fit.\n\n` +
    `Output ONLY valid JSON with keys:\n` +
    `- assistantMessage: concise, practical recommendation\n` +
    `- recommendations: array of { templateId, reason }\n` +
    `- suggestStartFresh: boolean\n` +
    `- freshReason: string or null\n\n` +
    `Rules:\n` +
    `- Recommend 0 to 4 templates.\n` +
    `- Prefer existing templates when they are a close fit.\n` +
    `- Suggest starting fresh only when the library clearly does not fit.\n` +
    `- Reasons must be short and specific.\n` +
    `- Keep the assistantMessage compact and direct.\n` +
    `- Never invent template IDs.\n\n` +
    `${conversation}` +
    `Available templates:\n${templateLines}\n\n` +
    `User request: ${prompt}`
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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
  for (let i = first; i < raw.length; i += 1) {
    const char = raw[i];
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
          return JSON.parse(raw.slice(first, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function runModel({
  apiKey,
  model,
  prompt,
  templates,
  messages,
  compact,
  timeoutMs
}: {
  apiKey: string;
  model: string;
  prompt: string;
  templates: Array<z.infer<typeof templateSummarySchema>>;
  messages: Array<z.infer<typeof messageSchema>>;
  compact: boolean;
  timeoutMs: number;
}) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(prompt, templates, messages, { compact }) }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: compact ? 900 : 1400,
          responseMimeType: "application/json"
        }
      })
    },
    timeoutMs
  );

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function POST(request: Request) {
  const requestId = getRequestId(request) || crypto.randomUUID();
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten(), requestId }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logError("template_library_assistant_missing_api_key", new Error("GEMINI_API_KEY is not configured"), {
      requestId,
      userId: session.user.id
    });
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured.", requestId }, { status: 500 });
  }

  const model = process.env.GEMINI_TEMPLATE_MODEL || "gemini-2.5-flash";
  const startedAt = Date.now();

  logInfo("template_library_assistant_started", {
    requestId,
    userId: session.user.id,
    model,
    templateCount: parsed.data.templates.length
  });

  try {
    let providerResult = await runModel({
      apiKey,
      model,
      prompt: parsed.data.prompt,
      templates: parsed.data.templates,
      messages: parsed.data.messages,
      compact: false,
      timeoutMs: PRIMARY_TIMEOUT_MS
    });

    if (!providerResult.response.ok || !providerResult.payload?.candidates?.[0]?.content?.parts?.[0]?.text) {
      logWarn("template_library_assistant_retrying_compact", {
        requestId,
        userId: session.user.id,
        status: providerResult.response.status
      });
      providerResult = await runModel({
        apiKey,
        model,
        prompt: parsed.data.prompt,
        templates: parsed.data.templates,
        messages: parsed.data.messages,
        compact: true,
        timeoutMs: FALLBACK_TIMEOUT_MS
      });
    }

    if (!providerResult.response.ok) {
      logWarn("template_library_assistant_provider_error", {
        requestId,
        userId: session.user.id,
        status: providerResult.response.status,
        details: providerResult.payload
      });
      return NextResponse.json(
        { error: "AI provider request failed", details: providerResult.payload, requestId },
        { status: providerResult.response.status }
      );
    }

    const rawText = providerResult.payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json = extractJson(rawText);
    if (!json) {
      logWarn("template_library_assistant_invalid_json", {
        requestId,
        userId: session.user.id,
        rawPreview: String(rawText).slice(0, 1200)
      });
      return NextResponse.json(
        { error: "Model did not return valid JSON.", raw: rawText, requestId },
        { status: 502 }
      );
    }

    const validated = responseSchema.safeParse(json);
    if (!validated.success) {
      logWarn("template_library_assistant_invalid_shape", {
        requestId,
        userId: session.user.id,
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })),
        rawPreview: JSON.stringify(json).slice(0, 1200)
      });
      return NextResponse.json(
        {
          error: validated.error.flatten(),
          issues: validated.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          })),
          raw: rawText,
          requestId
        },
        { status: 502 }
      );
    }

    const allowedIds = new Set(parsed.data.templates.map((template) => template.id));
    const recommendations = validated.data.recommendations.filter((item) => allowedIds.has(item.templateId));

    logInfo("template_library_assistant_succeeded", {
      requestId,
      userId: session.user.id,
      durationMs: Date.now() - startedAt,
      recommendations: recommendations.length
    });

    return NextResponse.json({
      assistantMessage: validated.data.assistantMessage,
      recommendations,
      suggestStartFresh: validated.data.suggestStartFresh,
      freshReason: validated.data.freshReason,
      requestId
    });
  } catch (error) {
    logError("template_library_assistant_failed", error, {
      requestId,
      userId: session.user.id
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "The template library assistant timed out. Try a shorter request."
            : "Unable to run the template library assistant.",
        requestId
      },
      { status: 500 }
    );
  }
}
