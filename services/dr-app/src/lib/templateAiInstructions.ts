import { getSiteSetting, setSiteSetting } from "@/lib/siteSettings";

export const TEMPLATE_AI_INSTRUCTIONS_KEY = "template_ai_instructions";

export const DEFAULT_TEMPLATE_AI_INSTRUCTIONS = `Template-level settings:
- settings.syncMode: "SERVER" or "CLIENT"
- settings.maxParticipantsPerRoom: integer 2-12
- settings.allowOddGroup: boolean
- settings.language: usually "EN" or "IT"
- settings.transcriptionProvider: "DEEPGRAM", "DEEPGRAMLIVE", "VOSK", or "WHISPERREMOTE"
- settings.timezone: timezone string or null
- settings.dataspaceId: string or null
- settings.requiresApproval: boolean
- settings.capacity: integer or null

Output requirements:
- Output ONLY valid JSON with keys: assistantMessage, template.
- assistantMessage must be a concise, plain-language reply to the user about what changed or what was generated.
- template must contain keys: name, description, isPublic, settings, blocks.
- Keep free-text fields short. Prefer null over long prose when details are not essential.
- Keep notes to at most one short sentence.
- Use the minimum fields needed for each block type.
- For PROMPT blocks, prefer direct text prompts using posterTitle + posterContent unless a known posterId already exists.
- durationSeconds must be between 30 and 7200.
- blocks must be a single linear sequence, max 24 blocks.
- Do not include markdown or explanations.`;

export function normalizeTemplateAiInstructions(value: unknown) {
  if (typeof value !== "string") return DEFAULT_TEMPLATE_AI_INSTRUCTIONS;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 12000) : DEFAULT_TEMPLATE_AI_INSTRUCTIONS;
}

export async function getTemplateAiInstructions() {
  const stored = await getSiteSetting(TEMPLATE_AI_INSTRUCTIONS_KEY);
  return normalizeTemplateAiInstructions(stored);
}

export async function setTemplateAiInstructions(value: string) {
  await setSiteSetting(TEMPLATE_AI_INSTRUCTIONS_KEY, normalizeTemplateAiInstructions(value));
}
