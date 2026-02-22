type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Map<string, RateLimitState> | undefined;
}

const store: Map<string, RateLimitState> = global.__rateLimitStore ?? new Map();
if (!global.__rateLimitStore) {
  global.__rateLimitStore = store;
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = store.get(options.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    store.set(options.key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: options.limit - 1,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000)
    };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(0, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  store.set(options.key, existing);
  return {
    ok: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSeconds: Math.max(0, Math.ceil((existing.resetAt - now) / 1000))
  };
}
