import crypto from "crypto";

type MeetingStatus = {
  isActive: boolean;
  expiresAt: Date | null;
};

export function generateRoomId() {
  return crypto.randomBytes(16).toString("base64url").replace(/_/g, "-");
}

export function generateTempPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

export function isMeetingActive(meeting: MeetingStatus) {
  if (!meeting.isActive) return false;
  if (!meeting.expiresAt) return true;
  return meeting.expiresAt.getTime() > Date.now();
}

export function formatDateTime(value: Date | null, timeZone?: string | null) {
  if (!value) return "No expiry";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short"
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return new Intl.DateTimeFormat(undefined, options).format(value);
}
