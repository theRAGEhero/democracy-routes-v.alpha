"use client";

import Link from "next/link";
import { useState } from "react";
import { DataspaceAnalysisPanel } from "@/app/dataspace/[id]/DataspaceAnalysisPanel";

type PlanEntry = {
  id: string;
  title: string;
  participantSummary: string | null;
  startLabel: string;
  isPublic: boolean;
  joinStatus: "NONE" | "PENDING" | "JOINED";
};

type OpenProblemEntry = {
  id: string;
  title: string;
  description: string;
  createdByEmail: string;
  joinCount: number;
  joinedByMe: boolean;
};

type Props = {
  dataspaceId: string;
  plans: PlanEntry[];
  openProblems: OpenProblemEntry[];
};

export function DataspaceRelatedTabs({ dataspaceId, plans, openProblems }: Props) {
  const [activeTab, setActiveTab] = useState<"templates" | "open-problems" | "analytics">("templates");
  const [problems, setProblems] = useState(openProblems);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin(problemId: string) {
    if (joiningId) return;
    setJoiningId(problemId);
    setJoinError(null);
    try {
      const response = await fetch(`/api/open-problems/${problemId}/join`, { method: "POST" });
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
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to join open problem.");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Related</h2>
          <p className="mt-1 text-xs text-slate-500">
            Templates, open problems, and analytics connected to this dataspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              activeTab === "templates"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("open-problems")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              activeTab === "open-problems"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Open Problems
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              activeTab === "analytics"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {activeTab === "templates" ? (
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          {plans.length === 0 ? (
            <p className="text-slate-500">No templates yet.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-900">{plan.title}</p>
                  {plan.participantSummary ? (
                    <p className="text-xs text-slate-500">{plan.participantSummary}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">{plan.startLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  {plan.isPublic ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {plan.joinStatus === "PENDING" ? "Pending" : plan.joinStatus === "JOINED" ? "Joined" : "Public"}
                    </span>
                  ) : null}
                  <Link
                    href={`/flows/${plan.id}`}
                    className="text-xs font-semibold text-slate-700 hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "open-problems" ? (
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          {problems.length === 0 ? (
            <p className="text-slate-500">No related open problems yet.</p>
          ) : (
            problems.map((problem) => (
              <div key={problem.id} className="rounded border border-slate-200 bg-white/70 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{problem.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{problem.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {problem.createdByEmail} · {problem.joinCount} joined
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleJoin(problem.id)}
                      disabled={problem.joinedByMe || joiningId === problem.id}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {problem.joinedByMe ? "Joined" : joiningId === problem.id ? "Joining..." : "Join"}
                    </button>
                    <Link
                      href="/open-problems"
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Browse
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
          {joinError ? <p className="text-sm text-red-600">{joinError}</p> : null}
        </div>
      ) : null}

      {activeTab === "analytics" ? (
        <div className="mt-4">
          <DataspaceAnalysisPanel dataspaceId={dataspaceId} />
        </div>
      ) : null}
    </div>
  );
}
