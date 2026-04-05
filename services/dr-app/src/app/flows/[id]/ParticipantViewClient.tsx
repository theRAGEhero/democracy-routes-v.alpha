"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TranscriptionPanel } from "@/app/meetings/[id]/TranscriptionPanel";
import { MeditationRoundEmbed } from "@/app/flows/[id]/MeditationRoundEmbed";
import { RecordRoundEmbed } from "@/app/flows/[id]/RecordRoundEmbed";
import { buildLegacySegments, buildPlanSegmentsFromBlocks, getSegmentAtTime } from "@/lib/planSchedule";
import { renderPosterHtml } from "@/lib/poster";
import { buildCallJoinUrl, buildDisplayName } from "@/lib/callUrl";
import { logClientInfo, logClientWarn } from "@/lib/clientLog";
import { CallFrame } from "@/components/CallFrame";

type RoundAssignment = {
  roundNumber: number;
  roomId: string;
  partnerLabel: string;
  isBreak: boolean;
  meetingId?: string | null;
};

type Props = {
  planId: string;
  planTitle?: string | null;
  language: string;
  transcriptionProvider: string;
  startAt: string;
  roundDurationMinutes: number;
  roundsCount: number;
  syncMode: "SERVER" | "CLIENT";
  meditationEnabled: boolean;
  meditationAtStart: boolean;
  meditationBetweenRounds: boolean;
  meditationAtEnd: boolean;
  meditationDurationMinutes: number;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
  blocks: Array<{
    id: string;
    type: "START" | "PARTICIPANTS" | "DISCUSSION" | "PAUSE" | "PROMPT" | "NOTES" | "RECORD" | "FORM" | "EMBED" | "GROUPING" | "BREAK" | "HARMONICA" | "DEMBRANE" | "DELIBERAIDE" | "POLIS" | "AGORACITIZENS" | "NEXUSPOLITICS" | "SUFFRAGO";
    durationSeconds: number;
    roundNumber: number | null;
    formQuestion?: string | null;
    formChoices?: Array<{ key: string; label: string }> | null;
    meditationAnimationId?: string | null;
    meditationAudioUrl?: string | null;
    embedUrl?: string | null;
    harmonicaUrl?: string | null;
    matchingMode?: "polar" | "anti" | "random" | null;
    poster: { id: string; title: string; content: string } | null;
  }>;
  roundGroups: Array<{
    roundNumber: number;
    rooms: Array<{ roomId: string; participants: string[]; meetingId?: string | null }>;
  }>;
  assignments: RoundAssignment[];
  baseUrl: string;
  accessTokens: Record<string, string>;
  userEmail: string;
  callDisplayName?: string;
  guestToken?: string | null;
  canSkip?: boolean;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatCountdownHuman(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function normalizeEmbedUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return url.toString();
      }
      const id = url.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function ParticipantViewClient({
  planId,
  planTitle,
  language,
  transcriptionProvider,
  startAt,
  roundDurationMinutes,
  roundsCount,
  syncMode,
  meditationEnabled,
  meditationAtStart,
  meditationBetweenRounds,
  meditationAtEnd,
  meditationDurationMinutes,
  meditationAnimationId,
  meditationAudioUrl,
  blocks,
  roundGroups,
  assignments,
  baseUrl,
  accessTokens,
  userEmail,
  callDisplayName,
  guestToken,
  canSkip = false
}: Props) {
  const startTime = useMemo(() => new Date(startAt).getTime(), [startAt]);
  const [now, setNow] = useState<number | null>(null);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [meetingByRound, setMeetingByRound] = useState<Record<number, string>>({});
  const [liveAssignment, setLiveAssignment] = useState<RoundAssignment | null>(null);
  type MeditationSession = {
    id: string;
    meditationIndex: number;
    roundAfter: number | null;
    transcriptText: string | null;
    createdAt: string;
  };
  const [meditationSessions, setMeditationSessions] = useState<MeditationSession[]>([]);
  const [sendingMeditation, setSendingMeditation] = useState(false);
  const [completedMeditations, setCompletedMeditations] = useState<Set<number>>(
    () => new Set()
  );
  type RecordSession = {
    id: string;
    blockId: string;
    transcriptText: string | null;
    createdAt: string;
  };
  const [recordSessions, setRecordSessions] = useState<RecordSession[]>([]);
  const [sendingRecord, setSendingRecord] = useState(false);
  const [completedRecordBlocks, setCompletedRecordBlocks] = useState<Set<string>>(
    () => new Set()
  );
  type FormResponse = {
    blockId: string;
    choiceKey: string;
    userEmail: string;
    createdAt: string;
  };
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [planRecapFormResponses, setPlanRecapFormResponses] = useState<FormResponse[]>(
    []
  );
  const [sendingForm, setSendingForm] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [textEntry, setTextEntry] = useState("");
  const [textEntryStatus, setTextEntryStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [textBlockId, setTextBlockId] = useState<string | null>(null);
  const [completedTextEntries, setCompletedTextEntries] = useState<Record<string, string>>({});
  const [recapView, setRecapView] = useState<"personal" | "plan">("personal");
  const [planRecapTextEntries, setPlanRecapTextEntries] = useState<
    Array<{ blockId: string; content: string; userEmail: string }>
  >([]);
  const [planRecapMeditations, setPlanRecapMeditations] = useState<
    Array<{ meditationIndex: number; roundAfter: number | null; transcriptText: string; userEmail: string }>
  >([]);
  const [planRecapRecordSessions, setPlanRecapRecordSessions] = useState<
    Array<{ blockId: string; transcriptText: string; userEmail: string }>
  >([]);
  const [planRecapParticipants, setPlanRecapParticipants] = useState<string[]>([]);
  const [planRecapMeetingTranscripts, setPlanRecapMeetingTranscripts] = useState<
    Array<{ meetingId: string; roundNumber: number; participants: string[]; transcriptText: string }>
  >([]);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);
  const lastSavedTextRef = useRef<string>("");
  const [showModal, setShowModal] = useState(false);
  const [autoOpenedModal, setAutoOpenedModal] = useState(false);
  const [meditationMuted, setMeditationMuted] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const autoMatchingRef = useRef<Set<string>>(new Set());
  const lastExecutionLogSignatureRef = useRef<string | null>(null);
  const lastExecutionWarnSignatureRef = useRef<string | null>(null);
  const withGuestToken = (url: string) => {
    if (!guestToken) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}guest_token=${encodeURIComponent(guestToken)}`;
  };
  const guestHeaders: Record<string, string> = guestToken
    ? { "x-guest-token": guestToken }
    : {};

  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks]
  );
  const roundGroupsByNumber = useMemo(
    () => new Map(roundGroups.map((round) => [round.roundNumber, round.rooms])),
    [roundGroups]
  );
  const meetingTranscriptById = useMemo(
    () => new Map(planRecapMeetingTranscripts.map((item) => [item.meetingId, item.transcriptText])),
    [planRecapMeetingTranscripts]
  );

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  useEffect(() => {
    let active = true;
    async function loadSessions() {
      const response = await fetch(withGuestToken(`/api/flows/${planId}/meditation`));
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (!active) return;
      const sessions: MeditationSession[] = Array.isArray(payload?.sessions)
        ? payload.sessions
        : [];
      setMeditationSessions(sessions);
      setCompletedMeditations(
        new Set(sessions.map((session) => session.meditationIndex))
      );
    }
    loadSessions();
    return () => {
      active = false;
    };
  }, [planId]);

  useEffect(() => {
    let active = true;
    async function loadRecordSessions() {
      const response = await fetch(withGuestToken(`/api/flows/${planId}/record`));
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (!active) return;
      const sessions: RecordSession[] = Array.isArray(payload?.sessions)
        ? payload.sessions
        : [];
      setRecordSessions(sessions);
      setCompletedRecordBlocks(new Set(sessions.map((session) => session.blockId)));
    }
    loadRecordSessions();
    return () => {
      active = false;
    };
  }, [planId]);

  const syncServerTime = useCallback(async () => {
    try {
      const response = await fetch(
        withGuestToken(`/api/flows/${planId}/current?include_meetings=1`)
      );
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      const serverNow = Date.parse(payload?.serverNow);
      if (Number.isNaN(serverNow)) return;
      setOffsetMs(serverNow - Date.now());
      if (Array.isArray(payload?.currentRoundMeetings)) {
        setMeetingByRound((prev) => {
          const next = { ...prev };
          payload.currentRoundMeetings.forEach((item: { roomId: string; meetingId: string }) => {
            const assignment = assignments.find((entry) => entry.roomId === item.roomId);
            if (assignment) {
              next[assignment.roundNumber] = item.meetingId;
            }
          });
          return next;
        });
      }
      if (payload?.assignment?.roomId) {
        const base = assignments.find(
          (entry) => entry.roundNumber === payload.assignment.roundNumber
        );
        setLiveAssignment({
          roundNumber: payload.assignment.roundNumber,
          roomId: payload.assignment.roomId,
          meetingId: payload.assignment.meetingId ?? null,
          isBreak: Boolean(payload.assignment.isBreak),
          partnerLabel: base?.partnerLabel ?? "Partner"
        });
        if (payload.assignment.meetingId) {
          setMeetingByRound((prev) => ({
            ...prev,
            [payload.assignment.roundNumber]: payload.assignment.meetingId
          }));
        }
      }
    } catch (error) {
      // keep local timing if server sync fails
    }
  }, [assignments, planId, withGuestToken]);

  useEffect(() => {
    if (syncMode !== "SERVER") return;
    let mounted = true;
    syncServerTime();
    const timer = setInterval(() => {
      if (!mounted) return;
      syncServerTime();
    }, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [syncMode, syncServerTime]);

  const nowValue = now ?? startTime;
  const effectiveNow =
    syncMode === "SERVER" && offsetMs !== null ? nowValue + offsetMs : nowValue;
  const schedule = useMemo(
    () =>
      blocks.length > 0
        ? buildPlanSegmentsFromBlocks(new Date(startAt), blocks)
        : buildLegacySegments({
            startAt: new Date(startAt),
            roundsCount,
            roundDurationMinutes,
            meditationEnabled,
            meditationAtStart,
            meditationBetweenRounds,
            meditationAtEnd,
            meditationDurationMinutes
          }),
    [
      blocks,
      startAt,
      roundsCount,
      roundDurationMinutes,
      meditationEnabled,
      meditationAtStart,
      meditationBetweenRounds,
      meditationAtEnd,
      meditationDurationMinutes
    ]
  );

  const elapsed = effectiveNow - startTime;
  const currentSegment = getSegmentAtTime(schedule.segments, effectiveNow);
  const currentRoundIndex =
    currentSegment?.type === "DISCUSSION"
      ? currentSegment?.roundNumber ?? 1
      : currentSegment?.roundAfter ?? 1;

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && effectiveNow < schedule.totalEndMs) {
    status = "active";
  } else if (effectiveNow >= schedule.totalEndMs) {
    status = "done";
  }

  useEffect(() => {
    if (status === "active") {
      if (!autoOpenedModal) {
        setShowModal(true);
        setAutoOpenedModal(true);
      }
      return;
    }
    if (showModal) {
      setShowModal(false);
    }
  }, [status, autoOpenedModal, showModal]);

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), roundsCount);
  const segmentStart = currentSegment?.startAtMs ?? startTime;
  const segmentEnd = currentSegment?.endAtMs ?? startTime;
  const secondsLeft = Math.max(0, Math.floor((segmentEnd - effectiveNow) / 1000));

  useEffect(() => {
    if (syncMode === "SERVER") return;
    if (status !== "active") return;

    let mounted = true;

    async function ensureMeetings() {
      try {
        const response = await fetch(
          withGuestToken(`/api/flows/${planId}/current?include_meetings=1`)
        );
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (mounted && Array.isArray(payload?.currentRoundMeetings)) {
          setMeetingByRound((prev) => {
            const next = { ...prev };
            payload.currentRoundMeetings.forEach((item: { roomId: string; meetingId: string }) => {
              const assignment = assignments.find((entry) => entry.roomId === item.roomId);
              if (assignment) {
                next[assignment.roundNumber] = item.meetingId;
              }
            });
            return next;
          });
        }
      } catch (error) {
        // ignore
      }
    }

    ensureMeetings();
    const timer = setInterval(ensureMeetings, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [planId, syncMode, status, assignments]);

  const baseAssignment = assignments.find((item) => item.roundNumber === currentRound);
  const assignment =
    liveAssignment && liveAssignment.roundNumber === currentRound
      ? { ...baseAssignment, ...liveAssignment }
      : baseAssignment;
  const currentMeetingId =
    assignment?.meetingId ?? (assignment ? meetingByRound[assignment.roundNumber] : undefined);
  const liveTranscriptionEnabled = transcriptionProvider === "DEEPGRAMLIVE";
  const recordingEnabled = ["DEEPGRAM", "DEEPGRAMLIVE", "VOSK", "WHISPERREMOTE", "AUTOREMOTE"].includes(
    transcriptionProvider
  );
  const transcriptionLanguageCode = liveTranscriptionEnabled ? (language === "IT" ? "it" : "en") : "";
  const displayName = buildDisplayName(callDisplayName, userEmail);
  const canJoinCall = Boolean(assignment && !assignment.isBreak && currentMeetingId);
  const joinUrl = canJoinCall
    ? buildCallJoinUrl({
        baseUrl,
        roomId: assignment!.roomId,
        meetingId: currentMeetingId!,
        name: displayName,
        autojoin: true,
        embed: true,
        autoRecordVideo: recordingEnabled,
        transcriptionLanguage: transcriptionLanguageCode,
        accessToken: accessTokens[assignment!.roomId]
      })
    : "";

  const meditationActive = status === "active" && currentSegment?.type === "PAUSE";
  const meditationIndex = currentSegment?.meditationIndex ?? 0;
  const roundAfter = currentSegment?.roundAfter ?? null;
  const currentBlock = currentSegment?.blockId ? blockById.get(currentSegment.blockId) : null;
  const currentMeditationAnimationId =
    currentSegment?.type === "PAUSE"
      ? currentBlock?.meditationAnimationId ?? meditationAnimationId
      : meditationAnimationId;
  const currentMeditationAudioUrl =
    currentSegment?.type === "PAUSE"
      ? currentBlock?.meditationAudioUrl ?? meditationAudioUrl
      : meditationAudioUrl;
  const posterActive = status === "active" && currentSegment?.type === "PROMPT";
  const textActive = status === "active" && currentSegment?.type === "NOTES";
  const recordActive = status === "active" && currentSegment?.type === "RECORD";
  const recordIndex = currentSegment?.recordIndex ?? 0;
  const recordBlockId = currentSegment?.blockId ?? null;
  const formActive = status === "active" && currentSegment?.type === "FORM";
  const formBlockId = currentSegment?.blockId ?? null;
  const currentFormBlock = formBlockId ? blockById.get(formBlockId) : null;
  const currentFormChoices = currentFormBlock?.formChoices ?? [];
  const currentFormQuestion = currentFormBlock?.formQuestion ?? "Form";
  const currentFormResponse = formBlockId ? formResponses[formBlockId] : undefined;
  const embedActive = status === "active" && currentSegment?.type === "EMBED";
  const harmonicaActive = status === "active" && currentSegment?.type === "HARMONICA";
  const embedUrlRaw =
    currentSegment?.type === "EMBED" ? currentBlock?.embedUrl ?? "" : "";
  const embedUrl = embedUrlRaw ? normalizeEmbedUrl(embedUrlRaw) : "";
  const harmonicaUrlRaw =
    currentSegment?.type === "HARMONICA" ? currentBlock?.harmonicaUrl ?? "" : "";
  const harmonicaUrl = harmonicaUrlRaw ? normalizeEmbedUrl(harmonicaUrlRaw) : "";
  const experienceContainerClass = showModal
    ? "h-full min-h-0"
    : "min-h-[72vh] h-[72vh]";

  useEffect(() => {
    if (now === null) return;

    const executionSignature = JSON.stringify({
      status,
      segmentType: currentSegment?.type ?? null,
      blockId: currentSegment?.blockId ?? null,
      roundNumber: currentSegment?.roundNumber ?? null,
      roundAfter: currentSegment?.roundAfter ?? null,
      assignmentRoomId: assignment?.roomId ?? null,
      assignmentIsBreak: assignment?.isBreak ?? null,
      meetingId: currentMeetingId ?? null,
      canJoinCall,
      syncMode
    });

    if (lastExecutionLogSignatureRef.current === executionSignature) {
      return;
    }
    lastExecutionLogSignatureRef.current = executionSignature;

    void logClientInfo("flow_execution", "flow_execution_state_changed", {
      planId,
      planTitle,
      userEmail,
      syncMode,
      status,
      segmentType: currentSegment?.type ?? null,
      blockId: currentSegment?.blockId ?? null,
      roundNumber: currentSegment?.roundNumber ?? null,
      roundAfter: currentSegment?.roundAfter ?? null,
      currentRound,
      assignmentRoomId: assignment?.roomId ?? null,
      assignmentIsBreak: assignment?.isBreak ?? null,
      meetingId: currentMeetingId ?? null,
      canJoinCall,
      effectiveNow,
      segmentStartsAt: currentSegment?.startAtMs
        ? new Date(currentSegment.startAtMs).toISOString()
        : null,
      segmentEndsAt: currentSegment?.endAtMs
        ? new Date(currentSegment.endAtMs).toISOString()
        : null,
      secondsLeft
    });
  }, [
    now,
    status,
    currentSegment?.type,
    currentSegment?.blockId,
    currentSegment?.roundNumber,
    currentSegment?.roundAfter,
    assignment?.roomId,
    assignment?.isBreak,
    currentMeetingId,
    canJoinCall,
    syncMode,
    planId,
    planTitle,
    userEmail,
    currentRound,
    effectiveNow,
    secondsLeft
  ]);

  useEffect(() => {
    if (now === null) return;
    if (!(status === "active" && currentSegment?.type === "DISCUSSION" && !assignment)) {
      lastExecutionWarnSignatureRef.current = null;
      return;
    }

    const warnSignature = JSON.stringify({
      status,
      segmentType: currentSegment.type,
      blockId: currentSegment.blockId ?? null,
      currentRound
    });
    if (lastExecutionWarnSignatureRef.current === warnSignature) {
      return;
    }
    lastExecutionWarnSignatureRef.current = warnSignature;

    void logClientWarn("flow_execution", "flow_execution_pairing_without_assignment", {
      planId,
      planTitle,
      userEmail,
      currentRound,
      blockId: currentSegment.blockId ?? null,
      effectiveNow
    });
  }, [
    now,
    status,
    currentSegment?.type,
    currentSegment?.blockId,
    assignment,
    currentRound,
    planId,
    planTitle,
    userEmail,
    effectiveNow
  ]);

  useEffect(() => {
    if (!canSkip) return;
    if (status !== "active" || currentSegment?.type !== "GROUPING") return;
    const blockId = currentSegment.blockId ?? `segment-${currentSegment.startAtMs}`;
    if (autoMatchingRef.current.has(blockId)) return;
    autoMatchingRef.current.add(blockId);
    const mode =
      currentBlock?.matchingMode === "anti"
        ? "anti"
        : currentBlock?.matchingMode === "random"
          ? "random"
          : "polar";
    const runMatching = async () => {
      try {
        void logClientInfo("flow_execution", "flow_execution_matching_autorun_started", {
          planId,
          blockId,
          mode
        });
        const response = await fetch(withGuestToken(`/api/flows/${planId}/matching/run`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...guestHeaders
          },
          body: JSON.stringify({ mode })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          void logClientWarn("flow_execution", "flow_execution_matching_autorun_failed", {
            planId,
            blockId,
            mode,
            responseStatus: response.status,
            payload
          });
          return;
        }
        void logClientInfo("flow_execution", "flow_execution_matching_autorun_completed", {
          planId,
          blockId,
          mode,
          appliedRoundNumber: payload?.appliedRoundNumber ?? null,
          roomCount: Array.isArray(payload?.rooms) ? payload.rooms.length : null
        });
      } catch (error) {
        logClientWarn("flow_execution", "flow_execution_matching_autorun_failed", {
          planId,
          blockId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    void runMatching();
  }, [
    canSkip,
    currentSegment?.type,
    currentSegment?.blockId,
    currentSegment?.startAtMs,
    currentBlock?.matchingMode,
    guestHeaders,
    planId,
    status,
    withGuestToken
  ]);

  useEffect(() => {
    if (meditationActive) {
      setMeditationMuted(false);
    }
  }, [meditationActive, meditationIndex]);

  useEffect(() => {
    if (!formActive || !formBlockId) return;
    const blockId = formBlockId;
    let active = true;
    async function loadFormResponse() {
      try {
        const response = await fetch(
          withGuestToken(`/api/flows/${planId}/forms/${blockId}/response`)
        );
        const payload = await response.json().catch(() => null);
        if (!active) return;
        if (response.ok && payload?.choiceKey) {
          setFormResponses((prev) => ({ ...prev, [blockId]: payload.choiceKey }));
          setFormStatus("saved");
        } else {
          setFormStatus("idle");
        }
      } catch {
        if (active) setFormStatus("idle");
      }
    }
    loadFormResponse();
    return () => {
      active = false;
    };
  }, [formActive, formBlockId, planId]);

  async function handleFormSelect(choiceKey: string) {
    if (!formBlockId || sendingForm) return;
    const blockId = formBlockId;
    setSendingForm(true);
    setFormStatus("saving");
    try {
      const response = await fetch(
        withGuestToken(`/api/flows/${planId}/forms/${blockId}/response`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...guestHeaders },
          body: JSON.stringify({ choiceKey })
        }
      );
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setFormResponses((prev) => ({ ...prev, [blockId]: choiceKey }));
        setFormStatus("saved");
      } else {
        setFormStatus("error");
        void logClientWarn("plan_form_response", "Unable to save form response", {
          planId,
          blockId,
          responseStatus: response.status,
          payload
        });
      }
    } catch {
      setFormStatus("error");
    } finally {
      setSendingForm(false);
    }
  }

  const experienceBody = posterActive ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d1016] via-[#121a24] to-[#0b0f16] px-6 py-12 ${experienceContainerClass}`}
    >
      <div
        className="prose max-w-3xl text-center text-slate-100"
        style={{ fontFamily: "var(--font-serif)" }}
        data-poster
        dangerouslySetInnerHTML={{
          __html: renderPosterHtml(
            currentBlock?.poster?.content ?? "Prompt content missing."
          )
        }}
      />
    </div>
  ) : textActive ? (
    <div
      className={`rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c1b18] via-[#141311] to-[#0f0e0c] px-6 py-8 shadow-[0_30px_70px_rgba(15,23,42,0.35)] ${experienceContainerClass}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/70">
            Notes
          </p>
          <p className="mt-1 text-xs text-amber-100/60">
            Write freely. Autosave keeps your draft safe while the block is active.
          </p>
        </div>
        <p className="text-xs text-amber-100/60">
          {textEntryStatus === "saving" && "Saving..."}
          {textEntryStatus === "saved" && "Saved"}
          {textEntryStatus === "error" && "Save failed"}
          {textEntryStatus === "loading" && "Loading..."}
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-amber-100/10 bg-[#f7f2e8] p-5 text-[#2a241d] shadow-inner">
        <textarea
          value={textEntry}
          onChange={(event) => setTextEntry(event.target.value)}
          className="min-h-[360px] w-full resize-none bg-transparent font-serif text-lg leading-relaxed text-[#2a241d] placeholder:text-[#8a7f72] focus:outline-none"
          placeholder="Begin writing..."
          style={{ fontFamily: "var(--font-serif)" }}
        />
      </div>
    </div>
  ) : formActive ? (
    <div
      className={`rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] via-[#0f172a] to-[#0b1220] px-6 py-10 text-slate-100 ${experienceContainerClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/70">
            Form
          </p>
          <h2 className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            {currentFormQuestion || "Question"}
          </h2>
        </div>
        <p className="text-xs text-slate-300/70">
          {formStatus === "saving" && "Saving..."}
          {formStatus === "saved" && "Saved"}
          {formStatus === "error" && "Save failed"}
        </p>
      </div>
      <div className="mt-6 grid gap-3">
        {currentFormChoices.length === 0 ? (
          <p className="text-sm text-slate-300/70">No options configured.</p>
        ) : (
          currentFormChoices.map((choice) => {
            const isSelected = currentFormResponse === choice.key;
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => handleFormSelect(choice.key)}
                disabled={Boolean(currentFormResponse) || sendingForm}
                className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition ${
                  isSelected
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-slate-100 hover:border-white/30"
                } ${Boolean(currentFormResponse) ? "cursor-default opacity-80" : ""}`}
              >
                {choice.label}
              </button>
            );
          })
        )}
      </div>
      {currentFormResponse ? (
        <p className="mt-4 text-xs text-emerald-200/80">Response saved.</p>
      ) : null}
    </div>
  ) : embedActive ? (
    <div
      className={`overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 ${experienceContainerClass} ${
        showModal ? "flex min-h-0 flex-col" : ""
      }`}
    >
      {embedUrl ? (
        <CallFrame
          src={embedUrl}
          title="Embedded content"
          className={`w-full ${showModal ? "flex-1 min-h-0" : "h-[72vh]"}`}
          frameClassName="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-300">
          Embed URL missing or invalid.
        </div>
      )}
    </div>
  ) : harmonicaActive ? (
    <div
      className={`overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 ${experienceContainerClass} ${
        showModal ? "flex min-h-0 flex-col" : ""
      }`}
    >
      {harmonicaUrl ? (
        <CallFrame
          src={harmonicaUrl}
          title="Harmonica"
          className={`w-full ${showModal ? "flex-1 min-h-0" : "h-[72vh]"}`}
          frameClassName="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-300">
          Harmonica URL missing or invalid.
        </div>
      )}
    </div>
  ) : status === "active" && currentSegment?.type === "START" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Start
        </p>
        <p className="mt-3 text-lg">
          Placeholder start module. Scheduling and activation logic will be added later.
        </p>
      </div>
    </div>
  ) : status === "active" && currentSegment?.type === "PARTICIPANTS" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Participants
        </p>
        <p className="mt-3 text-lg">
          Placeholder participants module. Selection and invitation logic will be added later.
        </p>
      </div>
    </div>
  ) : status === "active" && currentSegment?.type === "BREAK" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Break
        </p>
        <p className="mt-3 text-lg">
          Take a pause. This block intentionally leaves space with no additional interaction.
        </p>
      </div>
    </div>
  ) : status === "active" && ["DEMBRANE", "DELIBERAIDE", "POLIS", "AGORACITIZENS", "NEXUSPOLITICS", "SUFFRAGO"].includes(currentSegment?.type || "") ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {currentSegment?.type}
        </p>
        <p className="mt-3 text-lg">
          Placeholder partner module. No dedicated interaction is configured yet.
        </p>
      </div>
    </div>
  ) : meditationActive ? (
    <MeditationRoundEmbed
      meditationIndex={meditationIndex}
      roundAfter={roundAfter}
      endsAtMs={segmentEnd}
      animationId={currentMeditationAnimationId}
      audioUrl={currentMeditationAudioUrl}
      isMuted={meditationMuted}
      onComplete={handleMeditationComplete}
      className={experienceContainerClass}
    />
  ) : recordActive ? (
    recordBlockId && completedRecordBlocks.has(recordBlockId) ? (
      <div
        className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
      >
        <p className="text-lg">Recording saved.</p>
      </div>
    ) : (
      <RecordRoundEmbed
        recordIndex={recordIndex}
        endsAtMs={segmentEnd}
        onComplete={handleRecordComplete}
        className={experienceContainerClass}
      />
    )
  ) : status === "active" && assignment && !assignment.isBreak ? (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80 ${experienceContainerClass} ${
        showModal ? "flex min-h-0 flex-col" : ""
      }`}
    >
      {canJoinCall ? (
        <CallFrame
          src={joinUrl}
          title="Call"
          className={`w-full ${showModal ? "flex-1 min-h-0" : "h-[72vh]"}`}
          frameClassName="w-full h-full"
          allow="camera; microphone; fullscreen"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-300">
          Preparing your meeting link…
        </div>
      )}
    </div>
  ) : status === "pending" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <div>
        <p className="text-lg">Waiting for the plan to start.</p>
        <p className="mt-2 text-sm text-slate-400">
          Starts in {formatCountdownHuman(Math.max(0, Math.floor((startTime - effectiveNow) / 1000)))}
        </p>
      </div>
    </div>
  ) : assignment?.isBreak ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <p className="text-lg">This discussion round is a break for you.</p>
    </div>
  ) : status === "done" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <p className="text-lg">Template finished.</p>
    </div>
  ) : null;


  useEffect(() => {
    if (!textActive || !currentSegment?.blockId) {
      setTextEntry("");
      setTextEntryStatus("idle");
      setTextBlockId(null);
      lastSavedTextRef.current = "";
      return;
    }

    let active = true;
    setTextEntryStatus("loading");
    setTextBlockId(currentSegment.blockId);
    async function loadEntry() {
      const response = await fetch(
        withGuestToken(`/api/flows/${planId}/blocks/${currentSegment.blockId}/text`)
      );
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.ok) {
        const content = payload?.entry?.content ?? "";
        setTextEntry(content);
        lastSavedTextRef.current = content;
        setTextEntryStatus("saved");
      } else {
        setTextEntryStatus("error");
      }
    }
    loadEntry();
    return () => {
      active = false;
    };
  }, [planId, currentSegment?.blockId, textActive]);

  useEffect(() => {
    if (!textActive || !textBlockId) return;
    if (textEntryStatus === "loading") return;
    if (textEntry === lastSavedTextRef.current) return;
    const timer = setTimeout(async () => {
      setTextEntryStatus("saving");
      const response = await fetch(withGuestToken(`/api/flows/${planId}/blocks/${textBlockId}/text`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...guestHeaders },
        body: JSON.stringify({ content: textEntry })
      });
      if (response.ok) {
        lastSavedTextRef.current = textEntry;
        setTextEntryStatus("saved");
      } else {
        setTextEntryStatus("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [textEntry, textActive, textBlockId, planId, textEntryStatus]);

  useEffect(() => {
    if (status !== "done") return;
    const textBlockIds = schedule.segments
      .filter((segment) => segment.type === "NOTES" && segment.blockId)
      .map((segment) => segment.blockId as string);
    if (textBlockIds.length === 0) return;

    let active = true;
    async function loadCompletedTextEntries() {
      const entries = await Promise.all(
        textBlockIds.map(async (blockId) => {
          const response = await fetch(
            withGuestToken(`/api/flows/${planId}/blocks/${blockId}/text`)
          );
          const payload = await response.json().catch(() => null);
          if (!response.ok) return [blockId, ""] as const;
          return [blockId, payload?.entry?.content ?? ""] as const;
        })
      );
      if (!active) return;
      const next: Record<string, string> = {};
      entries.forEach(([blockId, content]) => {
        next[blockId] = content;
      });
      setCompletedTextEntries(next);
    }
    loadCompletedTextEntries();
    return () => {
      active = false;
    };
  }, [status, schedule.segments, planId]);

  async function refreshPlanRecap() {
    setRecapLoading(true);
    setRecapError(null);
    const response = await fetch(withGuestToken(`/api/flows/${planId}/recap?refresh=1`));
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setRecapError("Unable to load plan recap.");
      setRecapLoading(false);
      return;
    }
    setPlanRecapTextEntries(payload?.textEntries ?? []);
    setPlanRecapMeditations(payload?.meditationSessions ?? []);
    setPlanRecapRecordSessions(payload?.recordSessions ?? []);
    setPlanRecapFormResponses(payload?.formResponses ?? []);
    setPlanRecapMeetingTranscripts(payload?.meetingTranscripts ?? []);
    setPlanRecapParticipants(payload?.participants ?? []);
    setRecapLoading(false);
  }

  useEffect(() => {
    if (status !== "done") return;
    if (
      planRecapTextEntries.length > 0 ||
      planRecapMeditations.length > 0 ||
      planRecapRecordSessions.length > 0 ||
      planRecapFormResponses.length > 0 ||
      planRecapMeetingTranscripts.length > 0
    ) {
      return;
    }
    refreshPlanRecap();
  }, [
    planId,
    status,
    planRecapTextEntries.length,
    planRecapMeditations.length,
    planRecapRecordSessions.length,
    planRecapFormResponses.length,
    planRecapMeetingTranscripts.length
  ]);

  async function handleMeditationComplete(
    audio: Blob,
    index: number,
    roundAfterValue: number | null
  ) {
    if (completedMeditations.has(index)) return;
    if (!audio || audio.size === 0) return;
    setSendingMeditation(true);
    const formData = new FormData();
    formData.append("audio", audio, `meditation-${index}.webm`);
    formData.append("meditationIndex", String(index));
    if (roundAfterValue) {
      formData.append("roundAfter", String(roundAfterValue));
    }
    const response = await fetch(withGuestToken(`/api/flows/${planId}/meditation/transcribe`), {
      method: "POST",
      headers: guestHeaders,
      body: formData
    });
    const payload = await response.json().catch(() => null);
    setSendingMeditation(false);
    if (!response.ok) return;
    setMeditationSessions((prev) => [
      ...prev,
      {
        id: payload.id,
        meditationIndex: payload.meditationIndex,
        roundAfter: payload.roundAfter ?? null,
        transcriptText: payload.transcriptText ?? null,
        createdAt: new Date().toISOString()
      }
    ]);
    setCompletedMeditations((prev) => new Set([...prev, index]));
  }

  async function handleRecordComplete(audio: Blob, index: number | null) {
    if (!recordBlockId) return;
    if (completedRecordBlocks.has(recordBlockId)) return;
    if (!audio || audio.size === 0) return;
    setSendingRecord(true);
    const formData = new FormData();
    formData.append("audio", audio, `record-${index ?? "block"}.webm`);
    formData.append("blockId", recordBlockId);
    const response = await fetch(withGuestToken(`/api/flows/${planId}/record/transcribe`), {
      method: "POST",
      headers: guestHeaders,
      body: formData
    });
    const payload = await response.json().catch(() => null);
    setSendingRecord(false);
    if (!response.ok) return;
    setRecordSessions((prev) => {
      const next = prev.filter((session) => session.blockId !== payload.blockId);
      next.push({
        id: payload.id,
        blockId: payload.blockId,
        transcriptText: payload.transcriptText ?? null,
        createdAt: new Date().toISOString()
      });
      return next;
    });
    setCompletedRecordBlocks((prev) => new Set([...prev, recordBlockId]));
  }

  async function handleSkip() {
    if (skipLoading) return;
    setSkipLoading(true);
    try {
      const response = await fetch(withGuestToken(`/api/flows/${planId}/skip`), {
        method: "POST",
        headers: guestHeaders
      });
      await response.json().catch(() => null);
      await syncServerTime();
    } catch {
      // ignore
    } finally {
      setSkipLoading(false);
    }
  }

  return (
    <div className="dr-card dr-card-no-filter p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            {planTitle ? planTitle : "Template"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
              {language}
            </span>
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
              {transcriptionProvider === "VOSK" ? "Vosk" : "Deepgram"}
            </span>
            <span className="uppercase tracking-[0.18em]">Phase</span>
            <span className="font-semibold text-slate-900">
              {status === "pending" && "Not started"}
              {status === "active" && currentSegment?.type === "PAUSE"
                ? `Pause ${meditationIndex}`
                : null}
              {status === "active" && currentSegment?.type === "START" ? "Start" : null}
              {status === "active" && currentSegment?.type === "PARTICIPANTS" ? "Participants" : null}
              {status === "active" && currentSegment?.type === "PROMPT"
                ? currentBlock?.poster?.title
                  ? `Prompt · ${currentBlock.poster.title}`
                  : "Prompt"
                : null}
              {status === "active" && currentSegment?.type === "NOTES" ? "Notes" : null}
              {status === "active" && currentSegment?.type === "FORM" ? "Form" : null}
              {status === "active" && currentSegment?.type === "EMBED" ? "Embed" : null}
              {status === "active" && currentSegment?.type === "HARMONICA" ? "Harmonica" : null}
              {status === "active" && currentSegment?.type === "RECORD"
                ? `Record ${recordIndex || ""}`.trim()
                : null}
              {status === "active" && currentSegment?.type === "DISCUSSION"
                ? `Discussion ${currentRound} of ${roundsCount}`
                : null}
              {status === "done" && "Finished"}
            </span>
            <span className="uppercase tracking-[0.18em]">Countdown</span>
            <span className="font-semibold text-slate-900">
              {status === "active" ? formatDuration(secondsLeft) : "-"}
            </span>
            <span className="uppercase tracking-[0.18em]">Partner</span>
            <span className="font-semibold text-slate-900">
              {currentSegment?.type === "PAUSE" ? "Solo" : null}
              {currentSegment?.type === "START" ? "Organizer" : null}
              {currentSegment?.type === "PARTICIPANTS" ? "Organizer" : null}
              {currentSegment?.type === "PROMPT" ? "Focus" : null}
              {currentSegment?.type === "NOTES" ? "Your notes" : null}
              {currentSegment?.type === "FORM" ? "Your response" : null}
              {currentSegment?.type === "EMBED" ? "Focus" : null}
              {currentSegment?.type === "HARMONICA" ? "Focus" : null}
              {currentSegment?.type === "RECORD" ? "Solo" : null}
              {currentSegment?.type === "DISCUSSION" ? (assignment ? assignment.partnerLabel : "-") : null}
            </span>
            {status === "pending" ? (
              <span className="text-slate-500">
                Starts in{" "}
                {formatCountdownHuman(Math.max(0, Math.floor((startTime - effectiveNow) / 1000)))}
              </span>
            ) : null}
          </div>
        </div>
        {canSkip && syncMode === "SERVER" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="dr-button-outline px-3 py-1 text-xs"
              disabled={status !== "active" || skipLoading}
            >
              {skipLoading ? "Skipping..." : "Skip phase"}
            </button>
          </div>
        ) : null}
      </div>

      {showModal ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="absolute right-6 top-6 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
      ) : null}

      <div
        className={`mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 ${
          showModal ? "fixed inset-0 z-[10000] m-4 flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={showModal ? "flex-1 min-h-0 overflow-hidden p-3" : "p-3"}>
          {experienceBody}
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/70 px-4 py-2 text-sm ${
            showModal ? "bg-white/90" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Experience</span>
            <span className="text-slate-700">
              {currentSegment?.type === "DISCUSSION"
                ? "Discussion call"
                : currentSegment?.type === "START"
                  ? "Start"
                  : currentSegment?.type === "PARTICIPANTS"
                    ? "Participants"
                : currentSegment?.type === "RECORD"
                  ? "Record"
                  : currentSegment?.type === "FORM"
                    ? "Form"
                    : currentSegment?.type === "EMBED"
                      ? "Embed"
                      : currentSegment?.type === "HARMONICA"
                        ? "Harmonica"
                        : currentSegment?.type ?? "Waiting"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">
              {status === "active" ? formatDuration(secondsLeft) : "-"}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-slate-700">
              {currentSegment?.type === "PAUSE" ? "Solo" : null}
              {currentSegment?.type === "START" ? "Organizer" : null}
              {currentSegment?.type === "PARTICIPANTS" ? "Organizer" : null}
              {currentSegment?.type === "PROMPT" ? "Focus" : null}
              {currentSegment?.type === "NOTES" ? "Your notes" : null}
              {currentSegment?.type === "FORM" ? "Your response" : null}
              {currentSegment?.type === "EMBED" ? "Focus" : null}
              {currentSegment?.type === "HARMONICA" ? "Focus" : null}
              {currentSegment?.type === "RECORD" ? "Solo" : null}
              {currentSegment?.type === "DISCUSSION" ? (assignment ? assignment.partnerLabel : "-") : null}
            </span>
            {meditationActive ? (
              <button
                type="button"
                onClick={() => setMeditationMuted((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-700 hover:text-slate-900"
              >
                {meditationMuted ? "Unmute music" : "Mute music"}
              </button>
            ) : null}
            {recordActive && sendingRecord ? (
              <span className="rounded-full border border-sky-200/60 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase text-sky-700">
                Uploading...
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowModal((prev) => !prev)}
              className="dr-button-outline px-3 py-1 text-xs"
            >
              {showModal ? "Exit immersive" : "Open immersive view"}
            </button>
          </div>
        </div>
      </div>

      <div>
        {status === "active" && currentMeetingId ? (
          <TranscriptionPanel meetingId={currentMeetingId} canManage={false} />
        ) : null}

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Your schedule</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {assignments.map((item) => {
              const meetingId = item.meetingId ?? meetingByRound[item.roundNumber];
              return (
                  <div key={item.roundNumber} className="rounded border border-slate-200 bg-white/70 px-3 py-2">
                  <div className="break-all">
                    Discussion {item.roundNumber}: {item.partnerLabel}{" "}
                    {item.isBreak ? "(break)" : `— ${item.roomId}`}
                  </div>
                  {meetingId ? (
                    <div className="mt-1 text-xs text-slate-600">
                      Meeting record:{" "}
                      <a className="font-semibold text-slate-900 underline" href={`/meetings/${meetingId}`}>
                        /meetings/{meetingId}
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

      {status === "done" ? (
        <div className="mt-10 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Template recap</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Your journey, captured
              </h3>
              <p className="mt-1 text-sm text-slate-600">
              Notes, forms, prompts, and discussion highlights from this plan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setRecapView("personal")}
                  className={`rounded-full px-3 py-1 ${
                    recapView === "personal" ? "bg-slate-900 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => setRecapView("plan")}
                  className={`rounded-full px-3 py-1 ${
                    recapView === "plan" ? "bg-slate-900 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Template view
                </button>
              </div>
              <button
                type="button"
                onClick={refreshPlanRecap}
                className="dr-button-outline px-3 py-1 text-xs"
                disabled={recapLoading}
              >
                {recapLoading ? "Refreshing..." : "Refresh recap"}
              </button>
            </div>
          </div>
          {recapView === "plan" ? (
            <div className="mt-4 text-xs text-slate-500">
              {recapLoading && "Loading plan recap..."}
              {recapError ? recapError : null}
            </div>
          ) : null}
          <div className="mt-6 space-y-4">
            {schedule.segments.map((segment, index) => {
              const durationSeconds = Math.max(
                1,
                Math.floor((segment.endAtMs - segment.startAtMs) / 1000)
              );
              if (segment.type === "DISCUSSION") {
                const roundNumber = segment.roundNumber ?? index + 1;
                const roundAssignment = assignments.find((item) => item.roundNumber === roundNumber);
                const meetingId =
                  roundAssignment?.meetingId ?? (roundAssignment ? meetingByRound[roundAssignment.roundNumber] : undefined);
                const roundRooms = roundGroupsByNumber.get(roundNumber) ?? [];
                return (
                  <div
                    key={`recap-round-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Discussion {roundNumber}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {recapView === "plan" ? "Multiple pairs" : roundAssignment?.partnerLabel || "Partner"}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "personal" && meetingId ? (
                      <div className="mt-2 text-xs text-slate-600">
                        Meeting record:{" "}
                        <a className="font-semibold text-slate-900 underline" href={`/meetings/${meetingId}`}>
                          /meetings/{meetingId}
                        </a>
                      </div>
                    ) : null}
                    {recapView === "personal" && meetingId ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                        <p className="text-xs font-semibold uppercase text-slate-500">Transcript</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {meetingTranscriptById.get(meetingId) || "No transcript available yet."}
                        </p>
                      </div>
                    ) : null}
                    {recapView === "plan" ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {roundRooms.length === 0 ? (
                          <p className="text-sm text-slate-500">No pairings available.</p>
                        ) : (
                          roundRooms.map((room) => (
                            <div key={room.roomId} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                              <p className="text-xs font-semibold uppercase text-slate-400">Room</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {room.participants.join(" & ")}
                              </p>
                              <div className="mt-2 text-xs text-slate-600">
                                {room.meetingId
                                  ? meetingTranscriptById.get(room.meetingId) || "No transcript yet."
                                  : "No transcript yet."}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (segment.type === "PAUSE") {
                const sessions =
                  recapView === "plan"
                    ? planRecapMeditations.filter(
                        (item) => item.meditationIndex === segment.meditationIndex
                      )
                    : meditationSessions
                        .filter((item) => item.meditationIndex === segment.meditationIndex)
                        .map((item) => ({
                          meditationIndex: item.meditationIndex,
                          roundAfter: item.roundAfter,
                          transcriptText: item.transcriptText ?? "",
                          userEmail: userEmail
                        }));
                return (
                  <div
                    key={`recap-meditation-${index}`}
                    className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        Pause {segment.meditationIndex}
                      </p>
                      <p className="text-xs text-emerald-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "plan" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-emerald-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entry = sessions.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.meditationIndex}`}
                                className="rounded border border-emerald-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-emerald-600">
                                  {participant}
                                </p>
                                <p className="mt-1 text-sm text-emerald-900">
                                  {entry?.transcriptText
                                    ? entry.transcriptText
                                    : "No pause transcript."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-900">Transcription saved.</p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-emerald-900">
                        {sessions.map((session, sessionIndex) => (
                          <div key={`${session.userEmail}-${sessionIndex}`} className="rounded border border-emerald-200/60 bg-white/70 px-3 py-2">
                            <p className="mt-1 text-sm text-emerald-900">
                              {session.transcriptText || "Transcription saved."}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (segment.type === "RECORD") {
                const sessions =
                  recapView === "plan" && segment.blockId
                    ? planRecapRecordSessions.filter((item) => item.blockId === segment.blockId)
                    : recordSessions
                        .filter((item) => item.blockId === segment.blockId)
                        .map((item) => ({
                          blockId: item.blockId,
                          transcriptText: item.transcriptText ?? "",
                          userEmail: userEmail
                        }));
                return (
                  <div
                    key={`recap-record-${index}`}
                    className="rounded-2xl border border-sky-200/60 bg-sky-50/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-sky-700">
                        Record {segment.recordIndex ?? ""}
                      </p>
                      <p className="text-xs text-sky-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "personal" ? (
                      <p className="mt-2 text-sm text-sky-900">
                        {sessions[0]?.transcriptText || "Recording saved."}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-sky-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entryItem = sessions.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.blockId}`}
                                className="rounded border border-sky-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-sky-700">
                                  {participant}
                                </p>
                                <p className="mt-1 text-sm text-sky-900">
                                  {entryItem?.transcriptText
                                    ? entryItem.transcriptText
                                    : "No recording transcript."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (segment.type === "FORM") {
                const block = segment.blockId ? blockById.get(segment.blockId) : null;
                const choices = block?.formChoices ?? [];
                const choiceLabel = (key?: string | null) =>
                  choices.find((choice) => choice.key === key)?.label ?? key ?? "";
                const personalChoiceKey = segment.blockId ? formResponses[segment.blockId] : "";
                const planChoices =
                  recapView === "plan" && segment.blockId
                    ? planRecapFormResponses.filter((item) => item.blockId === segment.blockId)
                    : [];
                return (
                  <div
                    key={`recap-form-${index}`}
                    className="rounded-2xl border border-indigo-200/60 bg-indigo-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-indigo-700">
                        Form
                      </p>
                      <p className="text-xs text-indigo-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-indigo-900">
                      {block?.formQuestion || "Question"}
                    </p>
                    {recapView === "personal" ? (
                      <p className="mt-2 text-sm text-indigo-900">
                        {personalChoiceKey
                          ? choiceLabel(personalChoiceKey)
                          : "No response submitted."}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-indigo-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entryItem = planChoices.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.blockId}`}
                                className="rounded border border-indigo-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-indigo-700">
                                  {participant}
                                </p>
                                <p className="mt-1 text-sm text-indigo-900">
                                  {entryItem?.choiceKey
                                    ? choiceLabel(entryItem.choiceKey)
                                    : "No response."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }

                if (segment.type === "PROMPT") {
                  const poster = segment.blockId ? blockById.get(segment.blockId)?.poster : null;
                  return (
                    <div
                      key={`recap-poster-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Prompt{poster?.title ? ` · ${poster.title}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Duration {formatDuration(durationSeconds)}
                        </p>
                      </div>
                      <div
                        className="prose prose-sm mt-3 max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{
                          __html: renderPosterHtml(poster?.content ?? "Prompt content missing.")
                        }}
                      />
                    </div>
                  );
                }

              if (segment.type === "EMBED") {
                const embedBlock = segment.blockId ? blockById.get(segment.blockId) : null;
                const embedLink = embedBlock?.embedUrl ? normalizeEmbedUrl(embedBlock.embedUrl) : "";
                return (
                  <div
                    key={`recap-embed-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Embed</p>
                      <p className="text-xs text-slate-500">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {embedLink ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                        <iframe
                          title="Embedded content"
                          src={embedLink}
                          className="h-56 w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">No embed link.</p>
                    )}
                  </div>
                );
              }

              if (segment.type === "GROUPING") {
                return (
                  <div
                    key={`recap-matching-${index}`}
                    className="rounded-2xl border border-fuchsia-200/60 bg-fuchsia-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-fuchsia-700">Grouping</p>
                      <p className="text-xs text-fuchsia-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-fuchsia-900">
                      Grouping step completed. Check the organizer view for detailed room assignments.
                    </p>
                  </div>
                );
              }

              if (segment.type === "HARMONICA") {
                const harmonicaBlock = segment.blockId ? blockById.get(segment.blockId) : null;
                const harmonicaLink = harmonicaBlock?.harmonicaUrl ? normalizeEmbedUrl(harmonicaBlock.harmonicaUrl) : "";
                return (
                  <div
                    key={`recap-harmonica-${index}`}
                    className="rounded-2xl border border-teal-200/60 bg-teal-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-teal-700">Harmonica</p>
                      <p className="text-xs text-teal-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {harmonicaLink ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-teal-200">
                        <iframe
                          title="Harmonica"
                          src={harmonicaLink}
                          className="h-56 w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-teal-900">No Harmonica link.</p>
                    )}
                  </div>
                );
              }

              if (segment.type === "START") {
                return (
                  <div
                    key={`recap-start-${index}`}
                    className="rounded-2xl border border-zinc-200/60 bg-zinc-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-zinc-700">Start</p>
                      <p className="text-xs text-zinc-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-900">
                      Placeholder start module. Activation rules are not enforced yet.
                    </p>
                  </div>
                );
              }

              if (segment.type === "PARTICIPANTS") {
                return (
                  <div
                    key={`recap-participants-${index}`}
                    className="rounded-2xl border border-stone-200/60 bg-stone-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-stone-700">Participants</p>
                      <p className="text-xs text-stone-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-stone-900">
                      Placeholder participants module. Selection and invitation logic are not enforced yet.
                    </p>
                  </div>
                );
              }

              if (segment.type === "NOTES") {
                const entry = segment.blockId ? completedTextEntries[segment.blockId] : "";
                const blockEntries =
                  recapView === "plan" && segment.blockId
                    ? planRecapTextEntries.filter((item) => item.blockId === segment.blockId)
                    : [];
                return (
                  <div
                    key={`recap-text-${index}`}
                    className="rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-amber-700">Notes</p>
                      <p className="text-xs text-amber-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "personal" ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                        {entry || "No text captured for this block."}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-amber-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entryItem = blockEntries.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.blockId}`}
                                className="rounded border border-amber-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-amber-700">
                                  {participant}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">
                                  {entryItem?.content
                                    ? entryItem.content
                                    : "No text submitted."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }

                return null;
              })}
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
