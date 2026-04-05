const WEBHOOK_PATH = "/api/telegram/webhook";

function getEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

async function telegramRequest(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram ${method} failed`);
  }

  return payload.result;
}

async function main() {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");
  const appBaseUrl = getEnv("APP_BASE_URL");

  if (!token || !secret || !appBaseUrl) {
    console.log("Telegram webhook sync skipped: missing token, secret, or APP_BASE_URL.");
    return;
  }

  let baseUrl;
  try {
    baseUrl = new URL(appBaseUrl);
  } catch {
    console.log("Telegram webhook sync skipped: APP_BASE_URL is not a valid URL.");
    return;
  }

  if (baseUrl.protocol !== "https:") {
    console.log("Telegram webhook sync skipped: APP_BASE_URL must use https.");
    return;
  }

  const expectedUrl = new URL(WEBHOOK_PATH, `${baseUrl.origin}/`).toString();

  try {
    const current = await telegramRequest(token, "getWebhookInfo");
    if (current?.url === expectedUrl) {
      console.log("Telegram webhook already configured.");
      return;
    }

    const body = new URLSearchParams({
      url: expectedUrl,
      secret_token: secret,
      allowed_updates: JSON.stringify(["message"])
    });

    await telegramRequest(token, "setWebhook", body);
    console.log(`Telegram webhook configured: ${expectedUrl}`);
  } catch (error) {
    console.warn(
      `Telegram webhook sync failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

main();
