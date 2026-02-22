type BuildCallJoinUrlOptions = {
  baseUrl?: string | null;
  roomId: string;
  name?: string | null;
  autojoin?: boolean;
  embed?: boolean;
  hideDock?: boolean;
  transcriptionLanguage?: string | null;
  autoRecordAudio?: boolean;
  autoRecordVideo?: boolean;
};

function normalizeBooleanFlag(value: boolean | undefined) {
  return value ? "1" : "";
}

export function normalizeCallBaseUrl(baseUrl?: string | null) {
  const raw = String(baseUrl || "").trim();
  if (!raw) return "/video";
  return raw.replace(/\/+$/, "");
}

export function buildCallJoinUrl(options: BuildCallJoinUrlOptions) {
  const base = normalizeCallBaseUrl(options.baseUrl);
  const roomId = String(options.roomId || "").trim();
  if (!roomId) return base;

  const path = `${base}/meet/${encodeURIComponent(roomId)}`;
  const params = new URLSearchParams();

  const name = String(options.name || "").trim();
  if (name) params.set("name", name);
  if (options.autojoin !== false) params.set("autojoin", "1");

  const transcriptionLanguage = String(options.transcriptionLanguage || "").trim();
  if (transcriptionLanguage) params.set("transcriptionLanguage", transcriptionLanguage);

  const embedFlag = normalizeBooleanFlag(options.embed);
  if (embedFlag) params.set("embed", embedFlag);
  const hideDockFlag = normalizeBooleanFlag(options.hideDock);
  if (hideDockFlag) params.set("hideDock", hideDockFlag);

  const autoRecordAudio = normalizeBooleanFlag(options.autoRecordAudio);
  const autoRecordVideo = normalizeBooleanFlag(options.autoRecordVideo);
  if (autoRecordAudio) params.set("autorecordaudio", autoRecordAudio);
  if (autoRecordVideo) params.set("autorecordvideo", autoRecordVideo);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
