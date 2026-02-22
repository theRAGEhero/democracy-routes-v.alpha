export async function logClientError(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        scope,
        message,
        meta: meta ?? null
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return null;
    return payload?.id ?? null;
  } catch (error) {
    return null;
  }
}
