export const OPEN_PROBLEM_BOARD_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;

export const OPEN_PROBLEM_ACTIVE_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW"] as const;

export type OpenProblemStatus = (typeof OPEN_PROBLEM_BOARD_STATUSES)[number];

export const OPEN_PROBLEM_STATUS_LABELS: Record<OpenProblemStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done"
};
