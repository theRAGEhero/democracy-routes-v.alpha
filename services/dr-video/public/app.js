import * as mediasoupClient from "https://esm.sh/mediasoup-client@3";

const statusEl = document.getElementById("status");
const logsEl = document.getElementById("logs");
const videosEl = document.getElementById("videos");
const headerEl = document.querySelector(".header");

const roomEl = document.getElementById("room");
const nameEl = document.getElementById("name");
const roomJoinBlockEl = document.getElementById("roomJoinBlock");
const nameJoinBlockEl = document.getElementById("nameJoinBlock");
const autoRecordJoinBlockEl = document.getElementById("autoRecordJoinBlock");
const transcriptionJoinBlockEl = document.getElementById("transcriptionJoinBlock");
const generateRoomBtn = document.getElementById("generateRoom");
const joinBtn = document.getElementById("join");
const leaveBtn = document.getElementById("leave");

const micToggleBtn = document.getElementById("micToggle");
const camToggleBtn = document.getElementById("camToggle");
const recAudioToggleBtn = document.getElementById("toggleRecAudio");
const recVideoToggleBtn = document.getElementById("toggleRecVideo");
const viewToggleBtn = document.getElementById("viewToggle");
const transcriptToggleBtn = document.getElementById("transcriptToggle");
const chatToggleBtn = document.getElementById("chatToggle");
const audioDeviceEl = document.getElementById("audioDevice");
const videoDeviceEl = document.getElementById("videoDevice");
const autoRecordVideoEl = document.getElementById("autoRecordVideo");
const autoRecordAudioEl = document.getElementById("autoRecordAudio");
const transcriptionEnabledEl = document.getElementById("transcriptionEnabled");
const transcriptionLanguageInputEl = document.getElementById("transcriptionLanguageInput");
const dockAudioDeviceEl = document.getElementById("dockAudioDevice");
const dockVideoDeviceEl = document.getElementById("dockVideoDevice");
const micDevicePopover = document.getElementById("micDevicePopover");
const camDevicePopover = document.getElementById("camDevicePopover");

const dockMicBtn = document.getElementById("dockMic") || micToggleBtn;
const dockCamBtn = document.getElementById("dockCam") || camToggleBtn;
const dockRecAudioBtn = document.getElementById("dockRecAudio") || recAudioToggleBtn;
const dockRecVideoBtn = document.getElementById("dockRecVideo") || recVideoToggleBtn;
const dockLeaveBtn = document.getElementById("dockLeave") || leaveBtn;
const dockEl = document.getElementById("dock");

const previewVideoEl = document.getElementById("previewVideo");
const lobbyPanelEl = document.getElementById("lobbyPanel");
const callShellEl = document.getElementById("callShell");
const transcriptBoxEl = document.getElementById("transcriptBox");
const transcriptLinesEl = document.getElementById("transcriptLines");
const transcriptLiveEl = document.getElementById("transcriptLive");
const chatBoxEl = document.getElementById("chatBox");
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSend");
const roomBadgeEl = document.getElementById("roomBadge");
const inviteBtn = document.getElementById("inviteBtn");
const participantCountEl = document.getElementById("participantCount");
const participantListEl = document.getElementById("participantList");

const ROOM_ADJECTIVES = [
  "civic",
  "democratic",
  "public",
  "open",
  "participatory",
  "deliberative",
  "inclusive",
  "transparent",
  "digital",
  "community",
  "accountable",
  "plural"
];
const ROOM_NOUNS = [
  "assembly",
  "forum",
  "commons",
  "council",
  "dialogue",
  "consensus",
  "charter",
  "mandate",
  "cooperation",
  "policy",
  "civictech",
  "governance"
];
const PAGE_URL = new URL(window.location.href);
const EMBED_MODE = ["1", "true", "yes"].includes(String(PAGE_URL.searchParams.get("embed") || "").toLowerCase());
const HIDE_DOCK = ["1", "true", "yes"].includes(String(PAGE_URL.searchParams.get("hideDock") || "").toLowerCase());
const BASE_PATH = PAGE_URL.pathname.startsWith("/video/") || PAGE_URL.pathname === "/video" ? "/video" : "";

function withBasePath(path) {
  const normalized = String(path || "");
  if (!BASE_PATH) return normalized;
  if (!normalized.startsWith("/")) return BASE_PATH + "/" + normalized;
  if (normalized === BASE_PATH || normalized.startsWith(BASE_PATH + "/")) return normalized;
  return BASE_PATH + normalized;
}
const ICONS = {
  viewAuto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="8"/></svg>',
  viewGrid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  viewSpeaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6l-5 4z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg>',
  micOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M8 21h8"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 7 7"/><path d="M12 18v3"/><path d="M8 21h8"/><path d="M3 3l18 18"/></svg>',
  camOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 4-3v10l-4-3z"/></svg>',
  camOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="12" rx="2"/><path d="m17 10 4-3v10l-4-3z"/><path d="M3 3l18 18"/></svg>',
  recOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>',
  recOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
  recBusy: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>',
  recAudioOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6l-5 4z"/><path d="M16 9a5 5 0 0 1 0 6"/></svg>',
  recAudioBusy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6l-5 4z"/><circle cx="18" cy="12" r="2.2"/></svg>',
  leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  transcriptOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H8l-4 4z"/><path d="M8 10h8"/><path d="M8 13h5"/></svg>',
  transcriptOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H8l-4 4z"/><path d="M3 3l18 18"/></svg>',
  chatOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H8l-4 4z"/><path d="M8 10h8"/><path d="M8 13h6"/></svg>',
  chatOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H8l-4 4z"/><path d="M3 3l18 18"/></svg>'
};
const GEAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.7 1.7 0 0 1-3.4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.7 1.7 0 0 1 0-3.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1.7 1.7 0 0 1 3.4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1.7 1.7 0 0 1 0 3.4h-.2a1 1 0 0 0-.9.6z"></path></svg>';

let ws;
let peerId;
let roomId;
let meetingId = "";
let device;
let sendTransport;
let recvTransport;
let localStream;
let previewStream;
let audioProducer;
let videoProducer;
let rec;
let recSeq = 0;
let recSessionId;
let micEnabled = true;
let camEnabled = true;
let recordingEnabled = false;
let recordingOwnerPeerId = null;
let recordingMode = "av";
let viewMode = "auto";
let activeSpeakerPeerId = null;
let pinnedSpeakerPeerId = null;
let audioContext = null;
let speakerPollIntervalId = null;
let recordingComposite = null;
let recordingAudioMix = null;
let hideRecordingButtonsByUrl = false;
let transcriptionLanguage = "";
let transcriptionRecorder = null;
let transcriptionRecorderSeq = 0;
let transcriptionRecorderSessionId = "";
let transcriptionUploadPending = [];
let transcriptionAudioMixer = null;
const MAX_TRANSCRIPT_LINES = 500;
let transcriptFinalItems = [];
let transcriptInterimItem = "";
let lastTranscriptSpeakerKey = "";
let lastActiveSpeakerEmitAt = 0;
let lastActiveSpeakerPeerKey = "";
let transcriptPanelVisible = true;
let chatPanelVisible = false;
let overlayHideTimer = null;
const overlayAutoHideEnabled = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const OVERLAY_IDLE_MS = 2600;

const peerNames = new Map();
const peerTiles = new Map();
const consumerByProducerId = new Map();
const pending = new Map();
const observedTracks = new WeakSet();
const audioAnalyserByPeer = new Map();

function postHostEvent(type, payload = {}) {
  if (!EMBED_MODE) return;
  if (!window.parent || window.parent === window) return;
  try {
    window.parent.postMessage(
      {
        source: "dr-video",
        type,
        payload: {
          ...payload,
          roomId: roomId || sanitizeRoomId(roomEl.value),
          peerId: peerId || null
        }
      },
      "*"
    );
  } catch {}
}

async function handleHostCommand(message) {
  if (!message || typeof message !== "object") return;
  if (message.type !== "dr-video-command") return;
  const command = String(message.command || "").trim();
  const data = message.data || {};

  if (command === "join") {
    if (typeof data.roomId === "string" && data.roomId.trim()) roomEl.value = sanitizeRoomId(data.roomId);
    if (typeof data.name === "string" && data.name.trim()) nameEl.value = data.name.trim();
    if (typeof data.meetingId === "string" && data.meetingId.trim()) meetingId = data.meetingId.trim();
    if (typeof data.autoRecordMode === "string") setAutoRecordMode(data.autoRecordMode);
    if (typeof data.transcriptionLanguage === "string") {
      const normalized = normalizeTranscriptionLanguage(data.transcriptionLanguage);
      if (normalized) {
        transcriptionLanguage = normalized;
        syncTranscriptionJoinControls();
      }
    }
    if (!isSocketOpen()) await joinRoom();
    return;
  }

  if (command === "leave") {
    await leaveRoom();
    return;
  }

  if (command === "toggleMic") {
    await toggleMic();
    return;
  }

  if (command === "toggleCam") {
    await toggleCam();
    return;
  }

  if (command === "startRecording") {
    await startRecording(String(data.mode || "av"));
    return;
  }

  if (command === "stopRecording") {
    await stopRecording();
    return;
  }

  if (command === "setView") {
    const requested = String(data.mode || "").toLowerCase();
    if (["auto", "grid", "speaker"].includes(requested)) {
      viewMode = requested;
      refreshViewButton();
      updateVideosLayout();
    }
  }
}

function normalizeRecordingMode(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  return v === "audio" ? "audio" : "av";
}

function normalizeTranscriptionLanguage(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "multi") return "multi";

  const match = raw.match(/^([a-zA-Z]{2,3})(?:[-_]([a-zA-Z]{2,3}))?$/);
  if (!match) return "";

  const base = match[1].toLowerCase();
  if (!match[2]) return base;
  return base + "-" + match[2].toUpperCase();
}

function getJoinTranscriptionLanguagePreference() {
  if (!transcriptionEnabledEl || !transcriptionEnabledEl.checked) return "";
  const selected = transcriptionLanguageInputEl ? transcriptionLanguageInputEl.value : "";
  return normalizeTranscriptionLanguage(selected);
}

function syncTranscriptionJoinControls() {
  if (!transcriptionEnabledEl || !transcriptionLanguageInputEl) return;
  const enabled = Boolean(transcriptionLanguage);
  transcriptionEnabledEl.checked = enabled;
  transcriptionLanguageInputEl.disabled = !enabled;
  if (enabled) {
    const normalized = normalizeTranscriptionLanguage(transcriptionLanguage);
    const hasOption = [...transcriptionLanguageInputEl.options].some((o) => o.value === normalized);
    if (!hasOption && normalized) {
      const option = document.createElement("option");
      option.value = normalized;
      option.textContent = normalized.toUpperCase();
      transcriptionLanguageInputEl.appendChild(option);
    }
    transcriptionLanguageInputEl.value = normalized;
  }
}

function setAutoRecordMode(mode) {
  const normalized = normalizeRecordingMode(mode);
  autoRecordAudioEl.checked = normalized === "audio";
  autoRecordVideoEl.checked = normalized === "av";
}

function getAutoRecordModePreference() {
  if (autoRecordAudioEl.checked) return "audio";
  if (autoRecordVideoEl.checked) return "av";
  return null;
}

function applyRecordingButtonsVisibility() {
  const hide = Boolean(hideRecordingButtonsByUrl);
  [recAudioToggleBtn, recVideoToggleBtn].forEach((btn) => {
    if (!btn) return;
    btn.style.display = hide ? "none" : "";
    btn.disabled = hide || btn.disabled;
  });
}

function buildCompositeRecordingStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  const fps = 20;
  const videoStream = canvas.captureStream(fps);
  const videoTrack = videoStream.getVideoTracks()[0];

  const ac = ensureAudioContext();
  const destination = ac.createMediaStreamDestination();
  const mixNodes = new Map();

  function cleanupAudioMix() {
    for (const n of mixNodes.values()) {
      try {
        n.source.disconnect();
      } catch {}
      try {
        n.gain.disconnect();
      } catch {}
    }
    mixNodes.clear();
  }

  function rebuildAudioMix() {
    cleanupAudioMix();
    for (const [peerKey, tile] of peerTiles.entries()) {
      const track = tile.stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live" || !track.enabled) continue;
      try {
        const trackStream = new MediaStream([track]);
        const source = ac.createMediaStreamSource(trackStream);
        const gain = ac.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(destination);
        mixNodes.set(peerKey, { source, gain });
      } catch {}
    }
  }

  function drawFrame() {
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tiles = [...peerTiles.values()];
    const count = Math.max(tiles.length, 1);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const gap = 12;
    const cellW = (canvas.width - gap * (cols + 1)) / cols;
    const cellH = (canvas.height - gap * (rows + 1)) / rows;

    tiles.forEach((tile, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = gap + col * (cellW + gap);
      const y = gap + row * (cellH + gap);

      ctx.fillStyle = "#111827";
      ctx.fillRect(x, y, cellW, cellH);

      const hasVideo = tile.video && tile.video.readyState >= 2;
      if (hasVideo) {
        try {
          const srcW = Number(tile.video.videoWidth || 0);
          const srcH = Number(tile.video.videoHeight || 0);
          if (srcW > 0 && srcH > 0) {
            const srcAspect = srcW / srcH;
            const dstAspect = cellW / cellH;
            let drawW = cellW;
            let drawH = cellH;
            let drawX = x;
            let drawY = y;

            if (srcAspect > dstAspect) {
              drawW = cellW;
              drawH = cellW / srcAspect;
              drawY = y + (cellH - drawH) / 2;
            } else {
              drawH = cellH;
              drawW = cellH * srcAspect;
              drawX = x + (cellW - drawW) / 2;
            }

            ctx.drawImage(tile.video, drawX, drawY, drawW, drawH);
          } else {
            ctx.drawImage(tile.video, x, y, cellW, cellH);
          }
        } catch {}
      }

      const label = tile.meta?.textContent || "participant";
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.fillRect(x, y + cellH - 28, cellW, 28);
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.fillText(label.slice(0, 44), x + 8, y + cellH - 10);
    });

    if (recordingComposite) {
      recordingComposite.rafId = requestAnimationFrame(drawFrame);
    }
  }

  rebuildAudioMix();
  const mixIntervalId = setInterval(rebuildAudioMix, 1000);

  recordingComposite = {
    canvas,
    destination,
    mixIntervalId,
    rafId: requestAnimationFrame(drawFrame),
    stop: () => {
      if (recordingComposite?.rafId) cancelAnimationFrame(recordingComposite.rafId);
      if (recordingComposite?.mixIntervalId) clearInterval(recordingComposite.mixIntervalId);
      cleanupAudioMix();
      if (videoTrack) {
        try {
          videoTrack.stop();
        } catch {}
      }
      recordingComposite = null;
    }
  };

  const out = new MediaStream();
  if (videoTrack) out.addTrack(videoTrack);
  destination.stream.getAudioTracks().forEach((t) => out.addTrack(t));
  return out;
}

function buildAudioRecordingStream() {
  const ac = ensureAudioContext();
  const destination = ac.createMediaStreamDestination();
  const mixNodes = new Map();

  function cleanupNode(node) {
    if (!node) return;
    try {
      node.source.disconnect();
    } catch {}
    try {
      node.gain.disconnect();
    } catch {}
  }

  function cleanupAudioMix() {
    for (const n of mixNodes.values()) {
      cleanupNode(n);
    }
    mixNodes.clear();
  }

  function syncAudioMix() {
    const activeTrackIds = new Set();

    for (const [, tile] of peerTiles.entries()) {
      const track = tile.stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live" || !track.enabled) continue;
      const trackId = String(track.id || "");
      if (!trackId) continue;
      activeTrackIds.add(trackId);
      if (mixNodes.has(trackId)) continue;
      try {
        const stream = new MediaStream([track]);
        const source = ac.createMediaStreamSource(stream);
        const gain = ac.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(destination);
        mixNodes.set(trackId, { source, gain, trackId });
      } catch {}
    }

    for (const [trackId, node] of [...mixNodes.entries()]) {
      if (activeTrackIds.has(trackId)) continue;
      cleanupNode(node);
      mixNodes.delete(trackId);
    }
  }

  syncAudioMix();
  const mixIntervalId = setInterval(syncAudioMix, 350);

  recordingAudioMix = {
    mixIntervalId,
    sync: syncAudioMix,
    stop: () => {
      if (recordingAudioMix?.mixIntervalId) clearInterval(recordingAudioMix.mixIntervalId);
      cleanupAudioMix();
      recordingAudioMix = null;
    }
  };

  const out = new MediaStream();
  destination.stream.getAudioTracks().forEach((t) => out.addTrack(t));
  return out;
}

function sanitizeRoomId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function generateRoomName() {
  const adjective = ROOM_ADJECTIVES[Math.floor(Math.random() * ROOM_ADJECTIVES.length)];
  const noun = ROOM_NOUNS[Math.floor(Math.random() * ROOM_NOUNS.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${adjective}-${noun}-${suffix}`;
}

function getOrCreateEmbedDisplayName() {
  const storageKey = "drvideo.embed.displayName";
  try {
    const saved = String(window.localStorage.getItem(storageKey) || "").trim();
    if (saved) return saved;
  } catch {}
  const generated = `guest_${Math.random().toString(36).slice(2, 8)}`;
  try {
    window.localStorage.setItem(storageKey, generated);
  } catch {}
  return generated;
}

function readRoomFromPath() {
  const pathname = String(window.location.pathname || "");
  const normalizedPath =
    BASE_PATH && pathname.startsWith(BASE_PATH + "/")
      ? pathname.slice(BASE_PATH.length)
      : pathname;
  const match = normalizedPath.match(/^\/meet\/([^/?#]+)/i);
  return match ? sanitizeRoomId(decodeURIComponent(match[1])) : "";
}

function updateMeetingUrl(room, name = "") {
  const safeRoom = sanitizeRoomId(room);
  if (!safeRoom) return;
  const next = new URL(window.location.href);
  next.pathname = withBasePath("/meet/" + encodeURIComponent(safeRoom));
  const selectedTranscriptionLanguage =
    getJoinTranscriptionLanguagePreference() ||
    normalizeTranscriptionLanguage(next.searchParams.get("transcriptionLanguage") || next.searchParams.get("transcriptionLang") || "") ||
    normalizeTranscriptionLanguage(transcriptionLanguage);
  if (name.trim()) next.searchParams.set("name", name.trim());
  else next.searchParams.delete("name");
  if (selectedTranscriptionLanguage) next.searchParams.set("transcriptionLanguage", selectedTranscriptionLanguage);
  else {
    next.searchParams.delete("transcriptionLanguage");
    next.searchParams.delete("transcriptionLang");
  }
  window.history.replaceState({}, "", next.toString());
}

function readQueryParamFromHref(paramName) {
  const href = String(window.location.href || "");
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`[?&]${escaped}=([^&#\\s]+)`, "i");
  const match = href.match(re);
  if (!match || !match[1]) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
  } catch {
    return String(match[1]).replace(/\+/g, " ").trim();
  }
}

function initializeJoinFields() {
  const url = new URL(window.location.href);
  const roomFromPath = readRoomFromPath();
  const roomFromQuery = sanitizeRoomId(url.searchParams.get("room"));
  let nameFromQuery =
    (url.searchParams.get("name") || url.searchParams.get("user") || "").trim() ||
    readQueryParamFromHref("name") ||
    readQueryParamFromHref("user");
  const meetingIdFromQuery = (url.searchParams.get("meetingId") || "").trim();
  const autoRecordAudioFromQuery = String(url.searchParams.get("autorecordaudio") || "")
    .trim()
    .toLowerCase();
  const autoRecordVideoFromQuery = String(url.searchParams.get("autorecordvideo") || "")
    .trim()
    .toLowerCase();
  const autoRecordLegacyFromQuery = String(url.searchParams.get("autorecord") ?? url.searchParams.get("autoRecord") ?? "")
    .trim()
    .toLowerCase();
  const recModeFromQuery = String(url.searchParams.get("recordmode") || "")
    .trim()
    .toLowerCase();
  const transcriptionLanguageFromQuery =
    url.searchParams.get("transcriptionLanguage") ||
    url.searchParams.get("transcriptionLang") ||
    "";

  const initialRoom = roomFromPath || roomFromQuery || sanitizeRoomId(roomEl.value);
  const hasRoomInUrl = Boolean(roomFromPath || roomFromQuery);
  if (!nameFromQuery && EMBED_MODE && hasRoomInUrl) {
    nameFromQuery = getOrCreateEmbedDisplayName();
  }
  const hasNameInUrl = Boolean(nameFromQuery);
  const hasAutoRecordInUrl =
    url.searchParams.has("autorecordaudio") ||
    url.searchParams.has("autorecordvideo") ||
    url.searchParams.has("autorecord") ||
    url.searchParams.has("autoRecord");
  const hasTranscriptionInUrl =
    url.searchParams.has("transcriptionLanguage") ||
    url.searchParams.has("transcriptionLang");

  if (roomJoinBlockEl) {
    roomJoinBlockEl.classList.toggle("hidden", hasRoomInUrl);
  }
  if (nameJoinBlockEl) {
    nameJoinBlockEl.classList.toggle("hidden", hasNameInUrl);
  }
  if (autoRecordJoinBlockEl) {
    autoRecordJoinBlockEl.classList.toggle("hidden", hasAutoRecordInUrl);
  }
  if (transcriptionJoinBlockEl) {
    transcriptionJoinBlockEl.classList.toggle("hidden", hasTranscriptionInUrl);
  }

  if (nameFromQuery && !nameEl.value.trim()) {
    nameEl.value = nameFromQuery;
  }

  if (initialRoom) {
    roomEl.value = initialRoom;
    updateMeetingUrl(initialRoom, nameEl.value || "");
  }

  if (meetingIdFromQuery) {
    meetingId = meetingIdFromQuery;
  }

  if (autoRecordAudioFromQuery && ["1", "true", "yes", "on"].includes(autoRecordAudioFromQuery)) {
    setAutoRecordMode("audio");
    hideRecordingButtonsByUrl = true;
  } else if (autoRecordVideoFromQuery && ["1", "true", "yes", "on"].includes(autoRecordVideoFromQuery)) {
    setAutoRecordMode("av");
    hideRecordingButtonsByUrl = true;
  } else if (autoRecordLegacyFromQuery) {
    if (["1", "true", "yes", "on"].includes(autoRecordLegacyFromQuery)) {
      setAutoRecordMode("av");
      hideRecordingButtonsByUrl = true;
    } else {
      autoRecordAudioEl.checked = false;
      autoRecordVideoEl.checked = false;
    }
  }

  if (recModeFromQuery) recordingMode = normalizeRecordingMode(recModeFromQuery);

  transcriptionLanguage = normalizeTranscriptionLanguage(transcriptionLanguageFromQuery);
  syncTranscriptionJoinControls();
  if (transcriptionLanguage) {
    log("Live transcription enabled (" + transcriptionLanguage.toUpperCase() + ")");
    if (EMBED_MODE) {
      setTranscriptPanelVisible(true);
    }
  }

  updateRoomBadge(initialRoom);
}

function log(line) {
  if (!logsEl) return;
  const ts = new Date().toISOString().slice(11, 19);
  logsEl.textContent = `[${ts}] ${line}\n` + logsEl.textContent;
}

function renderTranscriptBox() {
  if (!transcriptBoxEl || !transcriptLinesEl || !transcriptLiveEl) return;

  const hasFinal = transcriptFinalItems.length > 0;
  const hasInterim = Boolean(transcriptInterimItem);
  const isEnabled = Boolean(transcriptionLanguage) && isSocketOpen();

  transcriptLinesEl.innerHTML = "";
  for (const line of transcriptFinalItems) {
    const item = document.createElement("div");
    item.className = "transcript-line";
    item.textContent = line;
    transcriptLinesEl.appendChild(item);
  }
  transcriptLinesEl.scrollTop = transcriptLinesEl.scrollHeight;

  if (hasInterim) {
    transcriptLiveEl.textContent = transcriptInterimItem;
    transcriptLiveEl.classList.remove("hidden");
  } else if (isEnabled) {
    transcriptLiveEl.textContent = `Listening (${transcriptionLanguage.toUpperCase()})...`;
    transcriptLiveEl.classList.remove("hidden");
  } else if (Boolean(transcriptionLanguage) && !isSocketOpen()) {
    transcriptLiveEl.textContent = `Transcription ready (${transcriptionLanguage.toUpperCase()})`;
    transcriptLiveEl.classList.remove("hidden");
  } else if (!isEnabled && !hasFinal && !hasInterim) {
    transcriptLiveEl.textContent = "Transcription off";
    transcriptLiveEl.classList.remove("hidden");
  } else {
    transcriptLiveEl.textContent = "";
    transcriptLiveEl.classList.add("hidden");
  }
}

function clearTranscriptBox() {
  transcriptFinalItems = [];
  transcriptInterimItem = "";
  lastTranscriptSpeakerKey = "";
  renderTranscriptBox();
}

function resolveTranscriptSourceName(payload = {}) {
  const mappedPeerName = String(payload.mappedPeerName || "").trim();
  const mappedPeerId = String(payload.mappedPeerId || "").trim();
  const diarizedSpeakerId = String(payload.speakerId || "").trim();
  const sourcePeerId = String(payload.peerId || "").trim();
  return (
    mappedPeerName ||
    mappedPeerId ||
    diarizedSpeakerId ||
    (sourcePeerId === peerId ? "you" : (peerNames.get(sourcePeerId) || sourcePeerId || "participant"))
  );
}

function pushTranscriptLine(payload = {}) {
  const text = String(payload.text || "").trim();
  if (!text) return;
  const language = String(payload.language || "").toUpperCase() || "N/A";
  const sourceName = resolveTranscriptSourceName(payload);
  const speakerKey = `${language}|${sourceName}`;
  const line = lastTranscriptSpeakerKey === speakerKey ? text : `[${language}] ${sourceName}: ${text}`;
  transcriptFinalItems.push(line);
  lastTranscriptSpeakerKey = speakerKey;
  if (transcriptFinalItems.length > MAX_TRANSCRIPT_LINES) {
    transcriptFinalItems = transcriptFinalItems.slice(transcriptFinalItems.length - MAX_TRANSCRIPT_LINES);
  }
}

function loadTranscriptHistory(entries = []) {
  transcriptFinalItems = [];
  transcriptInterimItem = "";
  lastTranscriptSpeakerKey = "";
  if (!Array.isArray(entries) || entries.length === 0) {
    renderTranscriptBox();
    return;
  }
  for (const item of entries) {
    pushTranscriptLine(item || {});
  }
  renderTranscriptBox();
}

function clearChatBox() {
  if (!chatMessagesEl) return;
  chatMessagesEl.innerHTML = "";
}

function appendChatLine(author, text, { self = false } = {}) {
  if (!chatMessagesEl) return;
  const safeAuthor = String(author || "participant").trim() || "participant";
  const safeText = String(text || "").trim();
  if (!safeText) return;

  const line = document.createElement("div");
  line.className = "chat-line";
  const who = document.createElement("span");
  who.className = "chat-author";
  who.textContent = `${safeAuthor}: `;
  const body = document.createElement("span");
  body.textContent = safeText;
  line.appendChild(who);
  line.appendChild(body);
  if (self) line.style.color = "#0b4d8b";
  chatMessagesEl.appendChild(line);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setControlButton(button, icon, label, options = {}) {
  if (!button) return;
  const iconMarkup = ICONS[icon] || "";
  const gearId = String(options.gearId || "").trim();
  const gearTitle = String(options.gearTitle || "Device settings").trim();
  const gearMarkup = gearId
    ? `<span id="${gearId}" class="gear-suffix" role="button" aria-label="${gearTitle}" title="${gearTitle}">${GEAR_ICON}</span>`
    : "";
  button.innerHTML = `<span class="ctrl-icon">${iconMarkup}</span><span class="ctrl-label">${label}</span>${gearMarkup}`;
  button.classList.toggle("with-gear", Boolean(gearId));
  button.title = label;
  button.setAttribute("aria-label", label);
}

function closeDevicePopovers() {
  micDevicePopover?.classList.add("hidden");
  camDevicePopover?.classList.add("hidden");
}

function toggleDevicePopover(kind) {
  if (kind === "mic") {
    const willOpen = micDevicePopover?.classList.contains("hidden");
    closeDevicePopovers();
    if (willOpen) micDevicePopover?.classList.remove("hidden");
    return;
  }
  const willOpen = camDevicePopover?.classList.contains("hidden");
  closeDevicePopovers();
  if (willOpen) camDevicePopover?.classList.remove("hidden");
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function attachSpeakerAnalyser(peerKey, track) {
  if (!track) return;
  try {
    const ctx = ensureAudioContext();
    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    audioAnalyserByPeer.set(peerKey, { source, analyser, stream });
  } catch {}
}

function detachSpeakerAnalyser(peerKey) {
  const node = audioAnalyserByPeer.get(peerKey);
  if (!node) return;
  try {
    node.source.disconnect();
  } catch {}
  audioAnalyserByPeer.delete(peerKey);
}

function refreshViewButton() {
  const icon = viewMode === "speaker" ? "viewSpeaker" : viewMode === "grid" ? "viewGrid" : "viewAuto";
  const label = viewMode === "speaker" ? "View: Speaker" : viewMode === "grid" ? "View: Grid" : "View: Auto";
  setControlButton(viewToggleBtn, icon, label);
  postHostEvent("view-state", { mode: viewMode });
}

function refreshTranscriptToggleButton() {
  if (!transcriptToggleBtn) return;
  const icon = transcriptPanelVisible ? "transcriptOn" : "transcriptOff";
  const label = transcriptPanelVisible ? "Hide transcription panel" : "Show transcription panel";
  setControlButton(transcriptToggleBtn, icon, label);
  transcriptToggleBtn.disabled = !document.body.classList.contains("in-call");
}

function refreshChatToggleButton() {
  if (!chatToggleBtn) return;
  const icon = chatPanelVisible ? "chatOn" : "chatOff";
  const label = chatPanelVisible ? "Hide chat panel" : "Show chat panel";
  setControlButton(chatToggleBtn, icon, label);
  chatToggleBtn.disabled = !document.body.classList.contains("in-call");
}

function setTranscriptPanelVisible(visible) {
  transcriptPanelVisible = Boolean(visible);
  document.body.classList.toggle(
    "transcript-open",
    document.body.classList.contains("in-call") && transcriptPanelVisible
  );
  document.body.classList.toggle(
    "chat-open",
    document.body.classList.contains("in-call") && transcriptPanelVisible && chatPanelVisible
  );
  refreshTranscriptToggleButton();
  refreshChatToggleButton();
}

function setChatPanelVisible(visible) {
  chatPanelVisible = Boolean(visible);
  document.body.classList.toggle(
    "chat-open",
    document.body.classList.contains("in-call") && transcriptPanelVisible && chatPanelVisible
  );
  refreshChatToggleButton();
}

function updateVideosLayout() {
  const count = peerTiles.size;
  videosEl.dataset.count = String(count);
  videosEl.classList.remove("mode-auto", "mode-grid", "mode-speaker");
  videosEl.classList.add(`mode-${viewMode}`);

  const resolvedCols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
  videosEl.style.setProperty("--grid-cols", String(resolvedCols));

  let chosenSpeaker = null;
  if (viewMode === "speaker") {
    if (pinnedSpeakerPeerId && peerTiles.has(pinnedSpeakerPeerId)) chosenSpeaker = pinnedSpeakerPeerId;
    else if (activeSpeakerPeerId && peerTiles.has(activeSpeakerPeerId)) chosenSpeaker = activeSpeakerPeerId;
    else if ([...peerTiles.keys()].some((k) => k !== "local")) chosenSpeaker = [...peerTiles.keys()].find((k) => k !== "local");
    else chosenSpeaker = "local";
  }

  for (const [peerKey, tile] of peerTiles.entries()) {
    const isChosen = Boolean(chosenSpeaker && peerKey === chosenSpeaker);
    tile.wrap.classList.toggle("active-speaker", isChosen);
    tile.wrap.classList.toggle("secondary-speaker", viewMode === "speaker" && !isChosen);
  }

  if (viewMode === "speaker" && chosenSpeaker && peerTiles.has(chosenSpeaker)) {
    const mainTile = peerTiles.get(chosenSpeaker);
    if (mainTile && mainTile.wrap && mainTile.wrap.parentElement === videosEl) {
      videosEl.prepend(mainTile.wrap);
    }
  }
}

function cycleViewMode() {
  const order = ["auto", "grid", "speaker"];
  const idx = order.indexOf(viewMode);
  viewMode = order[(idx + 1) % order.length];
  if (viewMode !== "speaker") pinnedSpeakerPeerId = null;
  refreshViewButton();
  updateVideosLayout();
}

function pollActiveSpeaker() {
  let winner = null;
  let maxLevel = 0.01;

  for (const [peerKey, node] of audioAnalyserByPeer.entries()) {
    const data = new Uint8Array(node.analyser.fftSize);
    node.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms > maxLevel) {
      maxLevel = rms;
      winner = peerKey;
    }
  }

  if (winner && winner !== activeSpeakerPeerId) {
    activeSpeakerPeerId = winner;
    if (!pinnedSpeakerPeerId) updateVideosLayout();
  }

  if (!winner) return;
  if (!isSocketOpen()) return;
  if (!transcriptionLanguage) return;
  if (!recordingEnabled || recordingOwnerPeerId !== peerId) return;

  const now = Date.now();
  const shouldEmit = winner !== lastActiveSpeakerPeerKey || now - lastActiveSpeakerEmitAt > 1400;
  if (!shouldEmit) return;

  const activePeerId = winner === "local" ? peerId : String(winner);
  try {
    ws.send(
      JSON.stringify({
        action: "activeSpeaker",
        data: {
          activePeerId,
          ts: now
        }
      })
    );
    lastActiveSpeakerEmitAt = now;
    lastActiveSpeakerPeerKey = winner;
  } catch {}
}

function isSocketOpen() {
  return Boolean(ws && ws.readyState === WebSocket.OPEN);
}

function updateRoomBadge(room = roomId || roomEl.value) {
  const safe = sanitizeRoomId(room);
  roomBadgeEl.textContent = safe ? `Room: ${safe}` : "No room";
}

function buildInviteUrl() {
  const safeRoom = sanitizeRoomId(roomId || roomEl.value);
  if (!safeRoom) return "";
  const url = new URL(withBasePath("/meet/" + encodeURIComponent(safeRoom)), window.location.origin);
  url.searchParams.set("autojoin", "1");
  return url.toString();
}

function renderParticipants() {
  participantListEl.innerHTML = "";

  const participants = [];
  if (peerId && nameEl.value.trim()) {
    participants.push({ id: "local", label: `${nameEl.value.trim()} (you)` });
  }

  for (const [id, label] of peerNames.entries()) {
    participants.push({ id, label: label || id });
  }

  if (participants.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No participants yet";
    participantListEl.appendChild(li);
  } else {
    participants.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p.label;
      participantListEl.appendChild(li);
    });
  }

  participantCountEl.textContent = String(participants.length);
  postHostEvent("participants", { count: participants.length, participants: participants.map((p) => p.label) });
}

function setConnectedView(connected) {
  if (EMBED_MODE) {
    lobbyPanelEl.classList.add("hidden");
    callShellEl.classList.remove("hidden");
    document.body.classList.toggle("embed-connected", connected);
    return;
  }
  document.body.classList.toggle("in-call", connected);
  document.body.classList.toggle("transcript-open", connected && transcriptPanelVisible);
  document.body.classList.toggle("chat-open", connected && transcriptPanelVisible && chatPanelVisible);
  lobbyPanelEl.classList.toggle("hidden", connected);
  callShellEl.classList.toggle("hidden", !connected);
}

function createTile(peerKey, label, { isLocal = false } = {}) {
  const wrap = document.createElement("article");
  wrap.className = "tile";
  wrap.dataset.peer = peerKey;

  const meta = document.createElement("div");
  meta.className = "tile-meta";
  meta.textContent = label;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.playsInline = true;
  audio.muted = isLocal;
  audio.style.display = "none";

  const stream = new MediaStream();
  video.srcObject = stream;
  audio.srcObject = stream;

  wrap.appendChild(meta);
  wrap.appendChild(video);
  wrap.appendChild(audio);
  videosEl.appendChild(wrap);

  if (!isLocal) {
    const labelForLog = () => {
      const current = peerTiles.get(peerKey);
      return (current && current.meta && current.meta.textContent) || label;
    };

    video.addEventListener("playing", () => log("Remote video playing: " + labelForLog()));
    video.addEventListener("stalled", () => log("Remote video stalled: " + labelForLog()));
    video.addEventListener("waiting", () => log("Remote video waiting: " + labelForLog()));
    video.addEventListener("error", () => log("Remote video error: " + labelForLog()));
  }

  const tile = { wrap, meta, video, audio, stream, isLocal };
  peerTiles.set(peerKey, tile);
  if (!isLocal) {
    wrap.addEventListener("click", () => {
      if (viewMode !== "speaker") return;
      pinnedSpeakerPeerId = peerKey;
      updateVideosLayout();
    });
  }
  updateVideosLayout();
  return tile;
}

function ensureTile(peerKey, label, opts) {
  const existing = peerTiles.get(peerKey);
  if (existing) {
    existing.meta.textContent = label;
    return existing;
  }
  return createTile(peerKey, label, opts);
}

function removeTrackByKind(stream, kind) {
  const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  tracks.forEach((track) => {
    stream.removeTrack(track);
    track.stop();
  });
}

function observeIncomingTrack(peerKey, kind, track) {
  if (!track || observedTracks.has(track)) return;
  observedTracks.add(track);

  const who = () => {
    const tile = peerTiles.get(peerKey);
    return (tile && tile.meta && tile.meta.textContent) || peerKey;
  };

  track.onmute = () => log("Track muted: " + who() + " (" + kind + ")");
  track.onunmute = () => log("Track unmuted: " + who() + " (" + kind + ")");
  track.onended = () => log("Track ended: " + who() + " (" + kind + ")");
}

function setTileTrack(peerKey, kind, track) {
  const tile = peerTiles.get(peerKey);
  if (!tile) return;

  removeTrackByKind(tile.stream, kind);
  tile.stream.addTrack(track);

  if (!tile.isLocal) {
    observeIncomingTrack(peerKey, kind, track);
  }
  if (kind === "audio") {
    detachSpeakerAnalyser(peerKey);
    attachSpeakerAnalyser(peerKey, track);
  }

  if (kind === "video") {
    tile.video.play().catch(() => null);
  } else if (kind === "audio" && !tile.isLocal) {
    tile.audio.play().catch(() => null);
  }

  if (kind === "audio" && recordingAudioMix?.sync) {
    recordingAudioMix.sync();
  }
}

function removePeerTile(peerKey) {
  const tile = peerTiles.get(peerKey);
  if (!tile) return;

  tile.stream.getTracks().forEach((track) => {
    tile.stream.removeTrack(track);
    try {
      track.stop();
    } catch {}
  });

  tile.wrap.remove();
  peerTiles.delete(peerKey);
  detachSpeakerAnalyser(peerKey);
  if (activeSpeakerPeerId === peerKey) activeSpeakerPeerId = null;
  if (pinnedSpeakerPeerId === peerKey) pinnedSpeakerPeerId = null;
  if (recordingAudioMix?.sync) recordingAudioMix.sync();
  updateVideosLayout();
}

function refreshMicCamButtons() {
  const connected = isSocketOpen() && Boolean(audioProducer || videoProducer);
  const micText = micEnabled ? "Mute mic" : "Unmute mic";
  const camText = camEnabled ? "Disable cam" : "Enable cam";
  const micIcon = micEnabled ? "micOn" : "micOff";
  const camIcon = camEnabled ? "camOn" : "camOff";

  setControlButton(micToggleBtn, micIcon, micText, {
    gearId: "micDeviceBtn",
    gearTitle: "Microphone settings"
  });
  setControlButton(camToggleBtn, camIcon, camText, {
    gearId: "camDeviceBtn",
    gearTitle: "Camera settings"
  });
  setControlButton(dockMicBtn, micIcon, micText);
  setControlButton(dockCamBtn, camIcon, camText);

  micToggleBtn.disabled = !connected || !audioProducer;
  camToggleBtn.disabled = !connected || !videoProducer;
  dockMicBtn.disabled = !connected || !audioProducer;
  dockCamBtn.disabled = !connected || !videoProducer;
  postHostEvent("media-state", { micEnabled, camEnabled });
}

function refreshRecordingButtons() {
  const iAmOwner = recordingOwnerPeerId === peerId;
  const connected = isSocketOpen();
  const activeMode = normalizeRecordingMode(recordingMode);
  let audioText = "Record audio";
  let videoText = "Record video+audio";
  let audioIcon = "recAudioOn";
  let videoIcon = "recOn";
  let audioDisabled = !connected;
  let videoDisabled = !connected;

  if (recordingEnabled && !iAmOwner) {
    if (activeMode === "audio") {
      audioText = "Audio recording in progress";
      audioIcon = "recAudioBusy";
    } else {
      videoText = "Video+audio recording in progress";
      videoIcon = "recBusy";
    }
    audioDisabled = true;
    videoDisabled = true;
  } else if (rec && iAmOwner) {
    if (activeMode === "audio") {
      audioText = "Stop audio recording";
      audioIcon = "recOff";
      audioDisabled = false;
      videoDisabled = true;
    } else {
      videoText = "Stop video+audio recording";
      videoIcon = "recOff";
      videoDisabled = false;
      audioDisabled = true;
    }
  }

  setControlButton(recAudioToggleBtn, audioIcon, audioText);
  setControlButton(dockRecAudioBtn, audioIcon, audioText);
  setControlButton(recVideoToggleBtn, videoIcon, videoText);
  setControlButton(dockRecVideoBtn, videoIcon, videoText);

  recAudioToggleBtn.disabled = audioDisabled;
  dockRecAudioBtn.disabled = audioDisabled;
  recVideoToggleBtn.disabled = videoDisabled;
  dockRecVideoBtn.disabled = videoDisabled;
  applyRecordingButtonsVisibility();
}

function refreshLeaveButtons() {
  const connected = isSocketOpen();
  setControlButton(dockLeaveBtn, "leave", "Leave");
  leaveBtn.disabled = !connected;
  dockLeaveBtn.disabled = !connected;
}

function refreshInviteButton() {
  if (!inviteBtn) return;
  const connected = isSocketOpen();
  inviteBtn.classList.toggle("hidden", !connected);
  inviteBtn.disabled = !connected;
  inviteBtn.textContent = "Invite";
  inviteBtn.title = "Copy invite link";
}

function cleanDeviceLabel(label, fallback) {
  const base = String(label || "").trim() || fallback;
  return base
    .replace(/\s*\(default\)\s*/gi, " ")
    .replace(/\s*\(built-?in\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSelectOptions(selectEl, devices, kind, previousValue) {
  selectEl.innerHTML = "";
  const fallbackPrefix = kind === "audio" ? "Microphone" : "Camera";

  if (!devices.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = kind === "audio" ? "No microphone detected" : "No camera detected";
    selectEl.appendChild(empty);
    selectEl.dataset.realCount = "0";
    selectEl.disabled = true;
    return;
  }

  devices.forEach((d, i) => {
    const option = document.createElement("option");
    option.value = d.deviceId;
    option.textContent = cleanDeviceLabel(d.label, `${fallbackPrefix} ${i + 1}`);
    option.title = option.textContent;
    selectEl.appendChild(option);
  });

  if (previousValue && [...selectEl.options].some((o) => o.value === previousValue)) {
    selectEl.value = previousValue;
  }

  selectEl.dataset.realCount = String(devices.length);
  selectEl.disabled = devices.length <= 1;
}

function refreshDevicePickerState() {
  const audioCount = Number(audioDeviceEl.dataset.realCount || 0);
  const videoCount = Number(videoDeviceEl.dataset.realCount || 0);

  dockAudioDeviceEl.disabled = audioCount <= 1;
  dockVideoDeviceEl.disabled = videoCount <= 1;

  audioDeviceEl.title = audioCount <= 1 ? "Only one microphone available" : "Choose microphone";
  videoDeviceEl.title = videoCount <= 1 ? "Only one camera available" : "Choose camera";
  dockAudioDeviceEl.title = audioCount <= 1 ? "Only one microphone available" : "Choose microphone";
  dockVideoDeviceEl.title = videoCount <= 1 ? "Only one camera available" : "Choose camera";
}

function refreshAllControls() {
  refreshViewButton();
  refreshTranscriptToggleButton();
  refreshChatToggleButton();
  refreshMicCamButtons();
  refreshRecordingButtons();
  refreshLeaveButtons();
  refreshInviteButton();
  refreshDevicePickerState();
  refreshOverlayAutoHideState();
  updateVideosLayout();
}

function clearOverlayHideTimer() {
  if (!overlayHideTimer) return;
  clearTimeout(overlayHideTimer);
  overlayHideTimer = null;
}

function showOverlays() {
  dockEl?.classList.remove("is-hidden");
  headerEl?.classList.remove("is-hidden");
}

function hideOverlaysIfIdle() {
  if (!overlayAutoHideEnabled) return;
  if (!document.body.classList.contains("in-call")) return;
  if (!isSocketOpen()) return;
  if (dockEl?.matches(":hover")) return;
  if (headerEl?.matches(":hover")) return;
  dockEl?.classList.add("is-hidden");
  headerEl?.classList.add("is-hidden");
}

function scheduleOverlayHide() {
  if (!overlayAutoHideEnabled) return;
  clearOverlayHideTimer();
  if (!document.body.classList.contains("in-call")) return;
  if (!isSocketOpen()) return;
  overlayHideTimer = setTimeout(() => {
    hideOverlaysIfIdle();
  }, OVERLAY_IDLE_MS);
}

function refreshOverlayAutoHideState() {
  if (!overlayAutoHideEnabled) {
    dockEl?.classList.remove("auto-hide", "is-hidden");
    headerEl?.classList.remove("auto-hide", "is-hidden");
    clearOverlayHideTimer();
    return;
  }

  dockEl?.classList.add("auto-hide");
  headerEl?.classList.add("auto-hide");
  if (!document.body.classList.contains("in-call") || !isSocketOpen()) {
    dockEl?.classList.remove("is-hidden");
    headerEl?.classList.remove("is-hidden");
    clearOverlayHideTimer();
    return;
  }
  showOverlays();
  scheduleOverlayHide();
}

function sendRequest(action, data = {}) {
  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  ws.send(JSON.stringify({ action, requestId, data }));

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error(`timeout: ${action}`));
    }, 10000);
  });
}

async function updateDeviceLists() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  const prevAudio = audioDeviceEl.value;
  const prevVideo = videoDeviceEl.value;

  buildSelectOptions(audioDeviceEl, audioInputs, "audio", prevAudio);
  buildSelectOptions(videoDeviceEl, videoInputs, "video", prevVideo);
  buildSelectOptions(dockAudioDeviceEl, audioInputs, "audio", prevAudio);
  buildSelectOptions(dockVideoDeviceEl, videoInputs, "video", prevVideo);

  if (audioDeviceEl.value) dockAudioDeviceEl.value = audioDeviceEl.value;
  if (videoDeviceEl.value) dockVideoDeviceEl.value = videoDeviceEl.value;

  refreshDevicePickerState();
}

function selectedAudioConstraint() {
  const id = audioDeviceEl.value;
  return {
    ...(id ? { deviceId: { exact: id } } : {}),
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
}

function selectedVideoConstraint() {
  const id = videoDeviceEl.value;
  return id ? { deviceId: { exact: id } } : true;
}

function stopPreviewStream() {
  if (!previewStream) return;
  previewStream.getTracks().forEach((t) => t.stop());
  previewStream = null;
}

async function refreshPreview() {
  if (!previewVideoEl || isSocketOpen()) return;

  try {
    stopPreviewStream();
    previewStream = await navigator.mediaDevices.getUserMedia({
      audio: selectedAudioConstraint(),
      video: selectedVideoConstraint()
    });
    previewVideoEl.srcObject = previewStream;
    previewVideoEl.play().catch(() => null);
  } catch (error) {
    log(`Preview unavailable: ${String(error)}`);
  }
}

async function switchAudioDevice() {
  if (!localStream) {
    await refreshPreview();
    return;
  }

  try {
    const temp = await navigator.mediaDevices.getUserMedia({
      audio: selectedAudioConstraint(),
      video: false
    });
    const newTrack = temp.getAudioTracks()[0];
    if (!newTrack) return;

    const oldTrack = localStream.getAudioTracks()[0];
    if (oldTrack) {
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    localStream.addTrack(newTrack);
    setTileTrack("local", "audio", newTrack);

    if (audioProducer) {
      await audioProducer.replaceTrack({ track: newTrack });
      if (!micEnabled) audioProducer.pause();
    }

    await updateDeviceLists();
    log("Microphone switched");
  } catch (error) {
    log(`Microphone switch failed: ${String(error)}`);
  }
}

async function switchVideoDevice() {
  if (!localStream) {
    await refreshPreview();
    return;
  }

  try {
    const temp = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: selectedVideoConstraint()
    });
    const newTrack = temp.getVideoTracks()[0];
    if (!newTrack) return;

    const oldTrack = localStream.getVideoTracks()[0];
    if (oldTrack) {
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    localStream.addTrack(newTrack);
    setTileTrack("local", "video", newTrack);

    if (videoProducer) {
      await videoProducer.replaceTrack({ track: newTrack });
      if (!camEnabled) videoProducer.pause();
    }

    await updateDeviceLists();
    log("Camera switched");
  } catch (error) {
    log(`Camera switch failed: ${String(error)}`);
  }
}

async function ensureRecvTransport() {
  if (recvTransport) return recvTransport;

  const params = await sendRequest("createTransport", { direction: "recv" });
  recvTransport = device.createRecvTransport(params);

  recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
    try {
      await sendRequest("connectTransport", { transportId: recvTransport.id, dtlsParameters });
      callback();
    } catch (error) {
      errback(error);
    }
  });

  return recvTransport;
}

async function consumeProducer({ producerId, peerId: remotePeerId, kind }) {
  if (!producerId || !remotePeerId) return;
  if (consumerByProducerId.has(producerId)) return;

  try {
    await ensureRecvTransport();

    const params = await sendRequest("consume", {
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities
    });

    const consumer = await recvTransport.consume({
      id: params.consumerId,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    });

    consumerByProducerId.set(producerId, { consumer, peerId: remotePeerId, kind: params.kind });

    const displayName = peerNames.get(remotePeerId) || remotePeerId;
    ensureTile(remotePeerId, displayName, { isLocal: false });
    setTileTrack(remotePeerId, params.kind, consumer.track);

    consumer.on("transportclose", () => {
      consumerByProducerId.delete(producerId);
    });

    consumer.on("trackended", () => {
      consumerByProducerId.delete(producerId);
    });

    await sendRequest("resumeConsumer", { consumerId: consumer.id });
  } catch (error) {
    log(`Consume failed for ${remotePeerId} (${kind}): ${String(error)}`);
  }
}

function buildTranscriptionAudioStream() {
  const ac = ensureAudioContext();
  const destination = ac.createMediaStreamDestination();
  const mixNodes = new Map();

  function cleanupNode(node) {
    if (!node) return;
    try {
      node.source.disconnect();
    } catch {}
    try {
      node.gain.disconnect();
    } catch {}
  }

  function syncAudioMix() {
    const activeTrackIds = new Set();

    for (const [, tile] of peerTiles.entries()) {
      const track = tile.stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live" || !track.enabled) continue;
      const trackId = String(track.id || "");
      if (!trackId) continue;
      activeTrackIds.add(trackId);
      if (mixNodes.has(trackId)) continue;
      try {
        const stream = new MediaStream([track]);
        const source = ac.createMediaStreamSource(stream);
        const gain = ac.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(destination);
        mixNodes.set(trackId, { source, gain, trackId });
      } catch {}
    }

    for (const [trackId, node] of [...mixNodes.entries()]) {
      if (activeTrackIds.has(trackId)) continue;
      cleanupNode(node);
      mixNodes.delete(trackId);
    }
  }

  syncAudioMix();

  const mixIntervalId = setInterval(syncAudioMix, 350);

  return {
    stream: destination.stream,
    stop: () => {
      clearInterval(mixIntervalId);
      for (const node of mixNodes.values()) cleanupNode(node);
      mixNodes.clear();
    }
  };
}

async function startTranscriptionRecorder(recordingSessionId = "") {
  if (!transcriptionLanguage || transcriptionRecorder || !roomId || !peerId) return;
  if (!recordingSessionId) return;

  try {
    const mixed = buildTranscriptionAudioStream();
    transcriptionAudioMixer = mixed;
    transcriptionRecorderSessionId = recordingSessionId;
    transcriptionRecorderSeq = 0;
    transcriptionUploadPending = [];

    const preferredMimeType = "audio/webm;codecs=opus";
    const mimeType = MediaRecorder.isTypeSupported(preferredMimeType) ? preferredMimeType : undefined;
    transcriptionRecorder = mimeType
      ? new MediaRecorder(mixed.stream, { mimeType })
      : new MediaRecorder(mixed.stream);

    transcriptionRecorder.ondataavailable = async (event) => {
      if (!event.data || !event.data.size) return;
      const url =
        withBasePath("/api/transcription/chunk?roomId=") + encodeURIComponent(roomId) +
        "&peerId=" + encodeURIComponent(peerId) +
        "&language=" + encodeURIComponent(transcriptionLanguage) +
        "&sessionId=" + encodeURIComponent(transcriptionRecorderSessionId) +
        "&seq=" + transcriptionRecorderSeq++;
      const uploadPromise = fetch(url, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: event.data
      })
        .catch((error) => {
          log("Transcription upload failed: " + String(error));
        })
        .finally(() => {
          const idx = transcriptionUploadPending.indexOf(uploadPromise);
          if (idx >= 0) transcriptionUploadPending.splice(idx, 1);
        });
      transcriptionUploadPending.push(uploadPromise);
    };

    transcriptionRecorder.onstop = async () => {
      if (transcriptionUploadPending.length) {
        await Promise.allSettled([...transcriptionUploadPending]);
      }

      try {
        await fetch(withBasePath("/api/transcription/finalize"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId, peerId, sessionId: transcriptionRecorderSessionId })
        });
      } catch {}

      if (transcriptionAudioMixer) {
        transcriptionAudioMixer.stop();
        transcriptionAudioMixer = null;
      }

      mixed.stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });

      transcriptionRecorder = null;
      transcriptionRecorderSessionId = "";
      transcriptionUploadPending = [];
    };

    transcriptionRecorder.start(1000);
  } catch (error) {
    log("Transcription start failed: " + String(error));
  }
}

async function stopTranscriptionRecorder() {
  if (!transcriptionRecorder) return;
  try {
    transcriptionRecorder.stop();
  } catch {}
}

async function beginLocalRecorder(mode = "av") {
  if (!localStream || rec) return;
  const normalizedMode = normalizeRecordingMode(mode);

  try {
    await ensureAudioContext().resume();
  } catch {}

  recSessionId = `${peerId}_${Date.now()}`;
  recSeq = 0;
  const pendingChunkUploads = [];
  const mediaStream =
    normalizedMode === "audio" ? buildAudioRecordingStream() : buildCompositeRecordingStream();
  const preferredMimeType =
    normalizedMode === "audio" ? "audio/webm;codecs=opus" : "video/webm;codecs=vp8,opus";
  const mimeType = MediaRecorder.isTypeSupported(preferredMimeType) ? preferredMimeType : undefined;
  rec = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);

  rec.ondataavailable = async (event) => {
    if (!event.data || !event.data.size) return;
    const url = withBasePath("/api/record/chunk?roomId=" + encodeURIComponent(roomId) + "&peerId=" + encodeURIComponent(peerId) + "&sessionId=" + encodeURIComponent(recSessionId) + "&mode=" + encodeURIComponent(normalizedMode) + "&seq=" + recSeq++);
    const uploadPromise = fetch(url, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: event.data
      })
      .catch((error) => {
        log(`Chunk upload failed: ${String(error)}`);
      })
      .finally(() => {
        const idx = pendingChunkUploads.indexOf(uploadPromise);
        if (idx >= 0) pendingChunkUploads.splice(idx, 1);
      });
    pendingChunkUploads.push(uploadPromise);
  };

  if (transcriptionLanguage) {
    await startTranscriptionRecorder(recSessionId);
  }

  rec.onstop = async () => {
    await stopTranscriptionRecorder();

    if (recordingComposite) {
      recordingComposite.stop();
    }
    if (recordingAudioMix) {
      recordingAudioMix.stop();
    }

    mediaStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });

    if (pendingChunkUploads.length) {
      await Promise.allSettled([...pendingChunkUploads]);
    }

    try {
      await fetch(withBasePath("/api/record/finalize"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, sessionId: recSessionId, mode: normalizedMode })
      });
    } catch {}

    const iAmOwner = recordingOwnerPeerId === peerId;
    rec = null;

    if (isSocketOpen() && iAmOwner) {
      try {
        const state = await sendRequest("setRecording", { enabled: false, mode: normalizedMode });
        recordingEnabled = Boolean(state?.enabled);
        recordingOwnerPeerId = state?.ownerPeerId ?? null;
        recordingMode = normalizeRecordingMode(state?.mode || "av");
      } catch (error) {
        log(`Unable to release recording lock: ${String(error)}`);
      }
    }

    log(`Recording stopped (${normalizedMode === "audio" ? "audio-only" : "video+audio"})`);
    refreshRecordingButtons();
  };

  rec.start(2000);
  log(`Recording started (${normalizedMode === "audio" ? "audio-only mix" : "video+audio mix"})`);
  refreshRecordingButtons();
}

async function startRecording(mode = "av") {
  if (!localStream || rec) return;
  const normalizedMode = normalizeRecordingMode(mode);

  try {
    const state = await sendRequest("setRecording", {
      enabled: true,
      mode: normalizedMode,
      transcriptionLanguage: transcriptionLanguage || ""
    });
    recordingEnabled = Boolean(state?.enabled);
    recordingOwnerPeerId = state?.ownerPeerId ?? null;
    recordingMode = normalizeRecordingMode(state?.mode || normalizedMode);
    if (state?.transcriptionLanguage) {
      transcriptionLanguage = normalizeTranscriptionLanguage(state.transcriptionLanguage);
      syncTranscriptionJoinControls();
      renderTranscriptBox();
    }

    if (recordingOwnerPeerId !== peerId) {
      log("Recording already active by another participant.");
      refreshRecordingButtons();
      return;
    }

    await beginLocalRecorder(recordingMode);
  } catch (error) {
    log(`Cannot start recording: ${String(error)}`);
    refreshRecordingButtons();
  }
}

async function stopRecording() {
  if (!rec) return;
  rec.stop();
}

async function toggleMic() {
  if (!audioProducer) return;
  micEnabled = !micEnabled;
  if (micEnabled) {
    await audioProducer.resume();
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
  } else {
    await audioProducer.pause();
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }
  refreshMicCamButtons();
}

async function toggleCam() {
  if (!videoProducer) return;
  camEnabled = !camEnabled;
  if (camEnabled) {
    await videoProducer.resume();
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = true;
    });
  } else {
    await videoProducer.pause();
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = false;
    });
  }
  refreshMicCamButtons();
}

function clearRemoteState() {
  for (const key of [...peerTiles.keys()]) {
    removePeerTile(key);
  }
  consumerByProducerId.clear();
  peerNames.clear();
  renderParticipants();
}

function resetRtcState() {
  [audioProducer, videoProducer].forEach((p) => {
    if (!p) return;
    try {
      p.close();
    } catch {}
  });

  audioProducer = null;
  videoProducer = null;

  if (sendTransport) {
    try {
      sendTransport.close();
    } catch {}
    sendTransport = null;
  }

  if (recvTransport) {
    try {
      recvTransport.close();
    } catch {}
    recvTransport = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (rec) {
    try {
      rec.stop();
    } catch {}
    rec = null;
  }

  if (transcriptionRecorder) {
    try {
      transcriptionRecorder.stop();
    } catch {}
    transcriptionRecorder = null;
  }
  if (transcriptionAudioMixer) {
    try {
      transcriptionAudioMixer.stop();
    } catch {}
    transcriptionAudioMixer = null;
  }
  transcriptionRecorderSessionId = "";
  transcriptionUploadPending = [];

  if (recordingComposite) {
    try {
      recordingComposite.stop();
    } catch {}
    recordingComposite = null;
  }

  if (recordingAudioMix) {
    try {
      recordingAudioMix.stop();
    } catch {}
    recordingAudioMix = null;
  }

  pending.clear();
  device = null;
  micEnabled = true;
  camEnabled = true;
  recordingEnabled = false;
  recordingOwnerPeerId = null;
  recordingMode = "av";
  activeSpeakerPeerId = null;
  pinnedSpeakerPeerId = null;
  lastActiveSpeakerEmitAt = 0;
  lastActiveSpeakerPeerKey = "";
  clearTranscriptBox();

  clearRemoteState();
}

async function joinRoom() {
  if (isSocketOpen()) {
    log("Already connected");
    return;
  }

  resetRtcState();

  roomId = sanitizeRoomId(roomEl.value);
  if (!roomId) {
    roomId = generateRoomName();
    roomEl.value = roomId;
  }

  const displayName = nameEl.value.trim();
  if (!displayName) {
    setStatus("Enter your name before joining");
    log("Join blocked: display name is required");
    nameEl.focus();
    return;
  }

  transcriptionLanguage = getJoinTranscriptionLanguagePreference();

  updateMeetingUrl(roomId, displayName);
  updateRoomBadge(roomId);

  stopPreviewStream();

  const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(wsProtocol + "://" + location.host + withBasePath("/ws"));

  ws.onopen = async () => {
    try {
      setStatus("Connecting...");
      clearRemoteState();

      const joined = await sendRequest("join", {
        roomId,
        meetingId: meetingId || "",
        name: displayName,
        autoRecordMode: getAutoRecordModePreference(),
        transcriptionLanguage: transcriptionLanguage || ""
      });
      peerId = joined.peerId;
      loadTranscriptHistory(Array.isArray(joined.transcriptHistory) ? joined.transcriptHistory : []);
      clearChatBox();
      if (Array.isArray(joined.chatMessages)) {
        joined.chatMessages.forEach((m) => {
          const mText = String(m?.text || "").trim();
          if (!mText) return;
          const mPeerId = String(m?.peerId || "").trim();
          const mName = String(m?.name || "").trim();
          appendChatLine(mPeerId === peerId ? "you" : (mName || mPeerId || "participant"), mText, {
            self: mPeerId === peerId
          });
        });
      }
      recordingEnabled = Boolean(joined.recordingEnabled ?? joined.autoRecord);
      recordingOwnerPeerId = joined.recordingOwnerPeerId ?? null;
      recordingMode = normalizeRecordingMode(joined.recordingMode || joined.autoRecordMode || "av");
      const roomRecordingTranscriptionLanguage = normalizeTranscriptionLanguage(joined.recordingTranscriptionLanguage || "");
      if (!transcriptionLanguage && roomRecordingTranscriptionLanguage) {
        transcriptionLanguage = roomRecordingTranscriptionLanguage;
        syncTranscriptionJoinControls();
      }

      device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: joined.rtpCapabilities });

      const sendParams = await sendRequest("createTransport", { direction: "send" });
      sendTransport = device.createSendTransport(sendParams);

      sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await sendRequest("connectTransport", { transportId: sendTransport.id, dtlsParameters });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const result = await sendRequest("produce", {
            transportId: sendTransport.id,
            kind,
            rtpParameters
          });
          callback({ id: result.producerId });
        } catch (error) {
          errback(error);
        }
      });

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioConstraint(),
        video: selectedVideoConstraint()
      });

      ensureTile("local", `${displayName} (you)`, { isLocal: true });
      const localAudioTrack = localStream.getAudioTracks()[0];
      const localVideoTrack = localStream.getVideoTracks()[0];
      if (localAudioTrack) setTileTrack("local", "audio", localAudioTrack);
      if (localVideoTrack) setTileTrack("local", "video", localVideoTrack);

      if (localAudioTrack) {
        audioProducer = await sendTransport.produce({
          track: localAudioTrack,
          codecOptions: {
            opusStereo: false,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000,
            opusMaxAverageBitrate: 64000,
            opusPtime: 20
          }
        });
      }

      const preferredVideoCodec = device.rtpCapabilities.codecs.find(
        (codec) => String(codec.mimeType || "").toLowerCase() === "video/vp8"
      );

      if (localVideoTrack) {
        videoProducer = await sendTransport.produce(
          preferredVideoCodec
            ? { track: localVideoTrack, codec: preferredVideoCodec }
            : { track: localVideoTrack }
        );
      }

      joined.peers?.forEach((p) => {
        peerNames.set(p.peerId, p.name || p.peerId);
        ensureTile(p.peerId, p.name || p.peerId, { isLocal: false });
      });

      for (const prod of joined.producerIds || []) {
        await consumeProducer(prod);
      }

      await updateDeviceLists();

      if (recordingOwnerPeerId === peerId) {
        await beginLocalRecorder(recordingMode);
      } else if (getAutoRecordModePreference() && !recordingEnabled) {
        await startRecording(getAutoRecordModePreference());
      }

      setConnectedView(true);
      renderTranscriptBox();
      renderParticipants();
      setStatus(`Connected to ${roomId}`);
      log(`Joined room ${roomId} as ${peerId}`);
      if (transcriptionLanguage) {
        log("Transcription language: " + transcriptionLanguage.toUpperCase());
      }
      postHostEvent("connected", { connected: true, name: displayName });
      refreshAllControls();
    } catch (error) {
      log(`Join failed: ${String(error)}`);
      setStatus("Failed");
      try {
        ws.close();
      } catch {}
      ws = null;
      resetRtcState();
      setConnectedView(false);
      refreshAllControls();
      postHostEvent("join-error", { message: String(error) });
      await refreshPreview();
    }
  };

  ws.onmessage = async (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.requestId) {
      const entry = pending.get(payload.requestId);
      if (!entry) return;
      pending.delete(payload.requestId);
      if (payload.ok) entry.resolve(payload.data || {});
      else entry.reject(new Error(payload.error || "request failed"));
      return;
    }

    if (payload.event === "peer-joined") {
      const p = payload.data;
      if (p?.peerId) {
        peerNames.set(p.peerId, p.name || p.peerId);
        ensureTile(p.peerId, p.name || p.peerId, { isLocal: false });
        renderParticipants();
      }
      return;
    }

    if (payload.event === "peer-left") {
      const p = payload.data;
      if (p?.peerId) {
        peerNames.delete(p.peerId);
        removePeerTile(p.peerId);
        for (const [producerId, info] of consumerByProducerId.entries()) {
          if (info.peerId === p.peerId) {
            try {
              info.consumer.close();
            } catch {}
            consumerByProducerId.delete(producerId);
          }
        }
        renderParticipants();
      }
      return;
    }

    if (payload.event === "new-producer") {
      await consumeProducer(payload.data);
      return;
    }

    if (payload.event === "consumer-closed") {
      const producerId = payload.data?.producerId;
      const info = consumerByProducerId.get(producerId);
      if (info) {
        const tile = peerTiles.get(info.peerId);
        if (tile) {
          removeTrackByKind(tile.stream, info.kind);
        }
        try {
          info.consumer.close();
        } catch {}
        consumerByProducerId.delete(producerId);
      }
      return;
    }

    if (payload.event === "transcription") {
      const text = String(payload.data?.text || "").trim();
      if (!text) return;
      const language = String(payload.data?.language || "").toUpperCase() || "N/A";
      const isFinal = Boolean(payload.data?.isFinal);

      if (isFinal) {
        const beforeCount = transcriptFinalItems.length;
        pushTranscriptLine(payload.data || {});
        const line = transcriptFinalItems[transcriptFinalItems.length - 1];
        log("Transcript " + line);
        transcriptInterimItem = "";
        if (transcriptFinalItems.length === beforeCount) {
          return;
        }
      } else {
        const sourceName = resolveTranscriptSourceName(payload.data || {});
        const speakerKey = `${language}|${sourceName}`;
        transcriptInterimItem = lastTranscriptSpeakerKey === speakerKey ? text : `[${language}] ${sourceName}: ${text}`;
        setStatus("Live transcript (" + language + ")");
      }
      renderTranscriptBox();
      return;
    }

    if (payload.event === "chat-message") {
      const text = String(payload.data?.text || "").trim();
      if (!text) return;
      const senderPeerId = String(payload.data?.peerId || "").trim();
      const senderName = String(payload.data?.name || "").trim();
      const label = senderPeerId && senderPeerId === peerId ? "you" : (senderName || senderPeerId || "participant");
      appendChatLine(label, text, { self: senderPeerId === peerId });
      return;
    }

    if (payload.event === "recording-state") {
      const enabled = Boolean(payload.data?.enabled);
      const ownerPeer = payload.data?.ownerPeerId ?? null;
      const mode = normalizeRecordingMode(payload.data?.mode || "av");
      const nextTranscriptionLanguage = normalizeTranscriptionLanguage(payload.data?.transcriptionLanguage || "");
      const prevEnabled = recordingEnabled;
      const prevOwner = recordingOwnerPeerId;

      recordingEnabled = enabled;
      recordingOwnerPeerId = ownerPeer;
      recordingMode = mode;
      if (nextTranscriptionLanguage) {
        transcriptionLanguage = nextTranscriptionLanguage;
        syncTranscriptionJoinControls();
        renderTranscriptBox();
      }

      if (rec && recordingOwnerPeerId !== peerId) {
        rec.stop();
      }

      if (!rec && recordingEnabled && recordingOwnerPeerId === peerId && localStream) {
        try {
          await beginLocalRecorder(recordingMode);
        } catch (error) {
          log(`Auto recorder takeover failed: ${String(error)}`);
        }
      }

      if (prevEnabled !== enabled || prevOwner !== ownerPeer) {
        log(`Recording state: ${enabled ? `${mode} on (${ownerPeer || "unknown"})` : "off"}`);
      }

      postHostEvent("recording-state", {
        enabled,
        ownerPeerId: ownerPeer,
        mode,
        transcriptionLanguage: transcriptionLanguage || ""
      });
      refreshRecordingButtons();
    }
  };

  ws.onclose = async () => {
    setStatus("Disconnected");
    log("Socket closed");
    resetRtcState();
    setConnectedView(false);
    clearTranscriptBox();
    refreshAllControls();
    postHostEvent("connected", { connected: false });
    await refreshPreview();
  };
}

async function leaveRoom() {
  try {
    if (rec) await stopRecording();
  } catch {}

  try {
    if (isSocketOpen()) {
      await sendRequest("leave", {});
      ws.close();
    }
  } catch {}

  [audioProducer, videoProducer].forEach((p) => {
    if (!p) return;
    try {
      p.close();
    } catch {}
  });

  audioProducer = null;
  videoProducer = null;

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  if (sendTransport) {
    try {
      sendTransport.close();
    } catch {}
    sendTransport = null;
  }

  if (recvTransport) {
    try {
      recvTransport.close();
    } catch {}
    recvTransport = null;
  }

  clearRemoteState();

  ws = null;
  peerId = null;
  roomId = null;
  device = null;
  rec = null;
  micEnabled = true;
  camEnabled = true;
  recordingEnabled = false;
  recordingOwnerPeerId = null;
  recordingMode = "av";
  lastActiveSpeakerEmitAt = 0;
  lastActiveSpeakerPeerKey = "";

  updateRoomBadge("");
  setConnectedView(false);
  setStatus("Disconnected");
  clearTranscriptBox();
  refreshAllControls();
  postHostEvent("left", { connected: false });
  await refreshPreview();
}

async function init() {
  if (EMBED_MODE) {
    document.body.classList.add("embed-mode");
    if (HIDE_DOCK) document.body.classList.add("hide-dock");
  }

  initializeJoinFields();

  try {
    await navigator.mediaDevices.getUserMedia({ audio: selectedAudioConstraint(), video: true });
  } catch {}

  try {
    await updateDeviceLists();
    await refreshPreview();
  } catch {}

  if (!speakerPollIntervalId) {
    speakerPollIntervalId = setInterval(() => {
      pollActiveSpeaker();
    }, 450);
  }

  renderParticipants();
  refreshAllControls();
  applyRecordingButtonsVisibility();
  renderTranscriptBox();
  setConnectedView(false);
  postHostEvent("ready", { embed: EMBED_MODE });

  window.addEventListener("message", (event) => {
    handleHostCommand(event.data).catch((error) => {
      postHostEvent("command-error", { message: String(error) });
    });
  });

  const autojoin = String(PAGE_URL.searchParams.get("autojoin") || "").toLowerCase();
  const autojoinEnabled = autojoin === "1" || autojoin === "true" || autojoin === "yes";
  const embedJoinEligible = EMBED_MODE && Boolean(readRoomFromPath()) && Boolean(nameEl.value.trim());
  if (autojoinEnabled || embedJoinEligible) {
    if (!nameEl.value.trim()) {
      setStatus("Enter your name before joining");
      log("Autojoin skipped: missing display name");
      postHostEvent("join-required", { reason: "missing-name" });
      nameEl.focus();
    } else {
      joinRoom().catch((e) => log(String(e)));
    }
  }
}

generateRoomBtn.addEventListener("click", () => {
  const room = generateRoomName();
  roomEl.value = room;
  updateMeetingUrl(room, nameEl.value || "");
  updateRoomBadge(room);
  log(`Generated room: ${room}`);
});

roomEl.addEventListener("change", () => {
  const safeRoom = sanitizeRoomId(roomEl.value);
  if (safeRoom) {
    roomEl.value = safeRoom;
    updateMeetingUrl(safeRoom, nameEl.value || "");
    updateRoomBadge(safeRoom);
  }
});

nameEl.addEventListener("change", () => {
  const safeRoom = sanitizeRoomId(roomEl.value);
  if (safeRoom) {
    updateMeetingUrl(safeRoom, nameEl.value || "");
  }
});
transcriptionEnabledEl?.addEventListener("change", () => {
  if (transcriptionLanguageInputEl) transcriptionLanguageInputEl.disabled = !transcriptionEnabledEl.checked;
  transcriptionLanguage = getJoinTranscriptionLanguagePreference();
  const safeRoom = sanitizeRoomId(roomEl.value);
  if (safeRoom) updateMeetingUrl(safeRoom, nameEl.value || "");
  renderTranscriptBox();
});
transcriptionLanguageInputEl?.addEventListener("change", () => {
  transcriptionLanguage = getJoinTranscriptionLanguagePreference();
  const safeRoom = sanitizeRoomId(roomEl.value);
  if (safeRoom) updateMeetingUrl(safeRoom, nameEl.value || "");
  renderTranscriptBox();
});

joinBtn.addEventListener("click", () => joinRoom().catch((e) => log(String(e))));
leaveBtn.addEventListener("click", () => leaveRoom().catch((e) => log(String(e))));
recAudioToggleBtn.addEventListener("click", () => {
  if (rec && recordingOwnerPeerId === peerId && normalizeRecordingMode(recordingMode) === "audio") {
    stopRecording();
  } else {
    startRecording("audio");
  }
});
recVideoToggleBtn.addEventListener("click", () => {
  if (rec && recordingOwnerPeerId === peerId && normalizeRecordingMode(recordingMode) === "av") {
    stopRecording();
  } else {
    startRecording("av");
  }
});
micToggleBtn.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("#micDeviceBtn")) return;
  toggleMic();
});
camToggleBtn.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("#camDeviceBtn")) return;
  toggleCam();
});
audioDeviceEl.addEventListener("change", () => {
  dockAudioDeviceEl.value = audioDeviceEl.value;
  switchAudioDevice();
});
videoDeviceEl.addEventListener("change", () => {
  dockVideoDeviceEl.value = videoDeviceEl.value;
  switchVideoDevice();
});
dockAudioDeviceEl.addEventListener("change", () => {
  audioDeviceEl.value = dockAudioDeviceEl.value;
  switchAudioDevice();
  closeDevicePopovers();
});
dockVideoDeviceEl.addEventListener("change", () => {
  videoDeviceEl.value = dockVideoDeviceEl.value;
  switchVideoDevice();
  closeDevicePopovers();
});
viewToggleBtn.addEventListener("click", () => cycleViewMode());
transcriptToggleBtn?.addEventListener("click", () => {
  setTranscriptPanelVisible(!transcriptPanelVisible);
});
chatToggleBtn?.addEventListener("click", () => {
  setChatPanelVisible(!chatPanelVisible);
});

chatSendBtn?.addEventListener("click", async () => {
  const text = String(chatInputEl?.value || "").trim();
  if (!text || !isSocketOpen()) return;
  try {
    await sendRequest("chat", { text });
    if (chatInputEl) chatInputEl.value = "";
  } catch (error) {
    log("Chat send failed: " + String(error));
  }
});

chatInputEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const text = String(chatInputEl.value || "").trim();
  if (!text || !isSocketOpen()) return;
  try {
    await sendRequest("chat", { text });
    chatInputEl.value = "";
  } catch (error) {
    log("Chat send failed: " + String(error));
  }
});

dockMicBtn.addEventListener("click", () => toggleMic());
dockCamBtn.addEventListener("click", () => toggleCam());
dockRecAudioBtn.addEventListener("click", () => {
  if (rec && recordingOwnerPeerId === peerId && normalizeRecordingMode(recordingMode) === "audio") {
    stopRecording();
  } else {
    startRecording("audio");
  }
});
dockRecVideoBtn.addEventListener("click", () => {
  if (rec && recordingOwnerPeerId === peerId && normalizeRecordingMode(recordingMode) === "av") {
    stopRecording();
  } else {
    startRecording("av");
  }
});
dockLeaveBtn.addEventListener("click", () => leaveRoom());
inviteBtn?.addEventListener("click", async () => {
  const url = buildInviteUrl();
  if (!url) {
    setStatus("Invite link unavailable");
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      throw new Error("clipboard API unavailable");
    }
    setStatus("Invite link copied");
    inviteBtn.textContent = "Copied";
    setTimeout(() => {
      if (inviteBtn && isSocketOpen()) inviteBtn.textContent = "Invite";
    }, 1500);
    log(`Invite link copied: ${url}`);
  } catch {
    try {
      const tmp = document.createElement("input");
      tmp.value = url;
      tmp.style.position = "fixed";
      tmp.style.opacity = "0";
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
      setStatus("Invite link copied");
      inviteBtn.textContent = "Copied";
      setTimeout(() => {
        if (inviteBtn && isSocketOpen()) inviteBtn.textContent = "Invite";
      }, 1500);
      log(`Invite link copied: ${url}`);
    } catch {
      setStatus("Copy failed");
      log(`Invite link (copy manually): ${url}`);
    }
  }
});
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest("#micDeviceBtn")) {
    event.stopPropagation();
    toggleDevicePopover("mic");
    return;
  }
  if (target.closest("#camDeviceBtn")) {
    event.stopPropagation();
    toggleDevicePopover("cam");
    return;
  }

  const inMic = micDevicePopover?.contains(target) || Boolean(target.closest("#micDeviceBtn"));
  const inCam = camDevicePopover?.contains(target) || Boolean(target.closest("#camDeviceBtn"));
  if (!inMic && !inCam) closeDevicePopovers();
});
if (dockEl) {
  dockEl.addEventListener("mouseenter", () => {
    showOverlays();
    clearOverlayHideTimer();
  });
  dockEl.addEventListener("mouseleave", () => {
    scheduleOverlayHide();
  });
}
if (headerEl) {
  headerEl.addEventListener("mouseenter", () => {
    showOverlays();
    clearOverlayHideTimer();
  });
  headerEl.addEventListener("mouseleave", () => {
    scheduleOverlayHide();
  });
}
document.addEventListener("mousemove", (event) => {
  if (!overlayAutoHideEnabled) return;
  if (!document.body.classList.contains("in-call")) return;
  if (!isSocketOpen()) return;
  const revealTopZoneBottom = 120;
  const revealZoneTop = window.innerHeight - 150;
  if (event.clientY >= revealZoneTop || event.clientY <= revealTopZoneBottom) {
    showOverlays();
    scheduleOverlayHide();
  }
});
document.addEventListener("keydown", () => {
  if (!overlayAutoHideEnabled) return;
  if (!document.body.classList.contains("in-call")) return;
  showOverlays();
  scheduleOverlayHide();
});

autoRecordVideoEl.addEventListener("change", () => {
  if (autoRecordVideoEl.checked) autoRecordAudioEl.checked = false;
});
autoRecordAudioEl.addEventListener("change", () => {
  if (autoRecordAudioEl.checked) autoRecordVideoEl.checked = false;
});
init().catch(() => null);
