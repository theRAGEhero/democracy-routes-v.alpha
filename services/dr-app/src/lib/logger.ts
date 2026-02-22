type LogMeta = Record<string, unknown> | undefined;

export function logInfo(message: string, meta?: LogMeta) {
  if (meta) {
    console.info(`[INFO] ${message}`, meta);
  } else {
    console.info(`[INFO] ${message}`);
  }
}

export function logError(message: string, error: unknown, meta?: LogMeta) {
  if (meta) {
    console.error(`[ERROR] ${message}`, error, meta);
  } else {
    console.error(`[ERROR] ${message}`, error);
  }
}
