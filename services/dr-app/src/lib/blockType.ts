import { z } from "zod";

export const CANONICAL_BLOCK_TYPES = [
  "START",
  "PARTICIPANTS",
  "PAIRING",
  "PAUSE",
  "PROMPT",
  "NOTES",
  "RECORD",
  "FORM",
  "EMBED",
  "MATCHING",
  "BREAK",
  "HARMONICA",
  "DEMBRANE",
  "DELIBERAIDE",
  "POLIS",
  "AGORACITIZENS",
  "NEXUSPOLITICS",
  "SUFFRAGO"
] as const;

export type CanonicalBlockType = (typeof CANONICAL_BLOCK_TYPES)[number];

export function normalizeBlockType(value: unknown): CanonicalBlockType | null {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "DISCUSSION") return "PAIRING";
  return (CANONICAL_BLOCK_TYPES as readonly string[]).includes(raw) ? (raw as CanonicalBlockType) : null;
}

export const blockTypeSchema = z.preprocess(
  (value) => normalizeBlockType(value),
  z.enum(CANONICAL_BLOCK_TYPES)
);
