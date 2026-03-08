import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logger";
import { TEMPLATE_BLOCK_TYPES } from "@/lib/templateDraft";

const agreementDeadlineSchema = z
  .union([z.string(), z.number().int().min(0)])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null;
    return String(value);
  });

const blockSchema = z.object({
  type: z.enum(TEMPLATE_BLOCK_TYPES),
  durationSeconds: z.number().int().min(30).max(7200),
  startMode: z
    .enum([
      "specific_datetime",
      "when_x_join",
      "organizer_manual",
      "when_x_join_and_datetime",
      "random_selection_among_x"
    ])
    .optional()
    .nullable(),
  startDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  timezone: z.string().trim().max(100).optional().nullable(),
  requiredParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  agreementRequired: z.boolean().optional().nullable(),
  agreementDeadline: agreementDeadlineSchema,
  minimumParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  allowStartBeforeFull: z.boolean().optional().nullable(),
  poolSize: z.number().int().min(1).max(100000).optional().nullable(),
  selectedParticipants: z.number().int().min(1).max(100000).optional().nullable(),
  selectionRule: z.enum(["random"]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  participantMode: z
    .enum(["manual_selected", "dataspace_invite_all", "dataspace_random", "ai_search_users"])
    .optional()
    .nullable(),
  participantUserIds: z.array(z.string().min(1).max(64)).optional().nullable(),
  participantDataspaceIds: z.array(z.string().min(1).max(64)).optional().nullable(),
  participantCount: z.number().int().min(1).max(100000).optional().nullable(),
  participantQuery: z.string().trim().max(500).optional().nullable(),
  participantNote: z.string().trim().max(500).optional().nullable(),
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
  harmonicaUrl: z.string().trim().max(500).optional().nullable(),
  matchingMode: z.enum(["polar", "anti"]).optional().nullable(),
  meditationAnimationId: z.string().optional().nullable(),
  meditationAudioUrl: z.string().optional().nullable()
});

const settingsSchema = z.object({
  syncMode: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
  maxParticipantsPerRoom: z.number().int().min(2).max(12).default(2),
  allowOddGroup: z.boolean().default(false),
  language: z.string().trim().min(2).max(12).default("EN"),
  transcriptionProvider: z.string().trim().min(2).max(40).default("DEEPGRAMLIVE"),
  timezone: z.string().trim().max(80).optional().nullable(),
  dataspaceId: z.string().trim().max(64).optional().nullable(),
  requiresApproval: z.boolean().default(false),
  capacity: z.number().int().min(1).max(5000).optional().nullable()
});

const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  settings: settingsSchema.default({
    syncMode: "SERVER",
    maxParticipantsPerRoom: 2,
    allowOddGroup: false,
    language: "EN",
    transcriptionProvider: "DEEPGRAMLIVE",
    timezone: null,
    dataspaceId: null,
    requiresApproval: false,
    capacity: null
  }),
  blocks: z.array(blockSchema).min(1).max(24)
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  text: z.string().trim().min(1).max(4000)
});

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  draft: templateSchema.optional(),
  templateId: z.string().trim().min(1).max(64).optional(),
  messages: z.array(messageSchema).max(40).optional().default([]),
  mode: z.enum(["generate", "modify"]).optional().default("generate")
});

function buildSystemPrompt(
  userPrompt: string,
  mode: "generate" | "modify",
  draft?: z.infer<typeof templateSchema>,
  messages: Array<z.infer<typeof messageSchema>> = [],
  compact = false
) {
  const conversationSection = messages.length
    ? `Conversation so far:\n${messages
        .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
        .join("\n")}\n\n`
    : "";
  const existingDraftSection =
    mode === "modify" && draft
      ? `Existing template draft:\n${JSON.stringify(draft, null, 2)}\n\n` +
        `Modify this existing template according to the user instruction. Preserve current structure and settings unless the instruction asks for changes.\n\n`
      : "";
  return `You are an assistant that outputs a single JSON object describing a Democracy Routes template.\n\n` +
    `Available modules and fields:\n` +
    `- START: durationSeconds, startMode ("specific_datetime" | "when_x_join" | "organizer_manual" | "when_x_join_and_datetime" | "random_selection_among_x"), startDate, startTime, timezone, requiredParticipants, agreementRequired, agreementDeadline, minimumParticipants, allowStartBeforeFull, poolSize, selectedParticipants, selectionRule ("random"), note\n` +
    `- PARTICIPANTS: durationSeconds, participantMode ("manual_selected" | "dataspace_invite_all" | "dataspace_random" | "ai_search_users"), participantUserIds, participantDataspaceIds, participantCount, participantQuery, participantNote\n` +
    `- PAIRING: durationSeconds (int, seconds), roundMaxParticipants (2-12)\n` +
    `- PAUSE: durationSeconds, meditationAnimationId (string or null), meditationAudioUrl (string or null)\n` +
    `- PROMPT: durationSeconds, posterId (string or null; if unknown, leave null)\n` +
    `- NOTES: durationSeconds\n` +
    `- RECORD: durationSeconds\n` +
    `- FORM: durationSeconds, formQuestion (string), formChoices (array of {key, label})\n` +
    `- EMBED: durationSeconds, embedUrl (string)\n` +
    `- MATCHING: durationSeconds, matchingMode ("polar" or "anti")\n` +
    `- BREAK: durationSeconds\n` +
    `- HARMONICA: durationSeconds, harmonicaUrl (string)\n` +
    `- DEMBRANE: durationSeconds\n` +
    `- DELIBERAIDE: durationSeconds\n` +
    `- POLIS: durationSeconds\n` +
    `- AGORACITIZENS: durationSeconds\n` +
    `- NEXUSPOLITICS: durationSeconds\n` +
    `- SUFFRAGO: durationSeconds\n\n` +
    `Template-level settings:\n` +
    `- settings.syncMode: "SERVER" or "CLIENT"\n` +
    `- settings.maxParticipantsPerRoom: integer 2-12\n` +
    `- settings.allowOddGroup: boolean\n` +
    `- settings.language: usually "EN" or "IT"\n` +
    `- settings.transcriptionProvider: "DEEPGRAM", "DEEPGRAMLIVE", "VOSK", or "WHISPERREMOTE"\n` +
    `- settings.timezone: timezone string or null\n` +
    `- settings.dataspaceId: string or null\n` +
    `- settings.requiresApproval: boolean\n` +
    `- settings.capacity: integer or null\n\n` +
    `Output requirements:\n` +
    `- Output ONLY valid JSON with keys: assistantMessage, template.\n` +
    `- assistantMessage must be a concise, plain-language reply to the user about what changed or what was generated.\n` +
    `- template must contain keys: name, description, isPublic, settings, blocks.\n` +
    `- Keep free-text fields short. Prefer null over long prose when details are not essential.\n` +
    `- Keep notes to at most one short sentence.\n` +
    `- Use the minimum fields needed for each block type.\n` +
    `- durationSeconds must be between 30 and 7200.\n` +
    `- blocks must be a single linear sequence, max 24 blocks.\n` +
    `- Do not include markdown or explanations.\n\n` +
    (compact
      ? `Compact mode:\n- Reduce verbosity aggressively.\n- Use 6-10 blocks unless the request clearly requires more.\n- Keep form choices short and limited.\n- Avoid optional fields unless necessary.\n\n`
      : "") +
    conversationSection +
    existingDraftSection +
    `User request: ${userPrompt}`;
}

function extractJson(text: string) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const unfenced = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(unfenced);
  } catch {}

  const first = unfenced.indexOf("{");
  if (first === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < unfenced.length; i += 1) {
    const char = unfenced[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
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
        const slice = unfenced.slice(first, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function normalizeAiTemplateJson(input: any) {
  if (!input || typeof input !== "object") return input;
  const normalized = { ...input };
  if (Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks
      .flat(Infinity)
      .filter(Boolean)
      .map((block: any) => {
        if (!block || typeof block !== "object") return block;
        const nextBlock = { ...block };
        if (Array.isArray(nextBlock.selectedParticipants)) {
          nextBlock.selectedParticipants =
            typeof nextBlock.selectedParticipants[0] === "number"
              ? nextBlock.selectedParticipants[0]
              : null;
        }
        if (Array.isArray(nextBlock.poolSize)) {
          nextBlock.poolSize =
            typeof nextBlock.poolSize[0] === "number" ? nextBlock.poolSize[0] : null;
        }
        if (Array.isArray(nextBlock.requiredParticipants)) {
          nextBlock.requiredParticipants =
            typeof nextBlock.requiredParticipants[0] === "number"
              ? nextBlock.requiredParticipants[0]
              : null;
        }
        if (Array.isArray(nextBlock.minimumParticipants)) {
          nextBlock.minimumParticipants =
            typeof nextBlock.minimumParticipants[0] === "number"
              ? nextBlock.minimumParticipants[0]
              : null;
        }
        return nextBlock;
      });
  }
  return normalized;
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

function looksTruncatedJson(text: string) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (!raw.startsWith("{")) return false;
  const last = raw.slice(-1);
  if (last === "}" || last === "]") return false;
  return true;
}

async function generateTemplateEnvelope(args: {
  apiKey: string;
  model: string;
  prompt: string;
  mode: "generate" | "modify";
  draft?: z.infer<typeof templateSchema>;
  messages: Array<z.infer<typeof messageSchema>>;
  compact?: boolean;
}) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${args.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildSystemPrompt(args.prompt, args.mode, args.draft, args.messages, Boolean(args.compact)) }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: args.compact ? 3072 : 4096,
          responseMimeType: "application/json"
        }
      })
    },
    30000
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    return {
      ok: false as const,
      status: response.status,
      errorPayload
    };
  }

  const payload = await response.json();
  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const json = extractJson(rawText);
  return {
    ok: true as const,
    rawText,
    json
  };
}

function isProviderUnavailable(errorPayload: any) {
  const status = String(errorPayload?.error?.status || "").toUpperCase();
  const message = String(errorPayload?.error?.message || "").toLowerCase();
  return status === "UNAVAILABLE" || message.includes("high demand") || message.includes("try again later");
}

export async function POST(request: Request) {
  const requestId = getRequestId(request) || crypto.randomUUID();
  const session = await getSession();
  if (!session?.user) {
    logWarn("template_ai_unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    logWarn("template_ai_invalid_request", {
      requestId,
      userId: session.user.id,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return NextResponse.json({ error: parsed.error.flatten(), requestId }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logError("template_ai_missing_api_key", new Error("GEMINI_API_KEY is not configured"), {
      requestId,
      userId: session.user.id
    });
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured.", requestId }, { status: 500 });
  }

  const stableTemplateModel = process.env.GEMINI_TEMPLATE_MODEL || "gemini-2.5-flash";
  const prompt = parsed.data.prompt;
  const mode = parsed.data.mode;
  const draft = parsed.data.draft;
  const templateId = parsed.data.templateId;
  const messages = parsed.data.messages;
  const startedAt = Date.now();
  let activeModel = stableTemplateModel;

  logInfo("template_ai_generate_started", {
    requestId,
    userId: session.user.id,
    model: stableTemplateModel,
    mode,
    promptLength: prompt.length
  });

  try {
    let generation = await generateTemplateEnvelope({
      apiKey,
      model: activeModel,
      prompt,
      mode,
      draft,
      messages
    });

    if (!generation.ok) {
      if (generation.status === 503 && isProviderUnavailable(generation.errorPayload) && activeModel !== "gemini-2.5-flash") {
        activeModel = "gemini-2.5-flash";
        logWarn("template_ai_provider_retry_stable_model", {
          requestId,
          userId: session.user.id,
          failedModel: stableTemplateModel,
          retryModel: activeModel,
          mode,
          details: generation.errorPayload
        });
        generation = await generateTemplateEnvelope({
          apiKey,
          model: activeModel,
          prompt,
          mode,
          draft,
          messages
        });
      }
    }

    if (!generation.ok) {
      logWarn("template_ai_gemini_http_error", {
        requestId,
        userId: session.user.id,
        model: activeModel,
        mode,
        status: generation.status,
        details: generation.errorPayload
      });
      return NextResponse.json(
        { error: "AI provider request failed", details: generation.errorPayload, requestId },
        { status: generation.status }
      );
    }

    let rawText = generation.rawText;
    let json = generation.json;
    if (!json && looksTruncatedJson(rawText)) {
      logWarn("template_ai_truncated_json_retry", {
        requestId,
        userId: session.user.id,
        model: activeModel,
        mode,
        rawPreview: rawText.slice(0, 1200)
      });
      generation = await generateTemplateEnvelope({
        apiKey,
        model: activeModel,
        prompt: `${prompt}\n\nReturn a shorter compact version of the same template. Keep free-text minimal and output complete valid JSON only.`,
        mode,
        draft,
        messages,
        compact: true
      });
      if (!generation.ok) {
        logWarn("template_ai_gemini_http_error_retry", {
          requestId,
          userId: session.user.id,
          model: activeModel,
          mode,
          status: generation.status,
          details: generation.errorPayload
        });
        return NextResponse.json(
          { error: "AI provider request failed", details: generation.errorPayload, requestId },
          { status: generation.status }
        );
      }
      rawText = generation.rawText;
      json = generation.json;
    }

    if (!json) {
      logWarn("template_ai_invalid_json_response", {
        requestId,
        userId: session.user.id,
        model: activeModel,
        mode,
        rawPreview: rawText.slice(0, 1200)
      });
      return NextResponse.json(
        { error: "Model did not return valid JSON.", raw: rawText, requestId },
        { status: 400 }
      );
    }

    const envelope =
      json && typeof json === "object" && "template" in json
        ? {
            assistantMessage:
              typeof (json as any).assistantMessage === "string"
                ? (json as any).assistantMessage.trim()
                : "",
            template: normalizeAiTemplateJson((json as any).template)
          }
        : {
            assistantMessage:
              mode === "modify"
                ? "I prepared an updated draft based on your instruction."
                : "I prepared a new draft based on your request.",
            template: normalizeAiTemplateJson(json)
          };

    const validated = templateSchema.safeParse(envelope.template);
    if (!validated.success) {
      logWarn("template_ai_schema_validation_failed", {
        requestId,
        userId: session.user.id,
        model: activeModel,
        mode,
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })),
        rawPreview: rawText.slice(0, 1200)
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
        { status: 400 }
      );
    }

    logInfo("template_ai_generate_succeeded", {
      requestId,
      userId: session.user.id,
      model: activeModel,
      mode,
      blockCount: validated.data.blocks.length,
      durationMs: Date.now() - startedAt
    });

    const assistantMessage =
      envelope.assistantMessage ||
      (mode === "modify"
        ? "I prepared an updated draft based on your instruction."
        : "I prepared a new draft based on your request.");

    if (templateId) {
      const persistedMessages = [
        ...messages,
        { role: "user" as const, text: prompt },
        { role: "assistant" as const, text: assistantMessage }
      ]
        .slice(-40)
        .map((message, index) => ({
          id: `${message.role}-${Date.now()}-${index}`,
          role: message.role,
          text: message.text
        }));

      await prisma.templateAiConversation.upsert({
        where: {
          templateId_userId: {
            templateId,
            userId: session.user.id
          }
        },
        update: { messagesJson: JSON.stringify(persistedMessages) },
        create: {
          templateId,
          userId: session.user.id,
          messagesJson: JSON.stringify(persistedMessages)
        }
      });
    }

    return NextResponse.json({
      assistantMessage,
      template: validated.data,
      raw: rawText,
      requestId
    });
  } catch (error) {
    logError("template_ai_generate_failed", error, {
      requestId,
      userId: session.user.id,
      model: activeModel,
      mode,
      durationMs: Date.now() - startedAt
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Template generation failed.",
        requestId
      },
      { status: 500 }
    );
  }
}
