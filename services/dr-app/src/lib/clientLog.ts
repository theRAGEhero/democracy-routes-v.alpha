async function postClientLog(
  level: "error" | "warn" | "info",
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        scope,
        message,
        meta: meta ?? null
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return payload?.id ?? null;
  } catch {
    return null;
  }
}

export async function logClientError(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  return postClientLog("error", scope, message, meta);
}

export async function logClientWarn(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  return postClientLog("warn", scope, message, meta);
}

export async function logClientInfo(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  return postClientLog("info", scope, message, meta);
}
