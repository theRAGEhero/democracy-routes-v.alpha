"use client";

type ClientLogLevel = "info" | "warn" | "error";

type ClientLogOptions = {
  level?: ClientLogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown> | null;
};

export async function postClientLog({ level = "info", scope, message, meta }: ClientLogOptions) {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        level,
        scope,
        message,
        meta: meta ?? {}
      })
    });
  } catch {
    // best-effort only
  }
}
