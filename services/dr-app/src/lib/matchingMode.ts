export type MatchingMode = "polar" | "anti";

export function normalizeMatchingMode(value?: string | null): MatchingMode | null {
  if (value === "polar" || value === "anti") {
    return value;
  }
  return null;
}
