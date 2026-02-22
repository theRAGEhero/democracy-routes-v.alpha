"use client";

import { useEffect, useState } from "react";

type Message = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  seen: boolean;
};

type Payload = {
  messages: Message[];
  total: number;
  unreadCount: number;
};

function getPayloadError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if ("error" in value && typeof (value as { error?: unknown }).error === "string") {
    return (value as { error: string }).error;
  }
  return null;
}

export function AdminInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/inbox");
    const payload = (await response.json().catch(() => null)) as Payload | null;
    setLoading(false);
    if (!response.ok || !payload) {
      setError(getPayloadError(payload) ?? "Unable to load inbox");
      return;
    }
    setMessages(payload.messages ?? []);
    setUnreadCount(payload.unreadCount ?? 0);
    setTotal(payload.total ?? 0);
  }

  const filtered = onlyUnread ? messages.filter((msg) => !msg.seen) : messages;

  return (
    <div className="dr-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Inbox</h2>
          <p className="text-xs text-slate-500">
            {total} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(event) => setOnlyUnread(event.target.checked)}
              className="accent-slate-900"
            />
            Unread only
          </label>
          <button
            type="button"
            onClick={refresh}
            className="dr-button px-3 py-2 text-xs"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh inbox"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-10 gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            <span className="col-span-3">Subject</span>
            <span className="col-span-2">From</span>
            <span className="col-span-2">To</span>
            <span>Date</span>
            <span>Status</span>
            <span>UID</span>
          </div>
          <div className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">
                {messages.length === 0 ? "Inbox not loaded yet." : "No messages found."}
              </div>
            ) : (
              filtered.map((message) => (
                <div key={message.uid} className="grid grid-cols-10 gap-3 px-3 py-3 text-xs text-slate-700">
                  <div className="col-span-3">
                    <p className="font-semibold text-slate-900">{message.subject}</p>
                  </div>
                  <div className="col-span-2 text-[11px] text-slate-500">{message.from || "-"}</div>
                  <div className="col-span-2 text-[11px] text-slate-500">{message.to || "-"}</div>
                  <div className="text-[11px] text-slate-500">
                    {message.date ? new Date(message.date).toLocaleString() : "-"}
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        message.seen ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {message.seen ? "read" : "unread"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{message.uid}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
