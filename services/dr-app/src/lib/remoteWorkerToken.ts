import crypto from "node:crypto";

type RemoteWorkerTokenPayload = {
  uid: string;
  email: string;
  iat: number;
  exp: number;
};

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function getRemoteWorkerSecret() {
  const secret =
    process.env.DR_REMOTE_WORKER_EMBED_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DR_VIDEO_ACCESS_SECRET ||
    "";
  if (!secret) {
    throw new Error("Remote worker signing secret is not configured");
  }
  return secret;
}

function sign(value: string, secret: string) {
  return toBase64Url(crypto.createHmac("sha256", secret).update(value).digest());
}

export function createRemoteWorkerToken(user: { id: string; email: string }, maxAgeSeconds = 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payload: RemoteWorkerTokenPayload = {
    uid: user.id,
    email: user.email,
    iat: now,
    exp: now + maxAgeSeconds
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, getRemoteWorkerSecret());
  return {
    token: `${encodedPayload}.${signature}`,
    payload
  };
}

export function verifyRemoteWorkerToken(token: string): RemoteWorkerTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload, getRemoteWorkerSecret());
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as RemoteWorkerTokenPayload;
    if (!payload?.uid || !payload?.email || !payload?.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractRemoteWorkerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const url = new URL(request.url);
  return url.searchParams.get("token")?.trim() || "";
}
