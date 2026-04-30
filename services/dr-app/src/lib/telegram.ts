type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { username?: string | null };
  };
};

type TelegramUpdatesResponse = {
  ok: boolean;
  result?: TelegramUpdate[];
};

type TelegramSendResponse = {
  ok: boolean;
  description?: string;
};

function getTelegramBaseUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return `https://api.telegram.org/bot${token}`;
}

export function normalizeTelegramHandle(handle: string | null | undefined) {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export async function resolveTelegramChatId(handle: string) {
  const baseUrl = getTelegramBaseUrl();
  if (!baseUrl) return null;
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/getUpdates`);
    if (!response.ok) return null;
    const payload = (await response.json()) as TelegramUpdatesResponse;
    if (!payload.ok || !payload.result) return null;

    const target = handle.toLowerCase();
    const match = payload.result
      .map((update) => update.message)
      .filter(Boolean)
      .find(
        (message) =>
          message?.from?.username?.toLowerCase() === target &&
          typeof message?.chat?.id === "number"
      );

    return match?.chat?.id ?? null;
  } catch (error) {
    return null;
  }
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const baseUrl = getTelegramBaseUrl();
  if (!baseUrl) return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN" };

  try {
    const response = await fetch(`${baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    const payload = (await response.json()) as TelegramSendResponse;
    if (!payload.ok) {
      return { ok: false, error: payload.description ?? "Telegram send failed" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "Telegram send failed" };
  }
}

export async function sendTelegramDocument(
  chatId: number,
  filename: string,
  content: string | Buffer,
  caption?: string | null
) {
  const baseUrl = getTelegramBaseUrl();
  if (!baseUrl) return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN" };

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) {
      form.append("caption", caption);
    }
    const blobContent = typeof content === "string" ? content : new Uint8Array(content);
    form.append(
      "document",
      new Blob([blobContent], { type: "text/calendar; charset=utf-8" }),
      filename
    );

    const response = await fetch(`${baseUrl}/sendDocument`, {
      method: "POST",
      body: form
    });

    const payload = (await response.json()) as TelegramSendResponse;
    if (!payload.ok) {
      return { ok: false, error: payload.description ?? "Telegram document send failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Telegram document send failed" };
  }
}
