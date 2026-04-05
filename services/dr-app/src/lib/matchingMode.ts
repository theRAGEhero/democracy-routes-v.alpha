export type MatchingMode = "polar" | "anti" | "random";

export function normalizeMatchingMode(value?: string | null): MatchingMode | null {
  if (value === "polar" || value === "anti" || value === "random") {
    return value;
  }
  return null;
}
