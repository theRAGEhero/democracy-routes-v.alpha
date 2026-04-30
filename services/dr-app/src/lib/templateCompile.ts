import type { TemplateBlock, TemplateDraft } from "@/lib/templateDraft";
import { buildPlanSegmentsFromBlocks, type PlanBlockInput } from "@/lib/planSchedule";
import { isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";

export type TemplateCompileIssue = {
  severity: "error" | "warning";
  message: string;
};

export type TemplateCompileResult = {
  ok: boolean;
  errors: TemplateCompileIssue[];
  warnings: TemplateCompileIssue[];
  totalDurationMinutes: number;
  discussionRounds: number;
  segmentCount: number;
};

function isValidUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type CompilableTemplateBlock = TemplateBlock & {
  id: string;
  roundNumber: number | null;
};

function normalizeBlocks(blocks: TemplateBlock[]): CompilableTemplateBlock[] {
  let roundNumber = 0;
  return blocks.map((block, index) => {
    const normalizedRoundNumber =
      block.type === "DISCUSSION" ? ++roundNumber : null;
    return {
      id: `compile-${index + 1}`,
      ...block,
      roundNumber: normalizedRoundNumber
    };
  });
}

export function compileTemplateDraft(draft: TemplateDraft): TemplateCompileResult {
  const issues: TemplateCompileIssue[] = [];
  const blocks = draft.blocks ?? [];
  const normalizedBlocks = normalizeBlocks(blocks);
  const liveAiSupported = isLiveTranscriptionProvider(draft.settings?.transcriptionProvider);
  const totalDurationMinutes = Math.round(
    normalizedBlocks.reduce(
      (sum, block) => sum + (block.type === "START" ? 0 : Math.max(0, block.durationSeconds || 0)),
      0
    ) / 60
  );
  const discussionRounds = normalizedBlocks.filter((block) => block.type === "DISCUSSION").length;

  if (normalizedBlocks.length === 0) {
    issues.push({ severity: "error", message: "Template must contain at least one module." });
  }

  if (draft.isPublic && !draft.settings.dataspaceId) {
    issues.push({
      severity: "error",
      message: "Public templates require a dataspace."
    });
  }

  const startIndexes = normalizedBlocks
    .map((block, index) => (block.type === "START" ? index : -1))
    .filter((index) => index >= 0);
  if (startIndexes.length > 1) {
    issues.push({
      severity: "error",
      message: "Only one Start module is allowed."
    });
  }
  if (startIndexes.length === 1 && startIndexes[0] !== 0) {
    issues.push({
      severity: "error",
      message: "Start must be the first module in the chain."
    });
  }

  const participantIndexes = normalizedBlocks
    .map((block, index) => (block.type === "PARTICIPANTS" ? index : -1))
    .filter((index) => index >= 0);
  if (participantIndexes.length > 1) {
    issues.push({
      severity: "warning",
      message: "More than one Participants module is present. Use this only if you really need staged participant logic."
    });
  }

  const firstDiscussionIndex = normalizedBlocks.findIndex((block) => block.type === "DISCUSSION");
  participantIndexes.forEach((participantIndex) => {
    if (firstDiscussionIndex >= 0 && participantIndex > firstDiscussionIndex) {
      issues.push({
        severity: "error",
        message: "Participants modules must come before the first Discussion module."
      });
    }
  });

  if (!startIndexes.length) {
    issues.push({
      severity: "error",
      message: "Template must include a Start module as the first module."
    });
  }

  if (!participantIndexes.length) {
    issues.push({
      severity: "warning",
      message: "No Participants module defined. Participant sourcing is implicit."
    });
  }

  normalizedBlocks.forEach((block, index) => {
    const position = index + 1;
    if (block.type !== "START" && (!Number.isFinite(block.durationSeconds) || block.durationSeconds < 1)) {
      issues.push({
        severity: "error",
        message: `Module ${position} (${block.type}) must have a duration of at least 1 second.`
      });
    }

    if (block.type === "START") {
      if (block.startMode === "specific_datetime") {
        if (!block.startDate || !block.startTime) {
          issues.push({
            severity: "error",
            message: "Start module with specific date/time requires both date and time."
          });
        }
      }
      if (block.startMode === "when_x_join" && !block.requiredParticipants) {
        issues.push({
          severity: "error",
          message: "Start module with 'when X join' requires the participant count."
        });
      }
      if (
        block.startMode === "when_x_join_and_datetime" &&
        (!block.requiredParticipants || !block.startDate || !block.startTime)
      ) {
        issues.push({
          severity: "error",
          message: "Start module with 'when X join and datetime' requires participant count, date, and time."
        });
      }
    }

    if (block.type === "PARTICIPANTS") {
      if (block.participantMode === "manual_selected" && !(block.participantUserIds?.length)) {
        issues.push({
          severity: "error",
          message: "Participants module in manual mode requires selected users."
        });
      }
      if (
        (block.participantMode === "dataspace_invite_all" || block.participantMode === "dataspace_random") &&
        !(block.participantDataspaceIds?.length)
      ) {
        issues.push({
          severity: "error",
          message: "Dataspace participant modes require at least one dataspace."
        });
      }
      if (block.participantMode === "dataspace_random" && !block.participantCount) {
        issues.push({
          severity: "error",
          message: "Random dataspace selection requires a participant count."
        });
      }
      if (block.participantMode === "ai_search_users" && !block.participantQuery?.trim()) {
        issues.push({
          severity: "error",
          message: "AI search participant mode requires a search query."
        });
      }
    }

    if (block.type === "DISCUSSION") {
      if (block.roundMaxParticipants !== null && block.roundMaxParticipants !== undefined && block.roundMaxParticipants < 2) {
        issues.push({
          severity: "error",
          message: "Discussion modules require at least 2 participants per room."
        });
      }
      if (liveAiSupported && block.aiAgentsEnabled && !(block.aiAgentIds?.length)) {
        issues.push({
          severity: "error",
          message: "Discussion modules with AI participants enabled must select at least one AI agent."
        });
      }
    }

    if (block.type === "GROUPING") {
      const previousDiscussion = normalizedBlocks.slice(0, index).some((candidate) => candidate.type === "DISCUSSION");
      const nextDiscussion = normalizedBlocks.slice(index + 1).some((candidate) => candidate.type === "DISCUSSION");
      if (!previousDiscussion && block.matchingMode && block.matchingMode !== "random") {
        issues.push({
          severity: "warning",
          message: "Grouping before the first Discussion has no prior transcript signal, so polarizing or depolarizing modes may not behave as intended."
        });
      }
      if (!nextDiscussion) {
        issues.push({
          severity: "error",
          message: "Grouping must be followed later by a Discussion module, otherwise the room formation has nowhere to apply."
        });
      }
      if (!block.matchingMode) {
        issues.push({
          severity: "warning",
          message: "Grouping has no explicit mode selected. It should be set in the template."
        });
      }
    }

    if (block.type === "PROMPT" && !block.posterId && !(block.posterTitle?.trim() && block.posterContent?.trim())) {
      issues.push({
        severity: "error",
        message: "Prompt modules require either a selected prompt or direct prompt title and content."
      });
    }

    if (block.type === "FORM") {
      if (!block.formQuestion?.trim()) {
        issues.push({
          severity: "error",
          message: "Form modules require a question."
        });
      }
      if (!(block.formChoices?.length)) {
        issues.push({
          severity: "error",
          message: "Form modules require at least one choice."
        });
      }
    }

    if (block.type === "EMBED" && !isValidUrl(block.embedUrl)) {
      issues.push({
        severity: "error",
        message: "Embed modules require a valid URL."
      });
    }

    if (block.type === "HARMONICA" && !isValidUrl(block.harmonicaUrl)) {
      issues.push({
        severity: "error",
        message: "Harmonica modules require a valid URL."
      });
    }
  });

  let segmentCount = 0;
  try {
    const schedule = buildPlanSegmentsFromBlocks(
      new Date("2026-01-01T00:00:00.000Z"),
      normalizedBlocks as PlanBlockInput[]
    );
    segmentCount = schedule.segments.length;
  } catch {
    issues.push({
      severity: "error",
      message: "The template could not be compiled into a runnable schedule."
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalDurationMinutes,
    discussionRounds,
    segmentCount
  };
}
