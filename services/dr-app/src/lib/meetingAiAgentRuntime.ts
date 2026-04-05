import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { postEventHubEvent } from "@/lib/eventHub";
import { isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";

function hashTranscriptWindow(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function trimTranscriptWindow(text: string, maxChars: number) {
  const normalized = String(text || "").trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(-maxChars);
}

function buildPrompt(args: {
  meetingTitle: string;
  meetingDescription: string | null;
  language: string;
  transcriptWindow: string;
  systemPrompt: string;
  instructionPrompt: string | null;
}) {
  return (
    `${args.systemPrompt.trim()}\n\n` +
    `${args.instructionPrompt?.trim() ? `${args.instructionPrompt.trim()}\n\n` : ""}` +
    `You are participating inside a live Democracy Routes deliberation.\n` +
    `Write one concise intervention as an AI participant.\n` +
    `Return ONLY the reply text, no markdown fences, no labels, no JSON.\n` +
    `Keep it under 90 words.\n` +
    `Avoid repeating prior AI interventions unless there is genuinely new substance.\n\n` +
    `Meeting title: ${args.meetingTitle}\n` +
    `Meeting description: ${args.meetingDescription || "(none)"}\n` +
    `Language: ${args.language}\n\n` +
    `Recent live transcript:\n${args.transcriptWindow}`
  );
}

async function runAgentModel(args: {
  model: string;
  meetingTitle: string;
  meetingDescription: string | null;
  language: string;
  transcriptWindow: string;
  systemPrompt: string;
  instructionPrompt: string | null;
}) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(args)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 256
        }
      })
    }
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "AI agent request failed");
  }

  const text = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) {
    throw new Error("AI agent returned empty text");
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 800);
}

export async function maybeRunMeetingAiAgents(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      aiAgents: {
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
        include: {
          agent: true
        }
      }
    }
  });

  if (!meeting) return { ok: false as const, reason: "missing_meeting" as const };
  if (!isLiveTranscriptionProvider(meeting.transcriptionProvider)) {
    return { ok: false as const, reason: "provider_not_supported" as const };
  }
  if (!meeting.isActive) {
    return { ok: false as const, reason: "meeting_inactive" as const };
  }

  const assignment = meeting.aiAgents[0];
  if (!assignment?.agent?.enabled) {
    return { ok: false as const, reason: "no_enabled_agent" as const };
  }

  const latestRun = await prisma.meetingAiAgentRun.findFirst({
    where: {
      meetingId,
      agentId: assignment.agentId,
      NOT: {
        status: "SKIPPED",
        reasonSkipped: "interval_not_elapsed"
      }
    },
    orderBy: { evaluatedAt: "desc" }
  });

  if (latestRun) {
    const intervalMs = Math.max(15, assignment.intervalSeconds || assignment.agent.defaultIntervalSeconds || 60) * 1000;
    const elapsed = Date.now() - new Date(latestRun.evaluatedAt).getTime();
    if (elapsed < intervalMs) {
      await prisma.meetingAiAgentRun.create({
        data: {
          meetingId,
          agentId: assignment.agentId,
          status: "SKIPPED",
          reasonSkipped: "interval_not_elapsed"
        }
      });
      return { ok: false as const, reason: "interval_not_elapsed" as const };
    }
  }

  const transcriptText = String(meeting.transcript?.transcriptText || "").trim();
  const transcriptWindow = trimTranscriptWindow(transcriptText, 4000);
  if (transcriptWindow.length < Math.max(120, assignment.minTranscriptChars || 240)) {
    await prisma.meetingAiAgentRun.create({
      data: {
        meetingId,
        agentId: assignment.agentId,
        status: "SKIPPED",
        reasonSkipped: "not_enough_transcript",
        transcriptChars: transcriptWindow.length
      }
    });
    return { ok: false as const, reason: "not_enough_transcript" as const };
  }

  const transcriptWindowHash = hashTranscriptWindow(transcriptWindow);
  const lastMessage = await prisma.meetingAiAgentMessage.findFirst({
    where: {
      meetingId,
      agentId: assignment.agentId
    },
    orderBy: { createdAt: "desc" }
  });

  if ((lastMessage?.transcriptWindowHash || null) === transcriptWindowHash) {
    await prisma.meetingAiAgentRun.create({
      data: {
        meetingId,
        agentId: assignment.agentId,
        status: "SKIPPED",
        reasonSkipped: "no_new_transcript_window",
        transcriptWindowHash,
        transcriptChars: transcriptWindow.length
      }
    });
    return { ok: false as const, reason: "no_new_transcript_window" as const };
  }

  const repliesCount = await prisma.meetingAiAgentMessage.count({
    where: {
      meetingId,
      agentId: assignment.agentId
    }
  });

  if (repliesCount >= assignment.maxReplies) {
    await prisma.meetingAiAgentRun.create({
      data: {
        meetingId,
        agentId: assignment.agentId,
        status: "SKIPPED",
        reasonSkipped: "max_replies_reached",
        transcriptWindowHash,
        transcriptChars: transcriptWindow.length
      }
    });
    return { ok: false as const, reason: "max_replies_reached" as const };
  }

  if (lastMessage) {
    const cooldownMs = Math.max(15, assignment.cooldownSeconds || 120) * 1000;
    const elapsed = Date.now() - new Date(lastMessage.createdAt).getTime();
    if (elapsed < cooldownMs) {
      await prisma.meetingAiAgentRun.create({
        data: {
          meetingId,
          agentId: assignment.agentId,
          status: "SKIPPED",
          reasonSkipped: "cooldown_active",
          transcriptWindowHash,
          transcriptChars: transcriptWindow.length
        }
      });
      return { ok: false as const, reason: "cooldown_active" as const };
    }
  }

  await postEventHubEvent({
    source: "dr-app",
    type: "meeting_ai_agent_evaluated",
    severity: "info",
    message: "Meeting AI agent evaluated",
    meetingId,
    payload: {
      agentId: assignment.agentId,
      transcriptChars: transcriptWindow.length
    }
  }).catch(() => null);

  try {
    const responseText = await runAgentModel({
      model: assignment.agent.model || "gemini-2.5-flash",
      meetingTitle: meeting.title,
      meetingDescription: meeting.description,
      language: meeting.language,
      transcriptWindow,
      systemPrompt: assignment.agent.systemPrompt,
      instructionPrompt: assignment.customPromptOverride || assignment.agent.instructionPrompt
    });

    await prisma.$transaction(async (tx) => {
      await tx.meetingAiAgentMessage.create({
        data: {
          meetingId,
          agentId: assignment.agentId,
          text: responseText,
          transcriptWindowHash
        }
      });

      await tx.meetingAiAgentRun.create({
        data: {
          meetingId,
          agentId: assignment.agentId,
          status: "REPLIED",
          transcriptWindowHash,
          transcriptChars: transcriptWindow.length,
          responseText,
          model: assignment.agent.model || "gemini-2.5-flash",
          respondedAt: new Date()
        }
      });
    });

    await postEventHubEvent({
      source: "dr-app",
      type: "meeting_ai_agent_replied",
      severity: "info",
      message: "Meeting AI agent replied",
      meetingId,
      payload: {
        agentId: assignment.agentId,
        model: assignment.agent.model || "gemini-2.5-flash"
      }
    }).catch(() => null);

    return { ok: true as const, responded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI agent failed";
    await prisma.meetingAiAgentRun.create({
      data: {
        meetingId,
        agentId: assignment.agentId,
        status: "FAILED",
        error: message,
        transcriptWindowHash,
        transcriptChars: transcriptWindow.length,
        model: assignment.agent.model || "gemini-2.5-flash"
      }
    });
    await postEventHubEvent({
      source: "dr-app",
      type: "meeting_ai_agent_failed",
      severity: "error",
      message: "Meeting AI agent failed",
      meetingId,
      payload: {
        agentId: assignment.agentId,
        error: message
      }
    }).catch(() => null);
    return { ok: false as const, reason: "agent_failed" as const };
  }
}
