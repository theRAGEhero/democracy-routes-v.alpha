import path from "path";

export function getMeetingMediaUploadsDir(meetingId: string) {
  const uploadsRoot =
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  return path.join(uploadsRoot, "meeting-media", meetingId);
}

export function sanitizeMeetingMediaFilename(name: string) {
  const ext = path.extname(name || "");
  const stem = path.basename(name || "media", ext).replace(/[^a-zA-Z0-9._-]+/g, "-");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${stem || "media"}${safeExt || ""}`;
}

export function buildStoredMeetingMediaFilename(name: string) {
  const safe = sanitizeMeetingMediaFilename(name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${timestamp}-${safe}`;
}

export function guessMediaContentType(filename: string) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

export function isAllowedMeetingMediaFile(name: string) {
  return /\.(mp3|wav|m4a|ogg|mp4|mov|webm)$/i.test(name);
}
