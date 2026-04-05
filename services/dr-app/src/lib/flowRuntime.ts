import crypto from "crypto";
import type { PlanBlockInput, PlanBlockType } from "@/lib/planSchedule";
import { getRoomProviderSuffix } from "@/lib/transcriptionProviders";

export type FlowRuntimeVersion = "LEGACY_PAIR" | "ROOM_BASED";
export type FlowAdmissionMode = "ALWAYS_OPEN" | "TIME_WINDOW";
export type FlowAdmissionStatus = "upcoming" | "open" | "closed";

export function detectFlowRuntimeVersion(
  blocks: Array<{ type: string | PlanBlockType }>
): FlowRuntimeVersion {
  return blocks.some((block) => block.type === "GROUPING") ? "ROOM_BASED" : "LEGACY_PAIR";
}

export function generateFlowRoomId(language: string, transcriptionProvider: string) {
  const providerLabel = getRoomProviderSuffix(transcriptionProvider);
  const base = crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
  return `${base}-${language}-${providerLabel}`;
}

export function makeFlowGroups(
  participantIds: string[],
  maxParticipantsPerRoom: number,
  allowOddGroup: boolean
) {
  const list = [...participantIds];
  if (maxParticipantsPerRoom === 2 && list.length % 2 === 1) {
    if (allowOddGroup && list.length >= 3) {
      const groups: Array<string[]> = [];
      for (let i = 0; i < list.length - 3; i += 2) {
        groups.push(list.slice(i, i + 2));
      }
      groups.push(list.slice(list.length - 3));
      return groups;
    }
    list.push("__break__");
  }

  const groups: Array<string[]> = [];
  for (let i = 0; i < list.length; i += maxParticipantsPerRoom) {
    groups.push(list.slice(i, i + maxParticipantsPerRoom));
  }
  return groups;
}

export function rotateParticipants(userIds: string[]) {
  if (userIds.length <= 2) return userIds;
  const [first, ...rest] = userIds;
  const last = rest.pop();
  if (!last) return userIds;
  return [first, last, ...rest];
}

export function nextDiscussionRoundNumber(
  blocks: Array<{ orderIndex: number; type: string; roundNumber?: number | null }>,
  currentOrderIndex: number
) {
  const nextRound = blocks
    .filter((block) => block.orderIndex > currentOrderIndex)
    .find((block) => block.type === "DISCUSSION" && block.roundNumber);
  return nextRound?.roundNumber ?? null;
}

export function getDiscussionRoomSize(
  roundBlocks: Array<Pick<PlanBlockInput, "roundMaxParticipants">>,
  roundIndex: number,
  fallbackSize: number
) {
  return roundBlocks[roundIndex]?.roundMaxParticipants ?? fallbackSize;
}

export function normalizeFlowAdmissionMode(value: string | null | undefined): FlowAdmissionMode {
  return value === "TIME_WINDOW" ? "TIME_WINDOW" : "ALWAYS_OPEN";
}

export function getFlowAdmissionState(input: {
  admissionMode?: string | null;
  joinOpensAt?: Date | null;
  joinClosesAt?: Date | null;
  now?: Date;
  flowEndsAtMs?: number | null;
}) {
  const now = input.now ?? new Date();
  const mode = normalizeFlowAdmissionMode(input.admissionMode);
  const opensAt = input.joinOpensAt ?? null;
  const closesAt = input.joinClosesAt ?? null;
  const flowEnded =
    typeof input.flowEndsAtMs === "number" && Number.isFinite(input.flowEndsAtMs)
      ? now.getTime() >= input.flowEndsAtMs
      : false;

  let status: FlowAdmissionStatus = "open";
  if (flowEnded) {
    status = "closed";
  } else if (mode === "TIME_WINDOW") {
    if (opensAt && now < opensAt) {
      status = "upcoming";
    } else if (closesAt && now > closesAt) {
      status = "closed";
    }
  }

  return {
    mode,
    status,
    opensAt,
    closesAt
  };
}
