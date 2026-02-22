export type PlanBlockType = "ROUND" | "MEDITATION" | "POSTER" | "TEXT" | "RECORD" | "FORM";

export type PlanBlockInput = {
  id?: string | null;
  type: PlanBlockType;
  durationSeconds: number;
  roundNumber?: number | null;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
};

export type PlanSegment = {
  type: PlanBlockType;
  blockId?: string | null;
  roundNumber?: number | null;
  meditationIndex?: number;
  recordIndex?: number;
  roundAfter?: number | null;
  posterId?: string | null;
  startAtMs: number;
  endAtMs: number;
};

export type LegacyPlanConfig = {
  startAt: Date;
  roundsCount: number;
  roundDurationMinutes: number;
  meditationEnabled: boolean;
  meditationAtStart: boolean;
  meditationBetweenRounds: boolean;
  meditationAtEnd: boolean;
  meditationDurationMinutes: number;
};

export function buildLegacySegments(config: LegacyPlanConfig) {
  const segments: PlanSegment[] = [];
  let meditationIndex = 0;
  let cursor = config.startAt.getTime();

  const meditationDurationMs = config.meditationDurationMinutes * 60 * 1000;
  const roundDurationMs = config.roundDurationMinutes * 60 * 1000;

  if (config.meditationEnabled && config.meditationAtStart) {
    meditationIndex += 1;
    segments.push({
      type: "MEDITATION",
      meditationIndex,
      roundAfter: 1,
      startAtMs: cursor,
      endAtMs: cursor + meditationDurationMs
    });
    cursor += meditationDurationMs;
  }

  for (let round = 1; round <= config.roundsCount; round += 1) {
    segments.push({
      type: "ROUND",
      roundNumber: round,
      startAtMs: cursor,
      endAtMs: cursor + roundDurationMs
    });
    cursor += roundDurationMs;

    if (config.meditationEnabled && config.meditationBetweenRounds && round < config.roundsCount) {
      meditationIndex += 1;
      segments.push({
        type: "MEDITATION",
        meditationIndex,
        roundAfter: round + 1,
        startAtMs: cursor,
        endAtMs: cursor + meditationDurationMs
      });
      cursor += meditationDurationMs;
    }
  }

  if (config.meditationEnabled && config.meditationAtEnd) {
    meditationIndex += 1;
    segments.push({
      type: "MEDITATION",
      meditationIndex,
      roundAfter: null,
      startAtMs: cursor,
      endAtMs: cursor + meditationDurationMs
    });
    cursor += meditationDurationMs;
  }

  return { segments, totalEndMs: cursor };
}

export function buildPlanSegmentsFromBlocks(startAt: Date, blocks: PlanBlockInput[]) {
  const segments: PlanSegment[] = [];
  let cursor = startAt.getTime();
  let meditationIndex = 0;
  let recordIndex = 0;
  let lastRoundNumber = 0;

  const roundNumbers = blocks
    .filter((block) => block.type === "ROUND" && block.roundNumber)
    .map((block) => block.roundNumber as number);

  blocks.forEach((block) => {
    const durationMs = Math.max(1, block.durationSeconds) * 1000;
    if (block.type === "MEDITATION") {
      meditationIndex += 1;
    }
    if (block.type === "RECORD") {
      recordIndex += 1;
    }
    if (block.type === "ROUND" && block.roundNumber) {
      lastRoundNumber = block.roundNumber;
    }
    const nextRoundNumber =
      block.type !== "ROUND"
        ? roundNumbers.find((round) => round > lastRoundNumber) ?? null
        : null;

    segments.push({
      type: block.type,
      blockId: block.id ?? null,
      roundNumber: block.roundNumber ?? null,
      meditationIndex: block.type === "MEDITATION" ? meditationIndex : undefined,
      recordIndex: block.type === "RECORD" ? recordIndex : undefined,
      roundAfter: block.type !== "ROUND" ? nextRoundNumber : null,
      posterId: block.posterId ?? null,
      startAtMs: cursor,
      endAtMs: cursor + durationMs
    });
    cursor += durationMs;
  });

  return { segments, totalEndMs: cursor };
}

export function getSegmentAtTime(segments: PlanSegment[], nowMs: number) {
  for (const segment of segments) {
    if (nowMs < segment.endAtMs) {
      return segment;
    }
  }
  return segments[segments.length - 1] ?? null;
}
