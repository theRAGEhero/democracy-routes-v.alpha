"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isLiveTranscriptionProvider } from "@/lib/transcriptionProviders";

type UserOption = {
  id: string;
  email: string;
};

type DataspaceOption = {
  id: string;
  name: string;
};

type TemplateBlock = {
  type: string;
  durationSeconds: number;
  roundMaxParticipants?: number | null;
  aiAgentsEnabled?: boolean | null;
  aiAgentIds?: string[] | null;
  aiAgentIntervalSeconds?: number | null;
  aiAgentCooldownSeconds?: number | null;
  aiAgentMaxReplies?: number | null;
  aiAgentPromptOverride?: string | null;
  formQuestion?: string | null;
  formChoices?: Array<{ key: string; label: string }> | null;
  posterId?: string | null;
  posterTitle?: string | null;
  posterContent?: string | null;
  embedUrl?: string | null;
  harmonicaUrl?: string | null;
  matchingMode?: "polar" | "anti" | "random" | null;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
  startMode?: string | null;
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
  participantMode?: string | null;
  participantUserIds?: string[] | null;
  participantDataspaceIds?: string[] | null;
  participantCount?: number | null;
  participantQuery?: string | null;
  participantNote?: string | null;
};

type TemplateSettings = {
  syncMode?: "SERVER" | "CLIENT";
  maxParticipantsPerRoom?: number;
  allowOddGroup?: boolean;
  language?: string;
  transcriptionProvider?: string;
  timezone?: string | null;
  dataspaceId?: string | null;
  requiresApproval?: boolean;
  capacity?: number | null;
};

type Props = {
  users: UserOption[];
  dataspaces: DataspaceOption[];
  currentUserId: string;
  template: {
    id: string;
    name: string;
    description: string | null;
    blocks: TemplateBlock[];
    settings: TemplateSettings | null;
    createdByEmail: string;
    updatedAt: string;
  };
};

function normalizeFormError(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  const formError = payload?.error?.formErrors?.[0];
  if (typeof formError === "string") return formError;
  const fieldErrors = payload?.error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstValue = firstKey ? fieldErrors[firstKey]?.[0] : null;
    if (typeof firstValue === "string") return firstValue;
  }
  return fallback;
}

function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function buildStartAtInput() {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return toDatetimeLocal(nextHour);
}

function formatMinutes(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC"
  });
}

export function FlowFromTemplateClient({
  users,
  dataspaces,
  currentUserId,
  template
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resolvedTimezone, setResolvedTimezone] = useState("UTC");
  const [title, setTitle] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [startAt, setStartAt] = useState("");
  const [admissionMode, setAdmissionMode] = useState<"ALWAYS_OPEN" | "TIME_WINDOW">(
    "ALWAYS_OPEN"
  );
  const [joinOpensAt, setJoinOpensAt] = useState("");
  const [joinClosesAt, setJoinClosesAt] = useState("");
  const [lateJoinMinParticipants, setLateJoinMinParticipants] = useState("3");
  const [timezone, setTimezone] = useState(template.settings?.timezone ?? "");
  const [dataspaceId, setDataspaceId] = useState(template.settings?.dataspaceId ?? "");
  const [openProblemId, setOpenProblemId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(
    Boolean(template.settings?.requiresApproval)
  );
  const [capacity, setCapacity] = useState(
    template.settings?.capacity !== null && template.settings?.capacity !== undefined
      ? String(template.settings.capacity)
      : ""
  );
  const [includeMyself, setIncludeMyself] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setResolvedTimezone(browserTimezone);
    setStartAt((current) => current || buildStartAtInput());
    setTimezone((current) => current || template.settings?.timezone || browserTimezone);
  }, [template.settings?.timezone]);

  useEffect(() => {
    if (openProblemId) return;
    const paramId = searchParams?.get("openProblemId") ?? "";
    if (!paramId) return;
    setOpenProblemId(paramId);
  }, [openProblemId, searchParams]);

  useEffect(() => {
    if (dataspaceId) return;
    const paramId = searchParams?.get("dataspaceId") ?? "";
    if (!paramId) return;
    if (!dataspaces.some((space) => space.id === paramId)) return;
    setDataspaceId(paramId);
  }, [dataspaceId, dataspaces, searchParams]);

  const templateSummary = useMemo(() => {
    const pairingBlocks = template.blocks.filter((block) => block.type === "DISCUSSION");
    const matchingBlocks = template.blocks.filter((block) => block.type === "GROUPING");
    const totalSeconds = template.blocks.reduce(
      (sum, block) => sum + Math.max(0, Number(block.durationSeconds) || 0),
      0
    );
    const firstDiscussionSeconds =
      pairingBlocks.find((block) => Number(block.durationSeconds) > 0)?.durationSeconds ?? 600;
    const firstMatchingMode =
      matchingBlocks.find((block) => block.matchingMode)?.matchingMode ?? null;
    return {
      discussions: pairingBlocks.length,
      totalSeconds,
      firstDiscussionSeconds,
      matchingMode: firstMatchingMode,
      roomSize:
        pairingBlocks.find((block) => typeof block.roundMaxParticipants === "number")
          ?.roundMaxParticipants ??
        template.settings?.maxParticipantsPerRoom ??
        2,
      provider: template.settings?.transcriptionProvider ?? "DEEPGRAM",
      language: template.settings?.language ?? "EN"
    };
  }, [template.blocks, template.settings]);

  const liveAiSupported = isLiveTranscriptionProvider(template.settings?.transcriptionProvider ?? "DEEPGRAM");

  const availableUsers = useMemo(() => {
    const selected = new Set(selectedIds);
    selected.add(currentUserId);
    const invited = new Set(inviteEmails.map((email) => email.toLowerCase()));
    return users.filter((user) => !selected.has(user.id) && !invited.has(user.email.toLowerCase()));
  }, [currentUserId, inviteEmails, selectedIds, users]);

  const suggestions = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return [];
    return availableUsers
      .filter((user) => user.email.toLowerCase().includes(query))
      .slice(0, 8);
  }, [availableUsers, userSearch]);

  const selectedUsers = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return users.filter((user) => selectedSet.has(user.id));
  }, [selectedIds, users]);

  function addSelectedUser(userId: string) {
    setSelectedIds((current) => (current.includes(userId) ? current : [...current, userId]));
  }

  function removeSelectedUser(userId: string) {
    setSelectedIds((current) => current.filter((id) => id !== userId));
  }

  function addInviteEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    if (inviteEmails.includes(normalized)) return;
    setInviteEmails((current) => [...current, normalized]);
    setInviteInput("");
  }

  function removeInviteEmail(email: string) {
    setInviteEmails((current) => current.filter((value) => value !== email));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const participantIds = includeMyself
      ? [currentUserId, ...selectedIds.filter((id) => id !== currentUserId)]
      : [...selectedIds];

    const response = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || "",
        startAt: new Date(startAt).toISOString(),
        admissionMode,
        joinOpensAt:
          admissionMode === "TIME_WINDOW" && joinOpensAt
            ? new Date(joinOpensAt).toISOString()
            : null,
        joinClosesAt:
          admissionMode === "TIME_WINDOW" && joinClosesAt
            ? new Date(joinClosesAt).toISOString()
            : null,
        lateJoinMinParticipants: lateJoinMinParticipants.trim()
          ? Number(lateJoinMinParticipants)
          : null,
        roundDurationMinutes: Math.max(
          1,
          Math.min(240, Math.round(templateSummary.firstDiscussionSeconds / 60))
        ),
        roundsCount: Math.max(1, templateSummary.discussions),
        participantIds,
        inviteEmails,
        syncMode: template.settings?.syncMode === "CLIENT" ? "CLIENT" : "SERVER",
        maxParticipantsPerRoom: Math.max(
          2,
          Math.min(12, Number(template.settings?.maxParticipantsPerRoom ?? 2) || 2)
        ),
        allowOddGroup: Boolean(template.settings?.allowOddGroup),
        dataspaceId: dataspaceId || null,
        openProblemId: openProblemId || null,
        language: template.settings?.language === "IT" ? "IT" : "EN",
        transcriptionProvider:
          template.settings?.transcriptionProvider === "VOSK"
            ? "VOSK"
            : template.settings?.transcriptionProvider === "GLADIALIVE"
              ? "GLADIALIVE"
              : template.settings?.transcriptionProvider === "DEEPGRAMLIVE"
                ? "DEEPGRAMLIVE"
                : "DEEPGRAM",
        timezone: timezone.trim() || resolvedTimezone,
        meditationEnabled: template.blocks.some((block) => block.type === "PAUSE"),
        meditationAtStart: false,
        meditationBetweenRounds: false,
        meditationAtEnd: false,
        meditationDurationMinutes: 5,
        meditationAnimationId: null,
        meditationAudioUrl: null,
        isPublic,
        requiresApproval,
        capacity: capacity.trim() ? Number(capacity) : null,
        blocks: template.blocks.map((block) => ({
          type: block.type,
          durationSeconds: block.durationSeconds,
          startMode: block.startMode ?? null,
          startDate: block.startDate ?? null,
          startTime: block.startTime ?? null,
          timezone: block.timezone ?? null,
          requiredParticipants: block.requiredParticipants ?? null,
          agreementRequired: block.agreementRequired ?? null,
          agreementDeadline: block.agreementDeadline ?? null,
          minimumParticipants: block.minimumParticipants ?? null,
          allowStartBeforeFull: block.allowStartBeforeFull ?? null,
          poolSize: block.poolSize ?? null,
          selectedParticipants: block.selectedParticipants ?? null,
          selectionRule: block.selectionRule ?? null,
          note: block.note ?? null,
          participantMode: block.participantMode ?? null,
          participantUserIds: block.participantUserIds ?? null,
          participantDataspaceIds: block.participantDataspaceIds ?? null,
          participantCount: block.participantCount ?? null,
          participantQuery: block.participantQuery ?? null,
          participantNote: block.participantNote ?? null,
          roundMaxParticipants: block.roundMaxParticipants ?? null,
          aiAgentsEnabled: liveAiSupported ? block.aiAgentsEnabled ?? null : null,
          aiAgentIds: liveAiSupported ? block.aiAgentIds ?? null : null,
          aiAgentIntervalSeconds: liveAiSupported ? block.aiAgentIntervalSeconds ?? null : null,
          aiAgentCooldownSeconds: liveAiSupported ? block.aiAgentCooldownSeconds ?? null : null,
          aiAgentMaxReplies: liveAiSupported ? block.aiAgentMaxReplies ?? null : null,
          aiAgentPromptOverride: liveAiSupported ? block.aiAgentPromptOverride ?? null : null,
          formQuestion: block.formQuestion ?? null,
          formChoices: block.formChoices ?? null,
          posterId: block.posterId ?? null,
          posterTitle: block.posterTitle ?? null,
          posterContent: block.posterContent ?? null,
          embedUrl: block.embedUrl ?? null,
          harmonicaUrl: block.harmonicaUrl ?? null,
          matchingMode: block.matchingMode ?? null,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null
        }))
      })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(normalizeFormError(payload, "Unable to create flow from template."));
      return;
    }

    if (typeof payload?.id === "string") {
      router.push(`/flows/${payload.id}`);
      return;
    }

    setError("Flow created, but redirect failed.");
  }

  return (
    <div className="space-y-6">
      <section className="dr-card space-y-3 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Template execution
        </p>
        <h1
          className="text-2xl font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Create a flow from this template
        </h1>
        <p className="text-sm text-slate-600">
          Runtime settings are editable here. Process logic stays in the template.
        </p>
        {openProblemId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This flow will be linked to the selected open problem.
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <form onSubmit={handleSubmit} className="dr-card space-y-6 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Runtime settings
            </p>
            <h2
              className="mt-2 text-lg font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Editable for this flow
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Flow title
              </span>
              <input
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Description
              </span>
              <textarea
                className="dr-input min-h-[120px] w-full rounded px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Starts at
              </span>
              <input
                type="datetime-local"
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                required
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Timezone
              </span>
              <input
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Europe/Berlin"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Admission
              </span>
              <select
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={admissionMode}
                onChange={(event) =>
                  setAdmissionMode(
                    event.target.value === "TIME_WINDOW" ? "TIME_WINDOW" : "ALWAYS_OPEN"
                  )
                }
              >
                <option value="ALWAYS_OPEN">Always open</option>
                <option value="TIME_WINDOW">Time window</option>
              </select>
            </label>

            {admissionMode === "TIME_WINDOW" ? (
              <>
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Join opens
                  </span>
                  <input
                    type="datetime-local"
                    className="dr-input w-full rounded px-3 py-2 text-sm"
                    value={joinOpensAt}
                    onChange={(event) => setJoinOpensAt(event.target.value)}
                    required
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Join closes
                  </span>
                  <input
                    type="datetime-local"
                    className="dr-input w-full rounded px-3 py-2 text-sm"
                    value={joinClosesAt}
                    onChange={(event) => setJoinClosesAt(event.target.value)}
                    required
                  />
                </label>
              </>
            ) : null}

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Dataspace
              </span>
              <select
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={dataspaceId}
                onChange={(event) => setDataspaceId(event.target.value)}
              >
                <option value="">No dataspace</option>
                {dataspaces.map((dataspace) => (
                  <option key={dataspace.id} value={dataspace.id}>
                    {dataspace.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Capacity
              </span>
              <input
                type="number"
                min="1"
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Late-join minimum
              </span>
              <input
                type="number"
                min="2"
                max="12"
                className="dr-input w-full rounded px-3 py-2 text-sm"
                value={lateJoinMinParticipants}
                onChange={(event) => setLateJoinMinParticipants(event.target.value)}
                placeholder="3"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Participants
            </p>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeMyself}
                onChange={(event) => setIncludeMyself(event.target.checked)}
              />
              Include myself in this flow
            </label>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Add registered users
              </label>
                <input
                  className="dr-input w-full rounded px-3 py-2 text-sm"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search by email"
                />
              {suggestions.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => addSelectedUser(user.id)}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                    >
                      <span>{user.email}</span>
                      <span className="text-xs font-semibold text-slate-500">Add</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => removeSelectedUser(user.id)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                  >
                    {user.email} ×
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Invite by email
              </label>
              <div className="flex gap-2">
                <input
                  className="dr-input w-full rounded px-3 py-2 text-sm"
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                  placeholder="person@example.com"
                />
                <button
                  type="button"
                  onClick={() => addInviteEmail(inviteInput)}
                  className="dr-button-outline px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
              {inviteEmails.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {inviteEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => removeInviteEmail(email)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                    >
                      {email} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Visibility
            </p>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              Public flow
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(event) => setRequiresApproval(event.target.checked)}
              />
              Approval required
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push(`/templates/workspace?mode=modular&templateId=${template.id}`)}
              className="dr-button-outline px-4 py-2 text-sm"
            >
              Customize template
            </button>
            <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
              {loading ? "Creating..." : "Create flow"}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="dr-card space-y-3 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              From template
            </p>
            <h2
              className="text-lg font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {template.name}
            </h2>
            <p className="text-sm text-slate-600">
              {template.description || "No description provided."}
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>Updated</span>
                <span className="text-slate-500">{formatUpdatedAt(template.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Author</span>
                <span className="text-slate-500">{template.createdByEmail}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Discussions</span>
                <span className="text-slate-500">{templateSummary.discussions}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Total duration</span>
                <span className="text-slate-500">{formatMinutes(templateSummary.totalSeconds)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Room size default</span>
                <span className="text-slate-500">{templateSummary.roomSize}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Grouping strategy</span>
                <span className="text-slate-500">
                  {templateSummary.matchingMode === "polar"
                    ? "Polarizing"
                    : templateSummary.matchingMode === "anti"
                      ? "De-polarizing"
                      : templateSummary.matchingMode === "random"
                        ? "Random"
                        : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Language</span>
                <span className="text-slate-500">{templateSummary.language}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Transcription</span>
                <span className="text-slate-500">{templateSummary.provider}</span>
              </div>
            </div>
          </section>

          <section className="dr-card space-y-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Boundary
            </p>
            <p className="text-sm text-slate-600">
              This page schedules and launches a flow. If you want to change the process logic,
              durations, matching, or blocks, use the template builder instead.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
