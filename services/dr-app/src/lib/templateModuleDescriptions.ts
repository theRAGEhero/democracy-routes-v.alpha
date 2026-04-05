import { prisma } from "@/lib/prisma";
import { TEMPLATE_BLOCK_TYPES, type TemplateBlockType } from "@/lib/templateDraft";

export const TEMPLATE_MODULE_DESCRIPTION_KEY = "template_module_descriptions";

export const DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS: Record<TemplateBlockType, string> = {
  START:
    "Defines how a template begins: fixed date and time, manual organizer start, participant threshold, or randomized participant selection conditions.",
  PARTICIPANTS:
    "Defines who should join: manually selected users, whole dataspaces, random extraction from dataspaces, or AI-guided matching from user profiles.",
  DISCUSSION:
    "Creates a discussion round by splitting participants into small groups or rooms for time-boxed conversations.",
  PAUSE:
    "Creates a timed pause block, optionally with meditation visuals or audio.",
  PROMPT:
    "Shows a text prompt or poster that gives context, framing, or instructions to participants.",
  NOTES:
    "Creates a collaborative text note-taking moment or reflective writing block.",
  RECORD:
    "Captures spoken contributions or open plenary discussion that should be recorded and transcribed.",
  FORM:
    "Collects structured answers through a question and predefined response choices.",
  EMBED:
    "Embeds an external URL such as a video, whiteboard, or other media tool inside the template flow.",
  GROUPING:
    "Forms rooms for the next discussion round, using random, polarizing, or depolarizing regrouping depending on the selected mode.",
  BREAK:
    "Adds a simple timed break between active phases.",
  HARMONICA:
    "Opens a Harmonica participation step, typically as an embedded external workflow or conversational activity.",
  DEMBRANE:
    "Represents an external participation platform integration placeholder for Dembrane.",
  DELIBERAIDE:
    "Represents an external participation platform integration placeholder for DeliberAIde.",
  POLIS:
    "Represents an external participation platform integration placeholder for Pol.is.",
  AGORACITIZENS:
    "Represents an external participation platform integration placeholder for Agora Citizens.",
  NEXUSPOLITICS:
    "Represents an external participation platform integration placeholder for Nexus Politics.",
  SUFFRAGO:
    "Represents an external participation platform integration placeholder for Suffrago."
};

export function normalizeTemplateModuleDescriptions(
  value: unknown
): Record<TemplateBlockType, string> {
  const next = { ...DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS };
  if (!value || typeof value !== "object") return next;
  const source = value as Record<string, unknown>;
  for (const type of TEMPLATE_BLOCK_TYPES) {
    const candidate =
      type === "GROUPING"
        ? source.GROUPING ?? source.MATCHING
        : source[type];
    if (typeof candidate === "string" && candidate.trim()) {
      next[type] = candidate.trim().slice(0, 1200);
    }
  }
  return next;
}

export async function getTemplateModuleDescriptions() {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: TEMPLATE_MODULE_DESCRIPTION_KEY }
  });
  if (!setting) return DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS;
  try {
    return normalizeTemplateModuleDescriptions(JSON.parse(setting.value));
  } catch {
    return DEFAULT_TEMPLATE_MODULE_DESCRIPTIONS;
  }
}
