export const TEMPLATE_BLOCK_TYPES = [
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

export type TemplateBlockType = (typeof TEMPLATE_BLOCK_TYPES)[number];

export type TemplateBlock = {
  type: TemplateBlockType;
  durationSeconds: number;
  startMode?:
    | "specific_datetime"
    | "when_x_join"
    | "organizer_manual"
    | "when_x_join_and_datetime"
    | "random_selection_among_x"
    | null;
  startDate?: string | null;
  startTime?: string | null;
  timezone?: string | null;
  requiredParticipants?: number | null;
  agreementRequired?: boolean | null;
  agreementDeadline?: string | null;
  minimumParticipants?: number | null;
  allowStartBeforeFull?: boolean | null;
  poolSize?: number | null;
  selectedParticipants?: number | null;
  selectionRule?: "random" | null;
  note?: string | null;
  participantMode?:
    | "manual_selected"
    | "dataspace_invite_all"
    | "dataspace_random"
    | "ai_search_users"
    | null;
  participantUserIds?: string[] | null;
  participantDataspaceIds?: string[] | null;
  participantCount?: number | null;
  participantQuery?: string | null;
  participantNote?: string | null;
  roundMaxParticipants?: number | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | null;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
};

export type TemplateDraftSettings = {
  syncMode: "SERVER" | "CLIENT";
  maxParticipantsPerRoom: number;
  allowOddGroup: boolean;
  language: string;
  transcriptionProvider: string;
  timezone: string | null;
  dataspaceId: string | null;
  requiresApproval: boolean;
  capacity: number | null;
};

export type TemplateDraft = {
  id?: string | null;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  settings: TemplateDraftSettings;
  blocks: TemplateBlock[];
};

export function buildDefaultTemplateDraft(): TemplateDraft {
  return {
    id: null,
    name: "New template",
    description: "",
    isPublic: false,
    settings: {
      syncMode: "SERVER",
      maxParticipantsPerRoom: 2,
      allowOddGroup: false,
      language: "EN",
      transcriptionProvider: "DEEPGRAMLIVE",
      timezone: null,
      dataspaceId: null,
      requiresApproval: false,
      capacity: null
    },
    blocks: []
  };
}
