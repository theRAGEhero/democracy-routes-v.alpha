export function parseTranscriptJson(raw: string) {
  return JSON.parse(raw);
}

export function extractMeta(parsed: any) {
  const process = parsed?.deliberation_process ?? parsed?.deliberation?.deliberation_process;
  if (!process) return null;
  return {
    identifier: process.identifier ?? null,
    name: process.name ?? null,
    topic: process.topic?.text ?? null,
    sourceFile: process.source_file ?? null,
    duration: process.duration ?? null,
    transcriptionMetadata: process.transcription_metadata ?? null
  };
}

export function extractParticipants(parsed: any) {
  const participants = Array.isArray(parsed?.participants)
    ? parsed.participants
    : Array.isArray(parsed?.deliberation?.participants)
      ? parsed.deliberation.participants
      : [];
  return participants.map((participant: any) => ({
    identifier: participant.identifier ?? null,
    name: participant.name ?? null,
    role: participant.role ?? null
  }));
}

export function extractContributions(parsed: any) {
  const contributions = Array.isArray(parsed?.contributions)
    ? parsed.contributions
    : Array.isArray(parsed?.deliberation?.contributions)
      ? parsed.deliberation.contributions
      : [];
  return contributions.map((contribution: any) => ({
    identifier: contribution.identifier ?? null,
    madeBy: contribution.madeBy ?? null,
    text: contribution.text ?? "",
    startTime: contribution.startTime ?? contribution.start_time ?? null,
    endTime: contribution.endTime ?? contribution.end_time ?? null,
    confidence: contribution.confidence ?? null
  }));
}

export function extractWords(parsed: any) {
  const contributions = Array.isArray(parsed?.contributions)
    ? parsed.contributions
    : Array.isArray(parsed?.deliberation?.contributions)
      ? parsed.deliberation.contributions
      : [];
  const words: Array<{
    word: string;
    start: number | null;
    end: number | null;
    speaker: string | null;
    confidence: number | null;
  }> = [];

  for (const contribution of contributions) {
    const list = Array.isArray(contribution?.words) ? contribution.words : [];
    for (const word of list) {
      words.push({
        word: word?.word ?? word?.text ?? "",
        start: word?.start ?? word?.startTime ?? null,
        end: word?.end ?? word?.endTime ?? null,
        speaker: word?.speaker ?? contribution?.madeBy ?? null,
        confidence: word?.confidence ?? null
      });
    }
  }

  return words;
}
