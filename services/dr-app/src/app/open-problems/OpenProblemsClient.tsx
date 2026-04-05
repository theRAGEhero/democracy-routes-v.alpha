"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  OPEN_PROBLEM_BOARD_STATUSES,
  OPEN_PROBLEM_STATUS_LABELS,
  type OpenProblemStatus
} from "@/lib/openProblemStatus";

type ProblemEntry = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  createdByMe: boolean;
  joinCount: number;
  joinedByMe: boolean;
  dataspaceId: string | null;
  dataspaceName: string | null;
  dataspaceColor: string | null;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type SimilarProblem = {
  id: string;
  title: string;
  description: string;
  createdByEmail?: string | null;
  joinCount?: number | null;
  dataspaceId?: string | null;
  dataspaceName?: string | null;
  dataspaceColor?: string | null;
  similarity: number;
};

type DataspaceOption = {
  id: string;
  name: string;
  color: string | null;
};

type Props = {
  initialProblems: ProblemEntry[];
  dataspaces: DataspaceOption[];
};

type FeedbackProvider = "NONE" | "DEEPGRAM" | "VOSK";

const INITIAL_MESSAGE = "What is your problem or idea?";

const BOARD_META: Array<{
  status: OpenProblemStatus;
  borderClass: string;
  badgeClass: string;
}> = [
  {
    status: "TODO",
    borderClass: "border-slate-200",
    badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  },
  {
    status: "IN_PROGRESS",
    borderClass: "border-sky-200",
    badgeClass: "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
  },
  {
    status: "IN_REVIEW",
    borderClass: "border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
  },
  {
    status: "DONE",
    borderClass: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
  }
];

function formatUpdatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return `Updated ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

function normalizeStatus(value: string): OpenProblemStatus {
  return OPEN_PROBLEM_BOARD_STATUSES.includes(value as OpenProblemStatus)
    ? (value as OpenProblemStatus)
    : "TODO";
}

export function OpenProblemsClient({ initialProblems, dataspaces }: Props) {
  const [problems, setProblems] = useState(
    initialProblems.map((problem) => ({
      ...problem,
      status: normalizeStatus(problem.status)
    }))
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: INITIAL_MESSAGE }
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movingProblemId, setMovingProblemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedDescription, setSuggestedDescription] = useState("");
  const [similarProblems, setSimilarProblems] = useState<SimilarProblem[]>([]);
  const [dataspaceId, setDataspaceId] = useState("");
  const [provider, setProvider] = useState<FeedbackProvider>("NONE");
  const [providerLoading, setProviderLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDataspaceId, setEditDataspaceId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const canPublish = useMemo(() => {
    return suggestedTitle.trim().length >= 3 && suggestedDescription.trim().length >= 10;
  }, [suggestedTitle, suggestedDescription]);

  const groupedProblems = useMemo(() => {
    const groups: Record<OpenProblemStatus, ProblemEntry[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: []
    };

    for (const problem of problems) {
      groups[normalizeStatus(problem.status)].push(problem);
    }

    return groups;
  }, [problems]);

  useEffect(() => {
    let cancelled = false;
    setProviderLoading(true);
    fetch("/api/feedback/transcribe")
      .then((response) => response.json().catch(() => null).then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        if (!ok) {
          setProvider("NONE");
          return;
        }
        setProvider(payload?.provider === "DEEPGRAM" || payload?.provider === "VOSK" ? payload.provider : "NONE");
      })
      .catch(() => {
        if (!cancelled) setProvider("NONE");
      })
      .finally(() => {
        if (!cancelled) setProviderLoading(false);
      });
    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  function startEditing(problem: ProblemEntry) {
    setEditingProblemId(problem.id);
    setEditTitle(problem.title);
    setEditDescription(problem.description);
    setEditDataspaceId(problem.dataspaceId ?? "");
    setError(null);
    setSaveStatus(null);
  }

  function cancelEditing() {
    setEditingProblemId(null);
    setEditTitle("");
    setEditDescription("");
    setEditDataspaceId("");
  }

  function resetComposer() {
    setMessages([{ role: "assistant", text: INITIAL_MESSAGE }]);
    setDraft("");
    setSuggestedTitle("");
    setSuggestedDescription("");
    setSimilarProblems([]);
    setError(null);
    setSaveStatus(null);
  }

  async function handleMicToggle() {
    if (transcribing) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        if (!audioBlob.size) return;
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `open-problem-${Date.now()}.webm`);
          const response = await fetch("/api/feedback/transcribe", {
            method: "POST",
            body: formData
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(payload?.error ?? "Unable to transcribe audio.");
          }
          const transcript = typeof payload?.transcript === "string" ? payload.transcript.trim() : "";
          if (!transcript) throw new Error("No transcript text returned.");
          setDraft((current) => (current.trim() ? `${current}\n\n${transcript}` : transcript));
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : "Unable to transcribe audio.");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(750);
      setRecording(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Microphone access failed.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: "user" as const, text }];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);
    setSaveStatus(null);
    try {
      const response = await fetch("/api/open-problems/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to continue the conversation.");
      }
      const assistantMessage = String(payload?.assistantMessage || "").trim();
      setMessages((current) =>
        assistantMessage ? [...current, { role: "assistant", text: assistantMessage }] : current
      );
      setSuggestedTitle(String(payload?.suggestedTitle || "").trim());
      setSuggestedDescription(String(payload?.suggestedDescription || "").trim());
      setSimilarProblems(Array.isArray(payload?.similarProblems) ? payload.similarProblems : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to continue the conversation.");
    } finally {
      setSending(false);
    }
  }

  async function handlePublish() {
    if (!canPublish || saving) return;
    setSaving(true);
    setError(null);
    setSaveStatus(null);
    try {
      const response = await fetch("/api/open-problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestedTitle,
          description: suggestedDescription,
          dataspaceId: dataspaceId || null,
          messages
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to publish open problem.");
      }
      setProblems((current) => [{ ...(payload as ProblemEntry), status: normalizeStatus(payload.status) }, ...current]);
      resetComposer();
      setDataspaceId("");
      setSaveStatus("Open problem added to Todo.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to publish open problem.");
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(problemId: string) {
    try {
      const response = await fetch(`/api/open-problems/${problemId}/join`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to join open problem.");
      }
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId
            ? {
                ...problem,
                joinedByMe: true,
                joinCount: Number(payload?.joinCount || problem.joinCount)
              }
            : problem
        )
      );
      setSimilarProblems((current) =>
        current.map((problem) =>
          problem.id === problemId
            ? {
                ...problem,
                joinCount: Number(payload?.joinCount || problem.joinCount || 0)
              }
            : problem
        )
      );
      setSaveStatus("You joined the open problem.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to join open problem.");
    }
  }

  async function handleSaveEdit(problemId: string) {
    if (!editTitle.trim() || !editDescription.trim() || editSaving) return;
    setEditSaving(true);
    setError(null);
    setSaveStatus(null);
    try {
      const response = await fetch(`/api/open-problems/${problemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          dataspaceId: editDataspaceId || null
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to update open problem.");
      }
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId ? { ...(payload as ProblemEntry), status: normalizeStatus(payload.status) } : problem
        )
      );
      setSimilarProblems((current) =>
        current.map((problem) =>
          problem.id === problemId
            ? {
                ...problem,
                title: payload.title,
                description: payload.description,
                dataspaceId: payload.dataspaceId,
                dataspaceName: payload.dataspaceName,
                dataspaceColor: payload.dataspaceColor
              }
            : problem
        )
      );
      cancelEditing();
      setSaveStatus("Open problem updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update open problem.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleMoveProblem(problemId: string, status: OpenProblemStatus) {
    if (movingProblemId) return;

    const currentProblem = problems.find((problem) => problem.id === problemId);
    if (!currentProblem || currentProblem.status === status) return;

    const previousStatus = currentProblem.status;
    setMovingProblemId(problemId);
    setError(null);
    setSaveStatus(null);
    setProblems((current) =>
      current.map((problem) => (problem.id === problemId ? { ...problem, status } : problem))
    );

    try {
      const response = await fetch(`/api/open-problems/${problemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to move open problem.");
      }
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId ? { ...(payload as ProblemEntry), status: normalizeStatus(payload.status) } : problem
        )
      );
      setSaveStatus(`Moved to ${OPEN_PROBLEM_STATUS_LABELS[status]}.`);
    } catch (nextError) {
      setProblems((current) =>
        current.map((problem) => (problem.id === problemId ? { ...problem, status: previousStatus } : problem))
      );
      setError(nextError instanceof Error ? nextError.message : "Unable to move open problem.");
    } finally {
      setMovingProblemId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--card)] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Draft</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              New open problem
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Describe the issue first. When you publish it, the card will start in Todo and can be routed through the board.
            </p>
          </div>
          <button
            type="button"
            onClick={resetComposer}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
              <div
                ref={chatScrollRef}
                className="max-h-[420px] space-y-3 overflow-y-auto pr-1 sm:max-h-[520px]"
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        message.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-3 sm:p-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Dataspace
                </label>
                <select
                  value={dataspaceId}
                  onChange={(event) => setDataspaceId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300"
                >
                  <option value="">No dataspace</option>
                  {dataspaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleMicToggle}
                  disabled={provider === "NONE" || providerLoading || transcribing}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    recording
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span>{transcribing ? "Transcribing..." : recording ? "Stop mic" : "Mic"}</span>
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-3 min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300"
                placeholder="Describe what is happening, why it matters, and what kind of conversation you hope to have."
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {provider === "NONE"
                    ? "Mic transcription disabled in admin settings."
                    : `Mic transcription via ${provider}.`}
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="dr-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Draft title</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {suggestedTitle || "Not ready yet"}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Draft description</div>
              <div className="mt-2 text-sm text-slate-700">
                {suggestedDescription || "Continue the conversation to let the assistant shape the draft."}
              </div>
            </div>

            {similarProblems.length > 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Similar active problems
                </div>
                <div className="mt-3 space-y-3">
                  {similarProblems.map((problem) => (
                    <div key={problem.id} className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{problem.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{problem.description}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                              style={{
                                borderColor: problem.dataspaceColor ?? "#cbd5e1",
                                backgroundColor: `${problem.dataspaceColor ?? "#e2e8f0"}22`
                              }}
                            >
                              {problem.dataspaceName || "No dataspace"}
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            {Math.round(problem.similarity * 100)}% similar
                            {problem.createdByEmail ? ` · ${problem.createdByEmail}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoin(problem.id)}
                          className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              Joined participants can move cards across the board. Only the original poster can edit title, description, and dataspace.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || saving}
                className="dr-button px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Publishing..." : "Publish to Todo"}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {saveStatus ? <p className="mt-4 text-sm text-emerald-600">{saveStatus}</p> : null}
      </section>

      <section className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--card)] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Kanban board
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Move problems from Todo to In Progress, then In Review, and finally Done when the route is complete.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {problems.length} total cards
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="grid min-w-[1100px] gap-4 xl:min-w-0 xl:grid-cols-4">
            {BOARD_META.map((column) => {
              const columnProblems = groupedProblems[column.status];
              return (
                <div
                  key={column.status}
                  className={`rounded-[24px] border ${column.borderClass} bg-slate-50/80 p-3`}
                >
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${column.badgeClass}`}>
                      {OPEN_PROBLEM_STATUS_LABELS[column.status]}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{columnProblems.length}</span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {columnProblems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-sm text-slate-500">
                        No cards in {OPEN_PROBLEM_STATUS_LABELS[column.status]}.
                      </div>
                    ) : (
                      columnProblems.map((problem) => (
                        <article key={problem.id} className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {editingProblemId === problem.id ? (
                                <div className="space-y-3">
                                  <input
                                    value={editTitle}
                                    onChange={(event) => setEditTitle(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300"
                                  />
                                  <textarea
                                    value={editDescription}
                                    onChange={(event) => setEditDescription(event.target.value)}
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300"
                                  />
                                  <select
                                    value={editDataspaceId}
                                    onChange={(event) => setEditDataspaceId(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-300"
                                  >
                                    <option value="">No dataspace</option>
                                    {dataspaces.map((space) => (
                                      <option key={space.id} value={space.id}>
                                        {space.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <>
                                  <h3 className="text-sm font-semibold text-slate-900">{problem.title}</h3>
                                  <p className="mt-2 text-sm text-slate-600">{problem.description}</p>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span
                                      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                                      style={{
                                        borderColor: problem.dataspaceColor ?? "#cbd5e1",
                                        backgroundColor: `${problem.dataspaceColor ?? "#e2e8f0"}22`
                                      }}
                                    >
                                      {problem.dataspaceName || "No dataspace"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              {problem.createdByMe ? (
                                editingProblemId === problem.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(problem.id)}
                                      disabled={editSaving || editTitle.trim().length < 3 || editDescription.trim().length < 10}
                                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {editSaving ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditing(problem)}
                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                  >
                                    Edit
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleJoin(problem.id)}
                                  disabled={problem.joinedByMe}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                  {problem.joinedByMe ? "Joined" : "Join"}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {OPEN_PROBLEM_BOARD_STATUSES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleMoveProblem(problem.id, status)}
                                disabled={
                                  problem.status === status ||
                                  movingProblemId === problem.id ||
                                  editingProblemId === problem.id ||
                                  (!problem.createdByMe && !problem.joinedByMe)
                                }
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                  problem.status === status
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {OPEN_PROBLEM_STATUS_LABELS[status]}
                              </button>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            <span>{problem.createdByMe ? "Created by you" : problem.createdByEmail}</span>
                            <span>{problem.joinCount} joined</span>
                            <span>{formatUpdatedLabel(problem.updatedAt)}</span>
                            {problem.joinedByMe ? <span className="font-semibold text-emerald-700">You joined</span> : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
