"use client";

import Link from "next/link";
import { useState } from "react";
import { JoinButton } from "@/components/JoinButton";

type MeetingRow = {
  id: string;
  title: string;
  statusLabel: string;
  expiresLabel: string;
  language: string;
  providerLabel: string;
  dataspaceLabel: string;
  dataspaceKey: string;
  isPublic: boolean;
  isHidden: boolean;
  isPast: boolean;
  joinStatus: "JOINED" | "PENDING" | "NONE";
  canJoin: boolean;
  createdByEmail?: string;
  canDelete: boolean;
  canEdit?: boolean;
};

type PlanRow = {
  id: string;
  title: string;
  startLabel: string;
  startAtMs: number;
  isPast: boolean;
  roundsCount: number;
  dataspaceLabel: string;
  dataspaceKey: string;
  isPublic: boolean;
  joinStatus: "JOINED" | "PENDING" | "NONE";
  canJoin: boolean;
  canEdit?: boolean;
};

type TextRow = {
  id: string;
  snippet: string;
  updatedLabel: string;
  isPast: boolean;
  dataspaceLabel: string;
  dataspaceKey: string;
};

type Props = {
  initialMeetings: MeetingRow[];
  dataspaceOptions: Array<{ key: string; label: string }>;
  flows: PlanRow[];
  texts: TextRow[];
  showCreatedBy?: boolean;
  showFlagFilters?: boolean;
};

export function MeetingsTable({
  initialMeetings,
  dataspaceOptions,
  flows,
  texts,
  showCreatedBy = false,
  showFlagFilters = false
}: Props) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(
    initialMeetings.filter((meeting) => !meeting.isPast)
  );
  const [dataspaceFilter, setDataspaceFilter] = useState("all");
  const [mode, setMode] = useState<"MEETINGS" | "PLANS" | "TEXTS">("MEETINGS");
  const [meetingFlagFilter, setMeetingFlagFilter] = useState("all");
  const [planFlagFilter, setPlanFlagFilter] = useState("all");
  const [showPast, setShowPast] = useState(false);

  function filterMeetings(
    list: MeetingRow[],
    nextQuery = query,
    nextDataspace = dataspaceFilter,
    nextFlag = meetingFlagFilter,
    nextShowPast = showPast
  ) {
    const term = nextQuery.trim().toLowerCase();
    return list.filter((meeting) => {
      if (!nextShowPast && meeting.isPast) {
        return false;
      }
      if (nextDataspace !== "all" && meeting.dataspaceKey !== nextDataspace) {
        return false;
      }
      if (nextFlag === "hidden" && !meeting.isHidden) {
        return false;
      }
      if (nextFlag === "public" && !meeting.isPublic) {
        return false;
      }
      if (nextFlag === "private" && meeting.isPublic) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        meeting.title,
        meeting.statusLabel,
        meeting.expiresLabel,
        meeting.language,
        meeting.providerLabel,
        meeting.dataspaceLabel,
        meeting.createdByEmail ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  function applyFilters(
    nextQuery = query,
    nextDataspace = dataspaceFilter,
    nextFlag = meetingFlagFilter,
    nextShowPast = showPast
  ) {
    setFiltered(filterMeetings(meetings, nextQuery, nextDataspace, nextFlag, nextShowPast));
  }

  function handleClear() {
    setQuery("");
    setDataspaceFilter("all");
    setMeetingFlagFilter("all");
    setPlanFlagFilter("all");
    setShowPast(false);
    setFiltered(filterMeetings(meetings, "", "all", "all", false));
  }

  async function handleDelete(meetingId: string) {
    const confirmed = window.confirm("Delete this meeting?");
    if (!confirmed) return;

    setError(null);
    setDeletingId(meetingId);

    const response = await fetch(`/api/meetings/${meetingId}`, {
      method: "DELETE"
    });

    const payload = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete meeting");
      return;
    }

    const nextMeetings = meetings.filter((meeting) => meeting.id !== meetingId);
    setMeetings(nextMeetings);
    setFiltered(filterMeetings(nextMeetings));
  }

  const availableDataspaces = dataspaceOptions.filter((option) => option.key !== "none");

  const filteredPlans = flows.filter((plan) => {
    const term = query.trim().toLowerCase();
    if (!showPast && plan.isPast) {
      return false;
    }
    if (dataspaceFilter !== "all" && plan.dataspaceKey !== dataspaceFilter) {
      return false;
    }
    if (planFlagFilter === "public" && !plan.isPublic) {
      return false;
    }
    if (planFlagFilter === "private" && plan.isPublic) {
      return false;
    }
    if (!term) return true;
    return `${plan.title} ${plan.startLabel} ${plan.roundsCount} ${plan.dataspaceLabel}`
      .toLowerCase()
      .includes(term);
  });

  const filteredTexts = texts.filter((text) => {
    const term = query.trim().toLowerCase();
    if (!showPast && text.isPast) {
      return false;
    }
    if (dataspaceFilter !== "all" && text.dataspaceKey !== dataspaceFilter) {
      return false;
    }
    if (!term) return true;
    return `${text.snippet} ${text.updatedLabel} ${text.dataspaceLabel}`
      .toLowerCase()
      .includes(term);
  });

  return (
    <div className="dr-card">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === "MEETINGS"
                ? "Search meetings..."
                : mode === "PLANS"
                  ? "Search templates..."
                  : "Search texts..."
            }
            className="dr-input w-full rounded px-3 py-2 text-sm"
          />
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("MEETINGS")}
              className={`rounded-full px-3 py-1 font-semibold ${
                mode === "MEETINGS" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Meetings
            </button>
            <button
              type="button"
              onClick={() => setMode("PLANS")}
              className={`rounded-full px-3 py-1 font-semibold ${
                mode === "PLANS" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => setMode("TEXTS")}
              className={`rounded-full px-3 py-1 font-semibold ${
                mode === "TEXTS" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Texts
            </button>
          </div>
          <select
            value={dataspaceFilter}
            onChange={(event) => {
              const value = event.target.value;
              setDataspaceFilter(value);
              if (mode === "MEETINGS") {
                applyFilters(query, value, meetingFlagFilter);
              }
            }}
            className="dr-input w-full rounded px-3 py-2 text-sm sm:w-52"
          >
            <option value="all">All dataspaces</option>
            <option value="none">No dataspace</option>
            {availableDataspaces.map((option) =>
              option.key !== "none" ? (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ) : null
            )}
          </select>
          {showFlagFilters && mode === "MEETINGS" ? (
            <select
              value={meetingFlagFilter}
              onChange={(event) => {
                const value = event.target.value;
                setMeetingFlagFilter(value);
                applyFilters(query, dataspaceFilter, value);
              }}
              className="dr-input w-full rounded px-3 py-2 text-sm sm:w-44"
            >
              <option value="all">All meetings</option>
              <option value="public">Public only</option>
              <option value="private">Private only</option>
              <option value="hidden">Hidden rounds</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const next = !showPast;
              setShowPast(next);
              if (mode === "MEETINGS") {
                applyFilters(query, dataspaceFilter, meetingFlagFilter, next);
              }
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              showPast
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/70 text-slate-600 hover:text-slate-900"
            }`}
          >
            {showPast ? "Showing past" : "Hide past"}
          </button>
          {showFlagFilters && mode === "PLANS" ? (
            <select
              value={planFlagFilter}
              onChange={(event) => setPlanFlagFilter(event.target.value)}
              className="dr-input w-full rounded px-3 py-2 text-sm sm:w-44"
            >
              <option value="all">All templates</option>
              <option value="public">Public only</option>
              <option value="private">Private only</option>
            </select>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (mode === "MEETINGS") {
                  applyFilters();
                }
              }}
              className="dr-button px-3 py-2 text-sm"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="dr-button-outline px-3 py-2 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      {mode === "MEETINGS" ? (
        <div className="overflow-x-auto">
          <div className={`${showCreatedBy ? "min-w-[920px]" : "min-w-[820px]"}`}>
          <div
            className={`grid ${showCreatedBy ? "grid-cols-8" : "grid-cols-7"} gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500`}
          >
            <span className="col-span-2">Title</span>
            <span>Status</span>
            <span>Expires</span>
            <span>Language</span>
            <span>Transcriber</span>
            <span>Dataspace</span>
            <span>Actions</span>
            {showCreatedBy ? <span>Created by</span> : null}
          </div>
          <div className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No meetings yet.</div>
            ) : (
              filtered.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`grid ${showCreatedBy ? "grid-cols-8" : "grid-cols-7"} gap-4 px-4 py-4 text-sm`}
                >
                  <div className="col-span-2">
                    <p className="font-medium text-slate-900">{meeting.title}</p>
                  </div>
                  <div className={meeting.statusLabel === "Active" ? "text-emerald-600" : "text-slate-400"}>
                    {meeting.statusLabel}
                  </div>
                  <div className="text-slate-500">{meeting.expiresLabel}</div>
                  <div className="text-slate-700">{meeting.language}</div>
                  <div className="text-slate-700">{meeting.providerLabel}</div>
                  <div className="text-slate-600">{meeting.dataspaceLabel}</div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {meeting.isPublic ? (
                          <JoinButton
                            resourceType="meeting"
                            resourceId={meeting.id}
                            initialStatus={meeting.joinStatus}
                            canJoin={meeting.canJoin}
                          />
                        ) : null}
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="text-sm font-medium text-slate-900 hover:underline"
                        >
                          View
                      </Link>
                      {meeting.canEdit ? (
                        <Link
                          href={`/meetings/${meeting.id}/edit`}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Edit
                        </Link>
                      ) : null}
                      {meeting.canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(meeting.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                          disabled={deletingId === meeting.id}
                        >
                          {deletingId === meeting.id ? "Deleting..." : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {showCreatedBy ? (
                    <div className="text-slate-600">{meeting.createdByEmail ?? "-"}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      ) : mode === "PLANS" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-6 gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              <span className="col-span-2">Title</span>
              <span>Starts</span>
              <span>Rounds</span>
              <span>Dataspace</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-slate-200">
              {filteredPlans.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No templates found.</div>
              ) : (
                filteredPlans.map((plan) => (
                  <div key={plan.id} className="grid grid-cols-6 gap-4 px-4 py-4 text-sm">
                    <div className="col-span-2">
                      <Link
                        href={`/flows/${plan.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {plan.title}
                      </Link>
                    </div>
                    <div className="text-slate-600">{plan.startLabel}</div>
                    <div className="text-slate-600">{plan.roundsCount}</div>
                    <div className="text-slate-600">{plan.dataspaceLabel}</div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {plan.isPublic ? (
                          <JoinButton
                            resourceType="plan"
                            resourceId={plan.id}
                            initialStatus={plan.joinStatus}
                            canJoin={plan.canJoin}
                          />
                        ) : null}
                        <Link
                          href={`/flows/${plan.id}`}
                          className="text-sm font-medium text-slate-900 hover:underline"
                        >
                          View
                        </Link>
                        {plan.canEdit ? (
                          <Link
                            href={`/flows/${plan.id}/edit`}
                            className="text-sm font-medium text-slate-600 hover:underline"
                          >
                            Edit
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-4 gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              <span className="col-span-2">Text</span>
              <span>Updated</span>
              <span>Dataspace</span>
            </div>
            <div className="divide-y divide-slate-200">
              {filteredTexts.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No texts yet.</div>
              ) : (
                filteredTexts.map((text) => (
                  <div key={text.id} className="grid grid-cols-4 gap-4 px-4 py-4 text-sm">
                    <div className="col-span-2">
                      <Link
                        href={`/texts/${text.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {text.snippet || "Untitled text"}
                      </Link>
                    </div>
                    <div className="text-slate-600">{text.updatedLabel}</div>
                    <div className="text-slate-600">{text.dataspaceLabel}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
