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

function formatSlot(slot: Slot) {
  const label = new Date(`${slot.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  return `${label} · ${slot.startTime}-${slot.endTime}`;
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
        if (active) setLoading(false);
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
        if (participant.id !== participantId) return participant;
        const next = new Set(participant.availableSlotIds);
        if (next.has(slotId)) next.delete(slotId);
        else next.add(slotId);
        return {
          ...participant,
          availableSlotIds: Array.from(next)
        };
      })
    );
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--card)] p-8 text-center text-sm text-slate-600 shadow-[0_24px_60px_rgba(18,18,18,0.12)] backdrop-blur">
        Loading scheduling workspace...
      </div>
    );
  }

  return (
    <div className="grid gap-7">
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Create a</p>
        <h1
          className="mt-2 text-[clamp(2.4rem,6vw,3.6rem)] font-semibold text-[color:var(--accent-deep)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          TIME
        </h1>
      </header>

      <section className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--card)] p-6 shadow-[0_24px_60px_rgba(18,18,18,0.12)] backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.4rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Give your event a name
            </h2>
            <p className="mt-1 text-sm text-slate-500">Or leave it as a draft while you shape the availability matrix.</p>
          </div>
          <button
            type="button"
            className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(249,115,22,0.25)] transition hover:bg-orange-400"
            onClick={runMatch}
            disabled={matching}
          >
            {matching ? "Matching..." : "Recalculate"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.1fr)_240px]">
          <label className="text-sm font-medium text-slate-700">
            Session title
            <input
              className="dr-input mt-2 w-full rounded-[12px] px-4 py-3 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Brainstorming civic tech"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Timezone
            <select
              className="dr-input mt-2 w-full rounded-[12px] px-4 py-3 text-sm"
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

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[1.1rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  What dates might work?
                </h3>
                <p className="mt-1 text-sm text-slate-500">Create candidate slots directly.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[color:var(--stroke)] bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                onClick={() => setSlots((current) => [...current, emptySlot()])}
              >
                Add slot
              </button>
            </div>

            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-[16px] border border-[color:var(--stroke)] bg-white/75 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
                    <label className="text-xs font-medium text-slate-700">
                      Date
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(event) => updateSlot(slot.id, { date: event.target.value })}
                        className="dr-input mt-2 w-full rounded-[12px] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Start
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })}
                        className="dr-input mt-2 w-full rounded-[12px] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      End
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })}
                        className="dr-input mt-2 w-full rounded-[12px] px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="w-full rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700"
                        onClick={() => removeSlot(slot.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="mt-3 block text-xs font-medium text-slate-700">
                    Label
                    <input
                      value={slot.label ?? ""}
                      onChange={(event) => updateSlot(slot.id, { label: event.target.value })}
                      className="dr-input mt-2 w-full rounded-[12px] px-3 py-2 text-sm"
                      placeholder="Evening option"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[1.1rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                  Participants
                </h3>
                <p className="mt-1 text-sm text-slate-500">Mark availability across all candidate slots.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[color:var(--stroke)] bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                onClick={() => setParticipants((current) => [...current, emptyParticipant()])}
              >
                Add participant
              </button>
            </div>

            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-[16px] border border-[color:var(--stroke)] bg-white/75 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <input
                      className="dr-input w-full rounded-[12px] px-4 py-3 text-sm md:max-w-sm"
                      value={participant.name}
                      onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
                      placeholder="Participant name"
                    />
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700"
                      onClick={() => removeParticipant(participant.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {slots.map((slot) => {
                      const selected = participant.availableSlotIds.includes(slot.id);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => toggleAvailability(participant.id, slot.id)}
                          className={`flex items-center justify-between rounded-[14px] border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{formatSlot(slot)}</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                            {selected ? "Available" : "Free?"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--card)] p-6 shadow-[0_24px_60px_rgba(18,18,18,0.12)] backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.4rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
              Best matches
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Strongest shared windows across the current participants.
            </p>
          </div>
          {result ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white/80 px-3 py-1">
                {result.summary.participantCount} participants
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1">
                {result.summary.slotCount} slots
              </span>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              <h3 className="text-[1.1rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Top ranked slots
              </h3>
              {result.bestSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-[16px] border border-[color:var(--stroke)] bg-white/75 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatSlot(slot)}</p>
                      {slot.label ? <p className="mt-1 text-xs text-slate-500">{slot.label}</p> : null}
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      Score {slot.score}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {slot.availableCount} available
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {slot.unavailableCount} unavailable
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-[1.1rem] font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Full matrix
              </h3>
              <div className="overflow-hidden rounded-[18px] border border-[color:var(--stroke)] bg-white/80">
                <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <div>Slot</div>
                  <div>Available</div>
                  <div>People</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {result.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 px-4 py-3 text-sm text-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{formatSlot(slot)}</p>
                        {slot.label ? <p className="truncate text-xs text-slate-500">{slot.label}</p> : null}
                      </div>
                      <div>{slot.availableCount}</div>
                      <div className="truncate text-xs text-slate-500">
                        {slot.availableParticipantIds
                          .map((participantId) => participantLookup[participantId] || "Unknown")
                          .join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Run matching to see best shared slots.</p>
        )}
      </section>
    </div>
  );
}
