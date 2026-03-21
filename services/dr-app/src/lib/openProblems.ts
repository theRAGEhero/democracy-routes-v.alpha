const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "we",
  "what",
  "with",
  "would",
  "you",
  "your"
]);

export type OpenProblemSimilarityCandidate = {
  id: string;
  title: string;
  description: string;
  status?: string | null;
  createdByEmail?: string | null;
  joinCount?: number | null;
};

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function toTokenSet(value: string) {
  return new Set(tokenize(value));
}

export function scoreOpenProblemSimilarity(input: string, candidate: { title: string; description: string }) {
  const inputTokens = toTokenSet(input);
  if (inputTokens.size === 0) return 0;

  const candidateTitleTokens = toTokenSet(candidate.title);
  const candidateDescriptionTokens = toTokenSet(candidate.description);
  const candidateTokens = new Set([...candidateTitleTokens, ...candidateDescriptionTokens]);
  if (candidateTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of inputTokens) {
    if (candidateTokens.has(token)) overlap += candidateTitleTokens.has(token) ? 2 : 1;
  }

  const denominator = Math.max(inputTokens.size + candidateTokens.size, 1);
  return overlap / denominator;
}

export function findSimilarOpenProblems(
  input: string,
  candidates: OpenProblemSimilarityCandidate[],
  limit = 5
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      similarity: scoreOpenProblemSimilarity(input, candidate)
    }))
    .filter((candidate) => candidate.similarity >= 0.12)
    .sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function buildOpenProblemDraft(messages: Array<{ role: string; text: string }>) {
  const userText = messages
    .filter((entry) => entry.role === "user")
    .map((entry) => String(entry.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const normalized = userText.replace(/\s+/g, " ").trim();
  const titleWords = normalized.split(" ").filter(Boolean).slice(0, 10);
  const title = titleWords.join(" ").replace(/[.!?,;:]+$/g, "").trim() || "Open problem";
  const description = normalized.slice(0, 700).trim() || "No description yet.";

  return {
    title,
    description,
    combinedText: userText
  };
}
