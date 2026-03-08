import { prisma } from "@/lib/prisma";
import { ingestMeetingTranscriptToHub } from "@/lib/transcriptionHubIngest";
import { postEventHubEvent } from "@/lib/eventHub";
import { extractTranscriptTextFromTranscription } from "@/lib/transcriptionHub";
import { canStartProviderWork } from "@/lib/transcriptionLimits";

type RecordingItem = {
  roomId: string;
  sessionId: string;
  filename: string;
  bytes: number;
  updatedAt: string;
  transcriptExists: boolean;
};

type RoomStateResponse = {
  ok?: boolean;
  exists?: boolean;
  participantCount?: number;
};

function normalizeRoomId(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLanguage(code: string) {
  return code === "IT" ? "it" : "en";
}

function getDrVideoBase() {
  return String(process.env.DR_VIDEO_INTERNAL_URL || "http://dr-video:3020").replace(/\/$/, "");
}

function getProviderBase(provider: string) {
  return provider === "VOSK"
    ? String(process.env.VOSK_BASE_URL || "").trim().replace(/\/$/, "")
    : String(process.env.DEEPGRAM_BASE_URL || "").trim().replace(/\/$/, "");
}

async function fetchLatestRecordingForRoom(roomId: string): Promise<RecordingItem | null> {
  const response = await fetch(`${getDrVideoBase()}/api/recordings`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to load dr-video recordings");
  }
  const items = Array.isArray(payload?.items) ? (payload.items as RecordingItem[]) : [];
  const normalizedRoomId = normalizeRoomId(roomId);
  return (
    items
      .filter((item) => normalizeRoomId(item.roomId) === normalizedRoomId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null
  );
}

async function fetchLatestTranscriptArtifactForRoom(roomId: string): Promise<RecordingItem | null> {
  const response = await fetch(`${getDrVideoBase()}/api/recordings`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to load dr-video recordings");
  }
  const items = Array.isArray(payload?.items) ? (payload.items as RecordingItem[]) : [];
  const normalizedRoomId = normalizeRoomId(roomId);
  return (
    items
      .filter((item) => normalizeRoomId(item.roomId) === normalizedRoomId && item.transcriptExists)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null
  );
}

async function downloadExistingTranscript(roomId: string, sessionId: string) {
  const response = await fetch(
    `${getDrVideoBase()}/api/recordings/transcript?roomId=${encodeURIComponent(
      normalizeRoomId(roomId)
    )}&sessionId=${encodeURIComponent(sessionId)}&format=deliberation`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Unable to download existing transcript artifact");
  }
  return await response.json().catch(() => null);
}

async function fetchRoomState(roomId: string): Promise<RoomStateResponse | null> {
  const adminKey = String(process.env.DR_VIDEO_ADMIN_API_KEY || process.env.DR_VIDEO_ACCESS_SECRET || "").trim();
  const response = await fetch(
    `${getDrVideoBase()}/api/rooms/state?roomId=${encodeURIComponent(roomId)}`,
    {
      headers: adminKey ? { "x-api-key": adminKey } : {},
      cache: "no-store"
    }
  );
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as RoomStateResponse | null;
}

export async function reconcileMeetingActiveState(meetingId: string, roomId: string) {
  const state = await fetchRoomState(roomId).catch(() => null);
  if (!state) return { reconciled: false, isActive: null as boolean | null };
  const roomEmpty = state.exists === false || Number(state.participantCount || 0) === 0;
  if (!roomEmpty) {
    return { reconciled: false, isActive: true };
  }

  const [recording, artifact] = await Promise.all([
    fetchLatestRecordingForRoom(roomId).catch(() => null),
    fetchLatestTranscriptArtifactForRoom(roomId).catch(() => null)
  ]);
  if (!recording && !artifact) {
    return { reconciled: false, isActive: true };
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      isActive: false,
      expiresAt: new Date()
    }
  });

  return { reconciled: true, isActive: false };
}

export async function importExistingDrVideoTranscriptForMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      roomId: true,
      language: true,
      transcriptionProvider: true,
      transcript: true
    }
  });
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.transcript?.transcriptJson) {
    return { imported: false, reason: "already_transcribed" as const };
  }

  const artifact = await fetchLatestTranscriptArtifactForRoom(meeting.roomId);
  if (!artifact) {
    return { imported: false, reason: "no_existing_artifact" as const };
  }

  const deliberation = await downloadExistingTranscript(meeting.roomId, artifact.sessionId);
  const transcriptText = extractTranscriptTextFromTranscription(deliberation);
  if (!transcriptText) {
    return { imported: false, reason: "empty_existing_artifact" as const };
  }

  await prisma.meetingTranscript.upsert({
    where: { meetingId: meeting.id },
    update: {
      provider: meeting.transcriptionProvider,
      roundId: artifact.sessionId,
      transcriptText,
      transcriptJson: JSON.stringify(deliberation)
    },
    create: {
      meetingId: meeting.id,
      provider: meeting.transcriptionProvider,
      roundId: artifact.sessionId,
      transcriptText,
      transcriptJson: JSON.stringify(deliberation)
    }
  });

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      transcriptionRoundId: artifact.sessionId
    }
  });

  await ingestMeetingTranscriptToHub({
    meetingId: meeting.id,
    roomId: meeting.roomId,
    sessionId: artifact.sessionId,
    provider: meeting.transcriptionProvider,
    language: meeting.language,
    transcriptText,
    transcriptJson: deliberation,
    startedAt: artifact.updatedAt,
    endedAt: new Date().toISOString(),
    metadata: {
      mirroredBy: "dr-app-existing-recording-import"
    }
  });

  await postEventHubEvent({
    source: "dr-app",
    type: "meeting_existing_transcript_imported",
    severity: "info",
    message: "Imported existing dr-video transcript artifact for meeting",
    meetingId: meeting.id,
    payload: {
      provider: meeting.transcriptionProvider,
      sessionId: artifact.sessionId
    }
  }).catch(() => null);

  return { imported: true, sessionId: artifact.sessionId };
}

async function downloadRecordingBlob(roomId: string, sessionId: string, filename: string) {
  const response = await fetch(
    `${getDrVideoBase()}/api/recordings/file?roomId=${encodeURIComponent(normalizeRoomId(roomId))}&sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Unable to download meeting recording");
  }
  const bytes = await response.arrayBuffer();
  return new File([bytes], filename || `${sessionId}.webm`, { type: "audio/webm" });
}

async function createRound(baseUrl: string, meetingTitle: string, language: string) {
  const response = await fetch(`${baseUrl}/api/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${meetingTitle} - Meeting`,
      description: "Meeting recording transcription",
      language
    }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.round?.id) {
    throw new Error(payload?.error ?? "Unable to create transcription round");
  }
  return String(payload.round.id);
}

async function pollRoundTranscription(baseUrl: string, roundId: string, timeoutMs = 180000, stepMs = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${baseUrl}/api/rounds/${encodeURIComponent(roundId)}/transcription`, {
      cache: "no-store"
    });
    if (response.ok) {
      return await response.json().catch(() => null);
    }
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  throw new Error("Timed out waiting for transcription");
}

export async function startPostCallMeetingTranscription(meetingId: string, provider: "VOSK" | "DEEPGRAM") {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      title: true,
      roomId: true,
      language: true,
      transcriptionProvider: true,
      transcript: true
    }
  });

  if (!meeting) throw new Error("Meeting not found");
  if (meeting.transcript) return { started: false, reason: "already_transcribed" as const };

  if (provider === "DEEPGRAM") {
    const imported = await importExistingDrVideoTranscriptForMeeting(meetingId);
    if (imported.imported || imported.reason === "already_transcribed") {
      return { started: false, reason: "already_done" as const };
    }
  }

  const existing = await prisma.transcriptionJob.findFirst({
    where: {
      meetingId,
      kind: "MEETING",
      provider,
      status: { in: ["PENDING", "RUNNING", "DONE", "FAILED"] }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    if (existing.status === "FAILED" && existing.lastError === "Meeting recording not found") {
      await prisma.transcriptionJob.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          lastError: "Waiting for meeting recording"
        }
      });
      return { started: false, reason: "waiting_for_recording" as const, jobId: existing.id };
    }
    if (existing.status === "PENDING") {
      const capacity = await canStartProviderWork(provider);
      if (!capacity.allowed) {
        return { started: false, reason: "waiting_for_slot" as const, limit: capacity.limit, active: capacity.active };
      }
      await prisma.transcriptionJob.update({
        where: { id: existing.id },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastError: null
        }
      });
      void processMeetingTranscriptionJob(existing.id, provider);
      return { started: true, jobId: existing.id };
    }
    return {
      started: false,
      reason:
        existing.status === "DONE"
          ? ("already_done" as const)
          : existing.status === "FAILED"
            ? ("already_failed" as const)
            : ("already_running" as const)
    };
  }

  const capacity = await canStartProviderWork(provider);
  const initialStatus = capacity.allowed ? "RUNNING" : "PENDING";
  const job = await prisma.transcriptionJob.create({
    data: {
      kind: "MEETING",
      status: initialStatus,
      provider,
      meetingId,
      attempts: initialStatus === "RUNNING" ? 1 : 0,
      lastAttemptAt: initialStatus === "RUNNING" ? new Date() : null,
      lastError: initialStatus === "PENDING" ? `Waiting for ${provider} concurrency slot` : null
    }
  });

  if (initialStatus === "RUNNING") {
    void processMeetingTranscriptionJob(job.id, provider);
    return { started: true, jobId: job.id };
  }

  return { started: false, reason: "queued_by_limit" as const, jobId: job.id, limit: capacity.limit, active: capacity.active };
}

async function processMeetingTranscriptionJob(jobId: string, provider: "VOSK" | "DEEPGRAM") {
  const baseUrl = getProviderBase(provider);
  if (!baseUrl) {
    await prisma.transcriptionJob.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: `${provider} service is not configured` }
    });
    return;
  }

  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    include: { meeting: true }
  });
  if (!job?.meeting) return;

  try {
    const recording = await fetchLatestRecordingForRoom(job.meeting.roomId);
    if (!recording) {
      await postEventHubEvent({
        source: "dr-app",
        type: "meeting_recording_lookup_failed",
        severity: "warning",
        message: "Meeting recording not found for post-call transcription",
        meetingId: job.meeting.id,
        payload: {
          provider,
          roomId: job.meeting.roomId,
          normalizedRoomId: normalizeRoomId(job.meeting.roomId)
        }
      });
      throw new Error("Meeting recording not found");
    }

    const language = normalizeLanguage(job.meeting.language);
    const roundId = await createRound(baseUrl, job.meeting.title, language);
    const audioFile = await downloadRecordingBlob(job.meeting.roomId, recording.sessionId, recording.filename);

    const form = new FormData();
    form.append("audio", audioFile);
    form.append("roundId", roundId);
    form.append("filename", audioFile.name);

    const transcribeResponse = await fetch(`${baseUrl}/api/transcribe`, {
      method: "POST",
      body: form,
      cache: "no-store"
    });
    const transcribePayload = await transcribeResponse.json().catch(() => null);
    if (!transcribeResponse.ok) {
      throw new Error(transcribePayload?.error ?? "Transcription request failed");
    }

    const deliberation =
      provider === "VOSK"
        ? await pollRoundTranscription(baseUrl, roundId)
        : transcribePayload?.deliberation;

    if (!deliberation) {
      throw new Error("Transcription result is missing");
    }

    const transcriptText = extractTranscriptTextFromTranscription(deliberation);

    await prisma.meetingTranscript.upsert({
      where: { meetingId: job.meeting.id },
      update: {
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(deliberation)
      },
      create: {
        meetingId: job.meeting.id,
        provider,
        roundId,
        transcriptText,
        transcriptJson: JSON.stringify(deliberation)
      }
    });

    await prisma.meeting.update({
      where: { id: job.meeting.id },
      data: { transcriptionRoundId: recording.sessionId }
    });

    await ingestMeetingTranscriptToHub({
      meetingId: job.meeting.id,
      roomId: job.meeting.roomId,
      sessionId: recording.sessionId,
      provider,
      language: job.meeting.language,
      transcriptText,
      transcriptJson: deliberation,
      startedAt: recording.updatedAt,
      endedAt: new Date().toISOString(),
      metadata: {
        mirroredBy: "dr-app-post-call",
        roundId
      }
    });

    await prisma.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        roundId,
        lastError: null
      }
    });

    await postEventHubEvent({
      source: "dr-app",
      type: "meeting_transcription_completed",
      severity: "info",
      message: "Post-call meeting transcription completed",
      meetingId: job.meeting.id,
      payload: {
        provider,
        roundId,
        sessionId: recording.sessionId
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Meeting transcription failed";
    const waitingForRecording = errorMessage === "Meeting recording not found";

    await postEventHubEvent({
      source: "dr-app",
      type: waitingForRecording
        ? "meeting_post_call_transcription_waiting_for_recording"
        : "meeting_post_call_transcription_failed",
      severity: waitingForRecording ? "warning" : "error",
      message: waitingForRecording
        ? "Post-call meeting transcription is waiting for the recording"
        : "Post-call meeting transcription failed",
      meetingId: job.meeting.id,
      payload: {
        provider,
        roomId: job.meeting.roomId,
        normalizedRoomId: normalizeRoomId(job.meeting.roomId),
        error: errorMessage
      }
    }).catch(() => null);
    await prisma.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: waitingForRecording ? "PENDING" : "FAILED",
        lastError: waitingForRecording ? "Waiting for meeting recording" : errorMessage
      }
    });

    if (!waitingForRecording) {
      await postEventHubEvent({
        source: "dr-app",
        type: "meeting_transcription_failed",
        severity: "error",
        message: "Post-call meeting transcription failed",
        meetingId: job.meeting.id,
        payload: {
          provider,
          jobId,
          error: errorMessage
        }
      });
    }
  }
}
