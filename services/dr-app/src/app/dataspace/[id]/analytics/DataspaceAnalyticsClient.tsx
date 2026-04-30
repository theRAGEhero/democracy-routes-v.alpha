"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type GraphNodeType = "template" | "meeting" | "participant";

type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  x: number;
  y: number;
  meta: {
    id?: string;
    href?: string;
    description?: string | null;
    roomId?: string;
    participants?: string[];
    startAt?: string;
    createdAt?: string;
    createdById?: string;
    userId?: string | null;
    meetings?: number;
    templates?: number;
    [key: string]: unknown;
  };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "template-meeting" | "participant-template" | "participant-meeting";
};

type GraphPayload = {
  dataspace: { id: string; name: string; color: string | null };
  stats: {
    templates: number;
    meetings: number;
    participants: number;
    connections: number;
    mostConnectedParticipant: { email: string; count: number } | null;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const EDGE_COLORS: Record<GraphEdge["type"], string> = {
  "template-meeting": "#ea580c",
  "participant-template": "#0f766e",
  "participant-meeting": "#2563eb"
};

const NODE_STYLES: Record<GraphNodeType, string> = {
  template: "border-orange-200 bg-orange-50/95 text-orange-950",
  meeting: "border-sky-200 bg-sky-50/95 text-sky-950",
  participant: "border-slate-200 bg-white/95 text-slate-900"
};

function buildPath(from: GraphNode, to: GraphNode) {
  const startX = from.x + 248;
  const startY = from.y + 28;
  const endX = to.x;
  const endY = to.y + 28;
  const controlX = Math.round((startX + endX) / 2);
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
}

export function DataspaceAnalyticsClient({
  dataspaceId
}: {
  dataspaceId: string;
}) {
  const [data, setData] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dataspaces/${dataspaceId}/analytics/graph`, { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || `Request failed (${response.status})`);
        }
        return payload as GraphPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setActiveNodeId(payload.nodes[0]?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataspaceId]);

  const visibleTypes = useMemo(() => {
    return new Set<GraphNodeType>(
      [
        showTemplates ? "template" : null,
        showMeetings ? "meeting" : null,
        showParticipants ? "participant" : null
      ].filter(Boolean) as GraphNodeType[]
    );
  }, [showMeetings, showParticipants, showTemplates]);

  const visibleNodes = useMemo(
    () => (data?.nodes || []).filter((node) => visibleTypes.has(node.type)),
    [data, visibleTypes]
  );

  const nodeById = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () =>
      (data?.edges || []).filter(
        (edge) => nodeById.has(edge.source) && nodeById.has(edge.target)
      ),
    [data, nodeById]
  );

  const activeNode =
    visibleNodes.find((node) => node.id === activeNodeId) ?? visibleNodes[0] ?? null;
  const hoveredNode =
    visibleNodes.find((node) => node.id === hoveredNodeId) ?? null;

  const connectedEdges = activeNode
    ? visibleEdges.filter(
        (edge) => edge.source === activeNode.id || edge.target === activeNode.id
      )
    : [];

  const connectedNodeIds = new Set(
    connectedEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== activeNode?.id)
  );
  const connectedNodes = visibleNodes.filter((node) => connectedNodeIds.has(node.id));

  const canvasWidth = 1100;
  const canvasHeight =
    Math.max(
      720,
      ...visibleNodes.map((node) => node.y + (node.type === "participant" ? 88 : 96))
    ) + 96;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Dataspace Analytics
          </h1>
          <p className="text-sm text-slate-600">
            Structural network of templates, calls, and participants inside this dataspace.
          </p>
        </div>
        <Link
          href={`/dataspace/${dataspaceId}`}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
        >
          Back to dataspace
        </Link>
      </div>

      {loading ? (
        <div className="dr-card p-6 text-sm text-slate-600">Loading analytics…</div>
      ) : error ? (
        <div className="dr-card p-6 text-sm text-rose-700">{error}</div>
      ) : data ? (
        <>
          <div className="grid gap-2 lg:grid-cols-[repeat(4,minmax(0,120px))_minmax(0,1fr)]">
            <div className="dr-card px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Templates</p>
              <p className="mt-1 text-lg font-semibold leading-none text-slate-900">{data.stats.templates}</p>
            </div>
            <div className="dr-card px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Calls</p>
              <p className="mt-1 text-lg font-semibold leading-none text-slate-900">{data.stats.meetings}</p>
            </div>
            <div className="dr-card px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Participants</p>
              <p className="mt-1 text-lg font-semibold leading-none text-slate-900">{data.stats.participants}</p>
            </div>
            <div className="dr-card px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Connections</p>
              <p className="mt-1 text-lg font-semibold leading-none text-slate-900">{data.stats.connections}</p>
            </div>
            <div className="dr-card flex min-h-[64px] items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Most connected</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {data.stats.mostConnectedParticipant?.email || "No participant data"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {data.stats.mostConnectedParticipant
                  ? `${data.stats.mostConnectedParticipant.count} links`
                  : "No activity"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr,320px]">
            <div className="dr-card overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowTemplates((value) => !value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] ${
                    showTemplates ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Templates
                </button>
                <button
                  type="button"
                  onClick={() => setShowMeetings((value) => !value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] ${
                    showMeetings ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Calls
                </button>
                <button
                  type="button"
                  onClick={() => setShowParticipants((value) => !value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] ${
                    showParticipants ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Participants
                </button>
              </div>
              <div className="overflow-auto">
                <div className="relative min-w-[1100px]" style={{ height: canvasHeight }}>
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={canvasWidth}
                    height={canvasHeight}
                    viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                    fill="none"
                  >
                    {visibleEdges.map((edge) => {
                      const source = nodeById.get(edge.source);
                      const target = nodeById.get(edge.target);
                      if (!source || !target) return null;
                      const isActive =
                        activeNode && (edge.source === activeNode.id || edge.target === activeNode.id);
                      return (
                        <path
                          key={edge.id}
                          d={buildPath(source, target)}
                          stroke={EDGE_COLORS[edge.type]}
                          strokeOpacity={isActive ? 0.92 : 0.24}
                          strokeWidth={isActive ? 3 : 2}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>

                  {visibleNodes.map((node) => {
                    const isActive = node.id === activeNode?.id;
                    const hasHref = typeof node.meta.href === "string";
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setActiveNodeId(node.id)}
                        onDoubleClick={() => {
                          if (typeof node.meta.href === "string") {
                            window.location.assign(node.meta.href);
                          }
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                        className={`absolute w-[248px] rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${NODE_STYLES[node.type]} ${
                          isActive ? "ring-2 ring-slate-900/15" : ""
                        }`}
                        style={{ left: node.x, top: node.y }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] opacity-70">
                          {node.type}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold">{node.label}</p>
                        <p className="mt-2 text-xs opacity-70">
                          {node.type === "participant"
                            ? `${Number(node.meta.meetings || 0)} calls · ${Number(node.meta.templates || 0)} templates`
                            : node.type === "meeting"
                              ? String(node.meta.roomId || "")
                              : "Template node"}
                        </p>
                        {hasHref ? (
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                            Double-click to open
                          </p>
                        ) : null}
                      </button>
                    );
                  })}

                  {hoveredNode?.type === "meeting" ? (
                    <div
                      className="pointer-events-none absolute z-20 w-[280px] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left shadow-xl"
                      style={{
                        left: Math.min(hoveredNode.x + 260, canvasWidth - 296),
                        top: Math.max(16, hoveredNode.y - 4)
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Call preview
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{hoveredNode.label}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        {hoveredNode.meta.description || "No description"}
                      </p>
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Participants
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          {Array.isArray(hoveredNode.meta.participants) && hoveredNode.meta.participants.length > 0
                            ? hoveredNode.meta.participants.join(", ")
                            : "No participants yet"}
                        </p>
                      </div>
                      {typeof hoveredNode.meta.href === "string" ? (
                        <div className="mt-3">
                          <Link
                            href={hoveredNode.meta.href}
                            className="pointer-events-auto inline-flex rounded-full border border-slate-200 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm hover:bg-slate-800"
                          >
                            Open call
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <aside className="dr-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Node details</p>
              {activeNode ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {activeNode.type}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{activeNode.label}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {activeNode.type === "participant" ? (
                      <>
                        <p>{Number(activeNode.meta.meetings || 0)} call connections</p>
                        <p>{Number(activeNode.meta.templates || 0)} template connections</p>
                      </>
                    ) : activeNode.type === "meeting" ? (
                      <>
                        <p>Room: {String(activeNode.meta.roomId || "—")}</p>
                        <p className="mt-2 text-xs text-slate-600">
                          {activeNode.meta.description || "No description"}
                        </p>
                        {Array.isArray(activeNode.meta.participants) && activeNode.meta.participants.length > 0 ? (
                          <p className="mt-2 text-xs text-slate-600">
                            Participants: {activeNode.meta.participants.join(", ")}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p>Template node inside this dataspace.</p>
                        <p className="mt-2 text-xs text-slate-600">
                          {activeNode.meta.description || "No description"}
                        </p>
                        {Array.isArray(activeNode.meta.participants) && activeNode.meta.participants.length > 0 ? (
                          <p className="mt-2 text-xs text-slate-600">
                            Participants: {activeNode.meta.participants.join(", ")}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {typeof activeNode.meta.href === "string" ? (
                    <Link
                      href={activeNode.meta.href}
                      className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    >
                      Open {activeNode.type === "meeting" ? "call" : activeNode.type === "template" ? "template" : "profile"}
                    </Link>
                  ) : null}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Connected nodes
                    </p>
                    <div className="mt-3 space-y-2">
                      {connectedNodes.length === 0 ? (
                        <p className="text-sm text-slate-500">No connections to show.</p>
                      ) : (
                        connectedNodes.slice(0, 12).map((node) => (
                          <div
                            key={node.id}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {typeof node.meta.href === "string" ? (
                              <Link
                                href={node.meta.href}
                                className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700"
                              >
                                {node.label}
                              </Link>
                            ) : (
                              <p className="font-medium text-slate-900">{node.label}</p>
                            )}
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{node.type}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Select a node to inspect its links.</p>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
