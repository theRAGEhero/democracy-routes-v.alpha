type EventPayload = {
  source: string;
  type: string;
  severity?: string | null;
  message?: string | null;
  actorId?: string | null;
  dataspaceId?: string | null;
  meetingId?: string | null;
  templateId?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function postEventHubEvent(event: EventPayload) {
  const baseUrl = String(process.env.EVENT_HUB_BASE_URL || "").trim();
  const apiKey = String(process.env.EVENT_HUB_API_KEY || "").trim();
  if (!baseUrl || !apiKey) return;

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(event),
      cache: "no-store"
    });
  } catch {
    // best-effort only
  }
}
