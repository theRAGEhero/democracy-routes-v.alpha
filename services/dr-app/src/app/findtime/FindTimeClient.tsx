"use client";

import { useEffect, useMemo, useState } from "react";

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label?: string | null;
};

type Participant = {
  id: string;
  name: string;
  availableSlotIds: string[];
};

type MatchResponse = {
  timezone: string;
  slots: Array<
    Slot & {
      availableCount: number;
      unavailableCount: number;
      availableParticipantIds: string[];
      unavailableParticipantIds: string[];
      score: number;
    }
  >;
  bestSlots: Array<
    Slot & {
      availableCount: number;
      unavailableCount: number;
      availableParticipantIds: string[];
      unavailableParticipantIds: string[];
      score: number;
    }
  >;
  participantDirectory: Record<string, { id: string; name: string; availableCount: number }>;
  summary: {
    participantCount: number;
    slotCount: number;
    strongestConsensus: string[];
    topScore: number;
  };
};

const TIMEZONES = ["Europe/Berlin", "Europe/Rome", "UTC", "Europe/London", "America/New_York"];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySlot(): Slot {
  return {
    id: createId("slot"),
    date: new Date().toISOString().slice(0, 10),
    startTime: "18:00",
    endTime: "19:00",
    label: ""
  };
}

function emptyParticipant(): Participant {
  return {
    id: createId("participant"),
    name: "",
    availableSlotIds: []
  };
}

export function FindTimeClient() {
  const [title, setTitle] = useState("Scheduling session");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [slots, setSlots] = useState<Slot[]>([emptySlot()]);
  const [participants, setParticipants] = useState<Participant[]>([emptyParticipant()]);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/findtime/demo", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load findtime demo");
        }
        if (!active) return;
        setTitle(data.title ?? "Scheduling session");
        setTimezone(data.timezone ?? "Europe/Berlin");
        setSlots(data.slots ?? [emptySlot()]);
        setParticipants(data.participants ?? [emptyParticipant()]);
        setResult(data.initialMatch ?? null);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load scheduling demo");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const participantLookup = useMemo(
    () => Object.fromEntries(participants.map((participant) => [participant.id, participant.name || "Unnamed participant"])),
    [participants]
  );

  async function runMatch() {
    setMatching(true);
    setError(null);
    try {
      const response = await fetch("/api/findtime/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          timezone,
          slots,
          participants: participants.map((participant) => ({
            ...participant,
            availableSlotIds: participant.availableSlotIds
          }))
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const issueMessage = Array.isArray(data.issues)
          ? data.issues.map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`).join(" · ")
          : data.error;
        throw new Error(issueMessage || "Unable to calculate matching");
      }
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to calculate matching");
    } finally {
      setMatching(false);
    }
  }

  function updateSlot(slotId: string, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(slotId: string) {
    setSlots((current) => (current.length === 1 ? current : current.filter((slot) => slot.id !== slotId)));
    setParticipants((current) =>
      current.map((participant) => ({
        ...participant,
        availableSlotIds: participant.availableSlotIds.filter((id) => id !== slotId)
      }))
    );
  }

  function updateParticipant(participantId: string, patch: Partial<Participant>) {
    setParticipants((current) =>
      current.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant))
    );
  }

  function removeParticipant(participantId: string) {
    setParticipants((current) => (current.length === 1 ? current : current.filter((participant) => participant.id !== participantId)));
  }

  function toggleAvailability(participantId: string, slotId: string) {
    setParticipants((current) =>
      current.map((participant) => {
        if (participant.id !== participantId) {
          return participant;
        }
        const nextSet = new Set(participant.availableSlotIds);
        if (nextSet.has(slotId)) {
          nextSet.delete(slotId);
        } else {
          nextSet.add(slotId);
        }
        return {
          ...participant,
          availableSlotIds: Array.from(nextSet)
        };
      })
    );
  }

  if (loading) {
    return (
      <div className="dr-card flex min-h-[60dvh] items-center justify-center p-8 text-sm text-slate-600">
        Loading scheduling workspace...
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
      <section className="dr-card space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">FindTime</p>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Shared availability builder
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Basic scheduling workspace for candidate slots, participant availability, and best-slot matching. This is the
              front-end shell we can later wire into templates, `Start`, `Participants`, and meeting planning.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dr-button-outline px-4 py-2 text-sm" onClick={runMatch} disabled={matching}>
              {matching ? "Matching..." : "Recalculate"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_220px]">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Session title
            <input
              className="dr-input w-full rounded-2xl px-4 py-3 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Citizen assembly scheduling"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Timezone
            <select
              className="dr-input w-full rounded-2xl px-4 py-3 text-sm"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {TIMEZONES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Candidate slots
              </h2>
              <button
                type="button"
                className="dr-button-outline px-3 py-2 text-xs"
                onClick={() => setSlots((current) => [...current, emptySlot()])}
              >
                Add slot
              </button>
            </div>
            <div className="space-y-3">
              {slots.map((slot) => (
                <div key={slot.id} className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Date
                      <input
                        type="date"
                        className="dr-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal"
                        value={slot.date}
                        onChange={(event) => updateSlot(slot.id, { date: event.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Label
                      <input
                        className="dr-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal"
                        value={slot.label ?? ""}
                        onChange={(event) => updateSlot(slot.id, { label: event.target.value })}
                        placeholder="Thursday evening"
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Start
                      <input
                        type="time"
                        className="dr-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal"
                        value={slot.startTime}
                        onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      End
                      <input
                        type="time"
                        className="dr-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal"
                        value={slot.endTime}
                        onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" className="text-xs font-medium text-rose-600" onClick={() => removeSlot(slot.id)}>
                      Remove slot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Participant availability
              </h2>
              <button
                type="button"
                className="dr-button-outline px-3 py-2 text-xs"
                onClick={() => setParticipants((current) => [...current, emptyParticipant()])}
              >
                Add participant
              </button>
            </div>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div key={participant.id} className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <label className="min-w-0 flex-1 space-y-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Participant
                      <input
                        className="dr-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal"
                        value={participant.name}
                        onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
                        placeholder="Participant name"
                      />
                    </label>
                    <button
                      type="button"
                      className="pt-7 text-xs font-medium text-rose-600"
                      onClick={() => removeParticipant(participant.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {slots.map((slot) => {
                      const checked = participant.availableSlotIds.includes(slot.id);
                      return (
                        <label
                          key={`${participant.id}-${slot.id}`}
                          className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
                            checked ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white/80"
                          }`}
                        >
                          <span className="min-w-0 pr-3">
                            <span className="block truncate font-medium text-slate-900">{slot.label || slot.date}</span>
                            <span className="block text-xs text-slate-500">
                              {slot.date} · {slot.startTime}-{slot.endTime}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAvailability(participant.id, slot.id)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="dr-card space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Match result</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Best shared slots
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Basic API-backed scoring for the future template scheduling flow.
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Participants</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.participantCount}</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Slots</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.slotCount}</p>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top score</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{result.summary.topScore}</p>
              </div>
            </div>

            <div className="space-y-3">
              {result.bestSlots.map((slot, index) => (
                <div key={slot.id} className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Option {index + 1}</p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{slot.label || slot.date}</h3>
                      <p className="text-sm text-slate-600">
                        {slot.date} · {slot.startTime}-{slot.endTime} · {result.timezone}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      score {slot.score}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <strong>{slot.availableCount}</strong> available
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {slot.availableParticipantIds.map((participantId) => (
                        <span
                          key={participantId}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-slate-700"
                        >
                          {participantLookup[participantId] || result.participantDirectory[participantId]?.name || participantId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next wiring step</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Use this page as the base UI for template `Start` scheduling.</li>
                <li>Connect `Participants` selection to real users and dataspaces.</li>
                <li>Persist sessions and availability in Prisma once the workflow is approved.</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600">
            No match result yet.
          </div>
        )}
      </aside>
    </div>
  );
}
