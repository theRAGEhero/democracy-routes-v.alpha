import { postEventHubEvent } from "@/lib/eventHub";

type LogMeta = Record<string, unknown> | undefined;
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL =
  typeof process !== "undefined" && process.env
    ? String(process.env.LOG_LEVEL || "info").toLowerCase()
    : "info";
const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
const EVENT_HUB_MIN_LEVEL =
  typeof process !== "undefined" && process.env
    ? String(process.env.EVENT_HUB_MIN_LEVEL || "info").toLowerCase()
    : "info";

function shouldLog(level: LogLevel) {
  const min = LEVEL_RANK[(LOG_LEVEL as LogLevel) || "info"] ?? LEVEL_RANK.info;
  return LEVEL_RANK[level] >= min;
}

function shouldSendEvent(level: LogLevel) {
  const min = LEVEL_RANK[(EVENT_HUB_MIN_LEVEL as LogLevel) || "info"] ?? LEVEL_RANK.info;
  return LEVEL_RANK[level] >= min;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
}

function emit(level: LogLevel, message: string, meta?: LogMeta, error?: unknown) {
  if (!shouldLog(level)) return;

  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    message
  };

  if (meta && typeof meta === "object") {
    Object.assign(payload, meta);
  }
  if (typeof error !== "undefined") {
    payload.error = normalizeError(error);
  }

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (typeof window === "undefined" && shouldSendEvent(level)) {
    void postEventHubEvent({
      source: "dr-app",
      type: message,
      severity: level,
      message,
      payload: meta ?? null
    });
  }
}

export function logDebug(message: string, meta?: LogMeta) {
  emit("debug", message, meta);
}

export function logInfo(message: string, meta?: LogMeta) {
  emit("info", message, meta);
}

export function logWarn(message: string, meta?: LogMeta) {
  emit("warn", message, meta);
}

export function logError(message: string, error: unknown, meta?: LogMeta) {
  emit("error", message, meta, error);
}

export function getRequestId(request: Request) {
  const fromRequest = request.headers.get("x-request-id");
  if (fromRequest && fromRequest.trim()) return fromRequest.trim();
  const fromCorrelation = request.headers.get("x-correlation-id");
  if (fromCorrelation && fromCorrelation.trim()) return fromCorrelation.trim();
  return null;
}
