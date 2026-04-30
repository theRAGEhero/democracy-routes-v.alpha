"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { MEDITATION_ANIMATIONS } from "@/lib/meditation";
import type { TemplateBlock, TemplateBlockType, TemplateDraft } from "@/lib/templateDraft";

const BASIC_MODULES: Array<{ type: TemplateBlockType; label: string }> = [
  { type: "START", label: "Start" },
  { type: "PARTICIPANTS", label: "Participants" },
  { type: "DISCUSSION", label: "Discussion" },
  { type: "PAUSE", label: "Pause" },
  { type: "PROMPT", label: "Prompt" },
  { type: "NOTES", label: "Notes" },
  { type: "FORM", label: "Form" },
  { type: "EMBED", label: "Embed" },
  { type: "GROUPING", label: "Grouping" },
  { type: "BREAK", label: "Break" },
  { type: "RECORD", label: "Record" }
];

const PARTICIPATION_PLATFORMS: Array<{ type: TemplateBlockType; label: string }> = [
  { type: "HARMONICA", label: "Harmonica" },
  { type: "DEMBRANE", label: "Dembrane" },
  { type: "DELIBERAIDE", label: "DeliberAIde" },
  { type: "POLIS", label: "Pol.is" },
  { type: "AGORACITIZENS", label: "Agora Citizens" },
  { type: "NEXUSPOLITICS", label: "Nexus Politics" },
  { type: "SUFFRAGO", label: "Suffrago" }
];

const DEFAULT_DURATIONS: Record<TemplateBlockType, number> = {
  START: 60,
  PARTICIPANTS: 90,
  DISCUSSION: 600,
  PAUSE: 300,
  PROMPT: 120,
  NOTES: 120,
  FORM: 120,
  EMBED: 180,
  GROUPING: 60,
  BREAK: 300,
  RECORD: 120,
  HARMONICA: 90,
  DEMBRANE: 90,
  DELIBERAIDE: 90,
  POLIS: 90,
  AGORACITIZENS: 90,
  NEXUSPOLITICS: 90,
  SUFFRAGO: 90
};

type Props = {
  draft: TemplateDraft;
  posters: Array<{ id: string; title: string }>;
  audioFiles: Array<{ name: string; url: string }>;
  onChange: (draft: TemplateDraft) => void;
};

type AiAgentOption = {
  id: string;
  name: string;
  username: string;
  color: string;
};

function createBlock(type: TemplateBlockType): TemplateBlock {
  return {
    type,
    durationSeconds: DEFAULT_DURATIONS[type],
    startMode: type === "START" ? "specific_datetime" : undefined,
    selectionRule: type === "START" ? "random" : undefined,
    participantMode: type === "PARTICIPANTS" ? "manual_selected" : undefined,
    roundMaxParticipants: type === "DISCUSSION" ? null : undefined,
    formQuestion: type === "FORM" ? "" : undefined,
    formChoices:
      type === "FORM"
        ? [
            { key: "option-a", label: "Option A" },
            { key: "option-b", label: "Option B" }
          ]
        : undefined,
    embedUrl: type === "EMBED" ? "" : undefined,
    harmonicaUrl: type === "HARMONICA" ? "" : undefined,
    matchingMode: type === "GROUPING" ? "polar" : undefined,
    meditationAnimationId: type === "PAUSE" ? MEDITATION_ANIMATIONS[0]?.id ?? null : undefined,
    meditationAudioUrl: type === "PAUSE" ? null : undefined
  };
}

export function StructuredTemplateEditor({ draft, posters, audioFiles, onChange }: Props) {
  const { data: session } = useSession();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [aiAgents, setAiAgents] = useState<AiAgentOption[]>([]);

  useEffect(() => {
    let active = true;
    async function loadAiAgents() {
      try {
        const response = await fetch("/api/ai-agents", { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (!active) return;
        setAiAgents(Array.isArray(payload?.agents) ? payload.agents : []);
      } catch {}
    }
    loadAiAgents();
    return () => {
      active = false;
    };
  }, []);

  function durationMinutes(value: number | null | undefined) {
    const total = Math.max(0, Number(value) || 0);
    return Math.floor(total / 60);
  }

  function durationSecondsRemainder(value: number | null | undefined) {
    const total = Math.max(0, Number(value) || 0);
    return total % 60;
  }

  function updateDuration(index: number, nextMinutes: number, nextSeconds: number) {
    const minutes = Math.max(0, Math.floor(nextMinutes) || 0);
    const seconds = Math.max(0, Math.min(59, Math.floor(nextSeconds) || 0));
    updateBlock(index, { durationSeconds: Math.max(30, minutes * 60 + seconds) });
  }

  function updateBlocks(blocks: TemplateBlock[]) {
    onChange({ ...draft, blocks });
  }

  function updateBlock(index: number, partial: Partial<TemplateBlock>) {
    updateBlocks(
      draft.blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...partial } : block
      )
    );
  }

  function removeBlock(index: number) {
    updateBlocks(draft.blocks.filter((_, blockIndex) => blockIndex !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.blocks.length) return;
    const next = [...draft.blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateBlocks(next);
  }

  function moveBlockToIndex(from: number, to: number) {
    if (from === to || from < 0 || from >= draft.blocks.length) return;
    const next = [...draft.blocks];
    const [item] = next.splice(from, 1);
    const adjustedTarget = from < to ? to - 1 : to;
    next.splice(Math.max(0, Math.min(next.length, adjustedTarget)), 0, item);
    updateBlocks(next);
  }

  function clearDragState() {
    setDraggingIndex(null);
    setDropIndex(null);
  }

  function handleDrop(targetIndex: number) {
    if (draggingIndex === null) return;
    moveBlockToIndex(draggingIndex, targetIndex);
    clearDragState();
  }

  return (
    <div className="dr-card flex h-full min-h-0 flex-col p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Structured Builder</h2>
          <p className="text-xs text-slate-600">Edit the same template draft as an ordered form.</p>
        </div>
        <div className="grid w-full gap-2 xl:w-auto xl:min-w-[360px]">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Basic modules
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {BASIC_MODULES.map((module) => (
                <button
                  key={module.type}
                  type="button"
                  onClick={() => updateBlocks([...draft.blocks, createBlock(module.type)])}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add {module.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Participation platforms
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {PARTICIPATION_PLATFORMS.map((module) => (
                <button
                  key={module.type}
                  type="button"
                  onClick={() => updateBlocks([...draft.blocks, createBlock(module.type)])}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add {module.label}
                </button>
              ))}
            </div>
          </div>
          {session?.user?.role === "ADMIN" ? (
            <Link
              href="/templates/workspace/modules"
              className="block rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/80 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              Edit module descriptions
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-2.5 overflow-auto">
        {draft.blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
            No blocks yet. Add one from the controls above or use the AI panel to generate a draft.
          </div>
        ) : null}
        {draft.blocks.map((block, index) => (
          <div key={`${block.type}-${index}`} className="space-y-2">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (draggingIndex !== null) setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(index);
              }}
              className={`h-2 rounded-full transition-all ${
                draggingIndex !== null && dropIndex === index
                  ? "bg-emerald-400/80 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
                  : "bg-transparent"
              }`}
            />
            <div
              draggable
              onDragStart={() => {
                setDraggingIndex(index);
                setDropIndex(index);
              }}
              onDragEnd={clearDragState}
              onDragOver={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const insertAfter = event.clientY > rect.top + rect.height / 2;
                setDropIndex(insertAfter ? index + 1 : index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const insertAfter = event.clientY > rect.top + rect.height / 2;
                handleDrop(insertAfter ? index + 1 : index);
              }}
              className={`rounded-2xl border bg-white/80 p-2.5 transition-all sm:p-3 ${
                draggingIndex === index
                  ? "border-emerald-300 opacity-60 shadow-[0_18px_36px_rgba(16,185,129,0.18)]"
                  : "border-slate-200"
              }`}
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-900">{block.type}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => moveBlock(index, -1)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(index, 1)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(index)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Duration
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={durationMinutes(block.durationSeconds)}
                    onChange={(event) =>
                      updateDuration(
                        index,
                        Number(event.target.value) || 0,
                        durationSecondsRemainder(block.durationSeconds)
                      )
                    }
                    className="dr-input w-full"
                  />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">min</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationSecondsRemainder(block.durationSeconds)}
                    onChange={(event) =>
                      updateDuration(
                        index,
                        durationMinutes(block.durationSeconds),
                        Number(event.target.value) || 0
                      )
                    }
                    className="dr-input w-full"
                  />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">sec</span>
                </div>
              </label>

              {block.type === "START" ? (
                <>
                  <label className="text-xs font-medium text-slate-700">
                    Start mode
                    <select
                      value={block.startMode ?? "specific_datetime"}
                      onChange={(event) =>
                        updateBlock(index, {
                          startMode: event.target.value as TemplateBlock["startMode"]
                        })
                      }
                      className="dr-input mt-1 w-full"
                    >
                      <option value="specific_datetime">Specific day and time</option>
                      <option value="when_x_join">When X people join</option>
                      <option value="organizer_manual">Organizer clicks start</option>
                      <option value="when_x_join_and_datetime">When X join and at a specific day/time</option>
                    </select>
                  </label>

                  {(block.startMode ?? "specific_datetime") === "specific_datetime" ||
                  block.startMode === "when_x_join_and_datetime" ? (
                    <>
                      <label className="text-xs font-medium text-slate-700">
                        Start date
                        <input
                          type="date"
                          value={block.startDate ?? ""}
                          onChange={(event) => updateBlock(index, { startDate: event.target.value || null })}
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Start time
                        <input
                          type="time"
                          value={block.startTime ?? ""}
                          onChange={(event) => updateBlock(index, { startTime: event.target.value || null })}
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Timezone
                        <input
                          type="text"
                          value={block.timezone ?? ""}
                          onChange={(event) => updateBlock(index, { timezone: event.target.value || null })}
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                    </>
                  ) : null}

                  {block.startMode === "when_x_join" || block.startMode === "when_x_join_and_datetime" ? (
                    <>
                      <label className="text-xs font-medium text-slate-700">
                        Required participants
                        <input
                          type="number"
                          min={1}
                          value={block.requiredParticipants ?? ""}
                          onChange={(event) =>
                            updateBlock(index, {
                              requiredParticipants: event.target.value ? Number(event.target.value) : null
                            })
                          }
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(block.agreementRequired)}
                          onChange={(event) => updateBlock(index, { agreementRequired: event.target.checked })}
                        />
                        Require date-time agreement
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Agreement deadline
                        <input
                          type="datetime-local"
                          value={block.agreementDeadline ?? ""}
                          onChange={(event) => updateBlock(index, { agreementDeadline: event.target.value || null })}
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                    </>
                  ) : null}

                  {block.startMode === "organizer_manual" ? (
                    <>
                      <label className="text-xs font-medium text-slate-700">
                        Minimum participants
                        <input
                          type="number"
                          min={1}
                          value={block.minimumParticipants ?? ""}
                          onChange={(event) =>
                            updateBlock(index, {
                              minimumParticipants: event.target.value ? Number(event.target.value) : null
                            })
                          }
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(block.allowStartBeforeFull)}
                          onChange={(event) => updateBlock(index, { allowStartBeforeFull: event.target.checked })}
                        />
                        Allow start before full attendance
                      </label>
                    </>
                  ) : null}

                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                    Note
                    <textarea
                      value={block.note ?? ""}
                      onChange={(event) => updateBlock(index, { note: event.target.value })}
                    className="dr-input mt-1 min-h-[76px] w-full"
                    />
                  </label>
                </>
              ) : null}

              {block.type === "PARTICIPANTS" ? (
                <>
                  <label className="text-xs font-medium text-slate-700">
                    Selection mode
                    <select
                      value={block.participantMode ?? "manual_selected"}
                      onChange={(event) =>
                        updateBlock(index, {
                          participantMode: event.target.value as TemplateBlock["participantMode"]
                        })
                      }
                      className="dr-input mt-1 w-full"
                    >
                      <option value="manual_selected">Selected or invited manually</option>
                      <option value="dataspace_invite_all">Invite all from dataspaces</option>
                      <option value="dataspace_random">Randomly extract from dataspaces</option>
                      <option value="ai_search_users">AI search in user descriptions</option>
                    </select>
                  </label>

                  {block.participantMode === "manual_selected" ? (
                    <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                      User IDs or emails (one per line)
                      <textarea
                        value={(block.participantUserIds ?? []).join("\n")}
                        onChange={(event) =>
                          updateBlock(index, {
                            participantUserIds: event.target.value
                              .split(/\r?\n/)
                              .map((line) => line.trim())
                              .filter(Boolean)
                          })
                        }
                        className="dr-input mt-1 min-h-[84px] w-full"
                      />
                    </label>
                  ) : null}

                  {block.participantMode === "dataspace_invite_all" || block.participantMode === "dataspace_random" ? (
                    <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                      Dataspace IDs (one per line)
                      <textarea
                        value={(block.participantDataspaceIds ?? []).join("\n")}
                        onChange={(event) =>
                          updateBlock(index, {
                            participantDataspaceIds: event.target.value
                              .split(/\r?\n/)
                              .map((line) => line.trim())
                              .filter(Boolean)
                          })
                        }
                        className="dr-input mt-1 min-h-[84px] w-full"
                      />
                    </label>
                  ) : null}

                  {block.participantMode === "dataspace_random" ? (
                    <label className="text-xs font-medium text-slate-700">
                      Number of participants
                      <input
                        type="number"
                        min={1}
                        value={block.participantCount ?? ""}
                        onChange={(event) =>
                          updateBlock(index, {
                            participantCount: event.target.value ? Number(event.target.value) : null
                          })
                        }
                        className="dr-input mt-1 w-full"
                      />
                    </label>
                  ) : null}

                  {block.participantMode === "ai_search_users" ? (
                    <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                      AI search query
                      <textarea
                        value={block.participantQuery ?? ""}
                        onChange={(event) => updateBlock(index, { participantQuery: event.target.value })}
                        className="dr-input mt-1 min-h-[84px] w-full"
                      />
                    </label>
                  ) : null}

                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                    Note
                    <textarea
                      value={block.participantNote ?? ""}
                      onChange={(event) => updateBlock(index, { participantNote: event.target.value })}
                      className="dr-input mt-1 min-h-[76px] w-full"
                    />
                  </label>
                </>
              ) : null}

              {block.type === "DISCUSSION" ? (
                <>
                  <label className="text-xs font-medium text-slate-700">
                    Max participants
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={block.roundMaxParticipants ?? ""}
                      onChange={(event) =>
                        updateBlock(index, {
                          roundMaxParticipants: event.target.value ? Number(event.target.value) : null
                        })
                      }
                      className="dr-input mt-1 w-full"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(block.aiAgentsEnabled)}
                      onChange={(event) =>
                        updateBlock(index, {
                          aiAgentsEnabled: event.target.checked,
                          aiAgentIds: event.target.checked ? block.aiAgentIds ?? [] : [],
                          aiAgentIntervalSeconds: event.target.checked ? block.aiAgentIntervalSeconds ?? 60 : null,
                          aiAgentCooldownSeconds: event.target.checked ? block.aiAgentCooldownSeconds ?? 120 : null,
                          aiAgentMaxReplies: event.target.checked ? block.aiAgentMaxReplies ?? 5 : null
                        })
                      }
                    />
                    Enable AI participants
                  </label>
                  {block.aiAgentsEnabled ? (
                    <>
                      <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                        AI agents
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {aiAgents.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                              No enabled AI agents available yet.
                            </div>
                          ) : (
                            aiAgents.map((agent) => {
                              const checked = (block.aiAgentIds ?? []).includes(agent.id);
                              return (
                                <label
                                  key={agent.id}
                                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const current = new Set(block.aiAgentIds ?? []);
                                      if (event.target.checked) current.add(agent.id);
                                      else current.delete(agent.id);
                                      updateBlock(index, { aiAgentIds: Array.from(current) });
                                    }}
                                  />
                                  <span
                                    className="inline-flex h-3 w-3 rounded-full border border-white/80 shadow-sm"
                                    style={{ backgroundColor: agent.color }}
                                  />
                                  <span className="font-medium text-slate-900">{agent.name}</span>
                                  <span className="text-xs text-slate-500">@{agent.username}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Reply interval (sec)
                        <input
                          type="number"
                          min={15}
                          max={3600}
                          value={block.aiAgentIntervalSeconds ?? 60}
                          onChange={(event) =>
                            updateBlock(index, {
                              aiAgentIntervalSeconds: event.target.value ? Number(event.target.value) : 60
                            })
                          }
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Cooldown (sec)
                        <input
                          type="number"
                          min={15}
                          max={7200}
                          value={block.aiAgentCooldownSeconds ?? 120}
                          onChange={(event) =>
                            updateBlock(index, {
                              aiAgentCooldownSeconds: event.target.value ? Number(event.target.value) : 120
                            })
                          }
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Max replies
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={block.aiAgentMaxReplies ?? 5}
                          onChange={(event) =>
                            updateBlock(index, {
                              aiAgentMaxReplies: event.target.value ? Number(event.target.value) : 5
                            })
                          }
                          className="dr-input mt-1 w-full"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                        AI prompt override
                        <textarea
                          value={block.aiAgentPromptOverride ?? ""}
                          onChange={(event) => updateBlock(index, { aiAgentPromptOverride: event.target.value })}
                          className="dr-input mt-1 min-h-[84px] w-full"
                        />
                      </label>
                    </>
                  ) : null}
                </>
              ) : null}

              {block.type === "PROMPT" ? (
                <>
                  <label className="text-xs font-medium text-slate-700">
                    Prompt source
                    <select
                      value={block.posterId ?? ""}
                      onChange={(event) => updateBlock(index, { posterId: event.target.value || null })}
                      className="dr-input mt-1 w-full"
                    >
                      <option value="">Write prompt directly</option>
                      {posters.map((poster) => (
                        <option key={poster.id} value={poster.id}>
                          {poster.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-2">
                    Prompt title
                    <input
                      type="text"
                      value={block.posterTitle ?? ""}
                      onChange={(event) => updateBlock(index, { posterTitle: event.target.value })}
                      className="dr-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-2">
                    Prompt text
                    <textarea
                      value={block.posterContent ?? block.note ?? ""}
                      onChange={(event) => updateBlock(index, { posterContent: event.target.value })}
                      className="dr-input mt-1 min-h-[96px] w-full rounded-2xl px-3 py-2"
                    />
                  </label>
                </>
              ) : null}

              {block.type === "EMBED" ? (
                <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-2">
                  Embed URL
                  <input
                    type="text"
                    value={block.embedUrl ?? ""}
                    onChange={(event) => updateBlock(index, { embedUrl: event.target.value })}
                    className="dr-input mt-1 w-full"
                  />
                </label>
              ) : null}

              {block.type === "HARMONICA" ? (
                <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-2">
                  Harmonica URL
                  <input
                    type="text"
                    value={block.harmonicaUrl ?? ""}
                    onChange={(event) => updateBlock(index, { harmonicaUrl: event.target.value })}
                    className="dr-input mt-1 w-full"
                  />
                </label>
              ) : null}

              {block.type === "GROUPING" ? (
                <label className="text-xs font-medium text-slate-700">
                  Grouping mode
                  <select
                    value={block.matchingMode ?? "polar"}
                    onChange={(event) =>
                      updateBlock(index, {
                        matchingMode:
                          event.target.value === "anti"
                            ? "anti"
                            : event.target.value === "random"
                              ? "random"
                              : "polar"
                      })
                    }
                    className="dr-input mt-1 w-full"
                  >
                    <option value="polar">Polarizing</option>
                    <option value="anti">Depolarizing</option>
                    <option value="random">Random</option>
                  </select>
                </label>
              ) : null}

              {block.type === "FORM" ? (
                <>
                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-2">
                    Question
                    <input
                      type="text"
                      value={block.formQuestion ?? ""}
                      onChange={(event) => updateBlock(index, { formQuestion: event.target.value })}
                      className="dr-input mt-1 w-full"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700 md:col-span-2 lg:col-span-3">
                    Options (one per line)
                    <textarea
                      value={(block.formChoices ?? []).map((choice) => choice.label).join("\n")}
                      onChange={(event) =>
                        updateBlock(index, {
                          formChoices: event.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((label, choiceIndex) => ({
                              key: `opt-${choiceIndex + 1}`,
                              label
                            }))
                        })
                      }
                      className="dr-input mt-1 min-h-[84px] w-full"
                    />
                  </label>
                </>
              ) : null}

              {block.type === "PAUSE" ? (
                <>
                  <label className="text-xs font-medium text-slate-700">
                    Animation
                    <select
                      value={block.meditationAnimationId ?? MEDITATION_ANIMATIONS[0]?.id ?? ""}
                      onChange={(event) => updateBlock(index, { meditationAnimationId: event.target.value || null })}
                      className="dr-input mt-1 w-full"
                    >
                      {MEDITATION_ANIMATIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Audio
                    <select
                      value={block.meditationAudioUrl ?? ""}
                      onChange={(event) => updateBlock(index, { meditationAudioUrl: event.target.value || null })}
                      className="dr-input mt-1 w-full"
                    >
                      <option value="">No audio</option>
                      {audioFiles.map((file) => (
                        <option key={file.url} value={file.url}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>
          </div>
          </div>
        ))}
        {draft.blocks.length > 0 ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingIndex !== null) setDropIndex(draft.blocks.length);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(draft.blocks.length);
            }}
            className={`h-2 rounded-full transition-all ${
              draggingIndex !== null && dropIndex === draft.blocks.length
                ? "bg-emerald-400/80 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
                : "bg-transparent"
            }`}
          />
        ) : null}
      </div>
    </div>
  );
}
