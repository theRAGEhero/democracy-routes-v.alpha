import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { buildOpenProblemDraft, findSimilarOpenProblems } from "@/lib/openProblems";
import { OPEN_PROBLEM_ACTIVE_STATUSES } from "@/lib/openProblemStatus";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  text: z.string().trim().min(1).max(4000)
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40)
});

const responseSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(2000),
  suggestedTitle: z.string().trim().min(1).max(160),
  suggestedDescription: z.string().trim().min(1).max(4000)
});

function buildPrompt(messages: Array<{ role: string; text: string }>) {
  const conversation = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join("\n");

  return (
    `You help users articulate an open civic, organizational, or personal-public problem they want to discuss with others later.\n\n` +
    `Return ONLY valid JSON with keys: assistantMessage, suggestedTitle, suggestedDescription.\n` +
    `assistantMessage must be short, concrete, and chat-like. Ask at most one clarifying question or offer one concise reframing.\n` +
    `Do not claim the meeting already exists. Do not over-solve the problem.\n` +
    `suggestedTitle must be a short and concrete title.\n` +
    `suggestedDescription must be a concise summary of what the user wants to discuss, 1-3 sentences.\n\n` +
    `Conversation:\n${conversation}`
  );
}

function extractJson(text: string) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}

  const first = trimmed.indexOf("{");
  if (first === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = first; index < trimmed.length; index += 1) {
    const char = trimmed[index];
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
          return JSON.parse(trimmed.slice(first, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function runAssistant(messages: Array<{ role: string; text: string }>) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(messages) }]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          maxOutputTokens: 1200,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Open problem assistant failed");
  }

  const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const extracted = extractJson(raw);
  const parsed = responseSchema.safeParse(extracted);
  if (!parsed.success) {
    throw new Error("Open problem assistant returned invalid JSON");
  }
  return parsed.data;
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

  const messages = parsed.data.messages;
  const fallbackDraft = buildOpenProblemDraft(messages);

  let result: z.infer<typeof responseSchema>;
  try {
    result = await runAssistant(messages);
  } catch {
    result = {
      assistantMessage: "What aspect of this problem matters most to you right now?",
      suggestedTitle: fallbackDraft.title,
      suggestedDescription: fallbackDraft.description
    };
  }

  const candidates = await prisma.openProblem.findMany({
    where: {
      status: { in: [...OPEN_PROBLEM_ACTIVE_STATUSES] },
      OR: [
        { dataspaceId: null },
        { dataspace: { members: { some: { userId: session.user.id } } } }
      ]
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dataspace: { select: { id: true, name: true, color: true } },
      createdBy: { select: { email: true } },
      joins: { select: { id: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 80
  });

  const similarProblems = findSimilarOpenProblems(
    `${result.suggestedTitle}\n${result.suggestedDescription}`,
    candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      status: candidate.status,
      createdByEmail: candidate.createdBy.email,
      joinCount: candidate.joins.length,
      dataspaceId: candidate.dataspace?.id ?? null,
      dataspaceName: candidate.dataspace?.name ?? null,
      dataspaceColor: candidate.dataspace?.color ?? null
    }))
  );

  return NextResponse.json({
    assistantMessage: result.assistantMessage,
    suggestedTitle: result.suggestedTitle,
    suggestedDescription: result.suggestedDescription,
    similarProblems
  });
}
