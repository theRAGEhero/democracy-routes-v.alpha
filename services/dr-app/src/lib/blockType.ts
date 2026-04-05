import { z } from "zod";

export const CANONICAL_BLOCK_TYPES = [
  "START",
  "PARTICIPANTS",
  "DISCUSSION",
  "PAUSE",
  "PROMPT",
  "NOTES",
  "RECORD",
  "FORM",
  "EMBED",
  "GROUPING",
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
  if (raw === "PAIRING") return "DISCUSSION";
  if (raw === "MATCHING") return "GROUPING";
  return (CANONICAL_BLOCK_TYPES as readonly string[]).includes(raw) ? (raw as CanonicalBlockType) : null;
}

export function normalizeBlockRecord<T extends { type: unknown }>(block: T): (Omit<T, "type"> & { type: CanonicalBlockType }) | null {
  const type = normalizeBlockType(block.type);
  if (!type) return null;
  return {
    ...block,
    type
  };
}

export function normalizeBlockRecords<T extends { type: unknown }>(blocks: T[]) {
  return blocks
    .map((block) => normalizeBlockRecord(block))
    .filter((block): block is Omit<T, "type"> & { type: CanonicalBlockType } => Boolean(block));
}

export const blockTypeSchema = z.preprocess(
  (value) => normalizeBlockType(value),
  z.enum(CANONICAL_BLOCK_TYPES)
);
