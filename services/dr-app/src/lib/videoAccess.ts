import crypto from "node:crypto";

type AccessTokenPayload = {
  roomId: string;
  meetingId?: string | null;
  sub?: string | null;
  email?: string | null;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 60 * 60;

export function buildVideoAccessToken({
  roomId,
  meetingId,
  userId,
  userEmail
}: {
  roomId: string;
  meetingId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
}) {
  const secret = String(process.env.DR_VIDEO_ACCESS_SECRET || "").trim();
  if (!secret) return "";
  const ttlSeconds = Number(process.env.DR_VIDEO_ACCESS_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  const payload: AccessTokenPayload = {
    roomId: String(roomId || "").trim(),
    meetingId: meetingId ? String(meetingId).trim() : null,
    sub: userId ? String(userId).trim() : null,
    email: userEmail ? String(userEmail).trim() : null,
    exp: Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL_SECONDS)
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
