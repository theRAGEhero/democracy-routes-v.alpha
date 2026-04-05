import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import mediasoup from "mediasoup";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3020);
const HOST = process.env.HOST || "0.0.0.0";
const ANNOUNCED_IP = process.env.ANNOUNCED_IP || undefined;
const RTC_MIN_PORT = Number(process.env.RTC_MIN_PORT || 41000);
const RTC_MAX_PORT = Number(process.env.RTC_MAX_PORT || 41100);
const FORCE_TCP = String(process.env.FORCE_TCP || "false") === "true";
const RECORDINGS_DIR = path.resolve(__dirname, process.env.RECORDINGS_DIR || "./recordings");
const AUTO_RECORD_ON_JOIN = String(process.env.AUTO_RECORD_ON_JOIN || "true") === "true";

const DEEPGRAM_API_KEY = String(process.env.DEEPGRAM_API_KEY || "").trim();
const DEEPGRAM_MODEL = String(process.env.DEEPGRAM_MODEL || "nova-3").trim();
const DEEPGRAM_INTERIM_RESULTS = String(process.env.DEEPGRAM_INTERIM_RESULTS || "true") === "true";
const DEEPGRAM_PUNCTUATE = String(process.env.DEEPGRAM_PUNCTUATE || "true") === "true";
const DEEPGRAM_SMART_FORMAT = String(process.env.DEEPGRAM_SMART_FORMAT || "true") === "true";
const DEEPGRAM_DIARIZE = String(process.env.DEEPGRAM_DIARIZE || "true") === "true";
const DEEPGRAM_UTTERANCES = String(process.env.DEEPGRAM_UTTERANCES || "true") === "true";
const DEEPGRAM_KEEPALIVE_MS = Number(process.env.DEEPGRAM_KEEPALIVE_MS || 5000);

const LOG_DIR = path.resolve(__dirname, process.env.LOG_DIR || "./logs");
const LOG_FILE = process.env.LOG_FILE || "dr-video.log";
const LOG_PATH = path.join(LOG_DIR, LOG_FILE);
const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const LOG_MAX_BYTES = Number(process.env.LOG_MAX_BYTES || 10 * 1024 * 1024);
const LOG_MAX_FILES = Number(process.env.LOG_MAX_FILES || 5);
const REC_TRANS_TRACE = String(process.env.REC_TRANS_TRACE || "true") === "true";
const EVENT_HUB_BASE_URL = String(process.env.EVENT_HUB_BASE_URL || "").trim();
const EVENT_HUB_API_KEY = String(process.env.EVENT_HUB_API_KEY || "").trim();
const EVENT_HUB_MIN_LEVEL = String(process.env.EVENT_HUB_MIN_LEVEL || "info").toLowerCase();
const TRANSCRIPTION_HUB_URL = String(process.env.TRANSCRIPTION_HUB_URL || "").trim();
const TRANSCRIPTION_HUB_API_KEY = String(process.env.TRANSCRIPTION_HUB_API_KEY || "").trim();
const HUB_PENDING_DIR = path.resolve(RECORDINGS_DIR, "_hub_pending");
const HUB_RETRY_SCAN_MS = Number(process.env.HUB_RETRY_SCAN_MS || 15000);
const ACCESS_SECRET = String(process.env.DR_VIDEO_ACCESS_SECRET || "").trim();
const REQUIRE_ACCESS = String(process.env.DR_VIDEO_REQUIRE_ACCESS || "true") === "true";
const ADMIN_API_KEY = String(process.env.DR_VIDEO_ADMIN_API_KEY || ACCESS_SECRET || "").trim();

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(HUB_PENDING_DIR, { recursive: true });

const levelRank = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50
};

function shouldSendEvent(level) {
  const minRank = levelRank[EVENT_HUB_MIN_LEVEL] ?? levelRank.info;
  const rank = levelRank[level] ?? 999;
  return rank >= minRank;
}

async function postEventHub(message, level, meta = {}) {
  if (!EVENT_HUB_BASE_URL || !EVENT_HUB_API_KEY) return;
  if (!shouldSendEvent(level)) return;
  try {
    await fetch(`${EVENT_HUB_BASE_URL.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EVENT_HUB_API_KEY
      },
      body: JSON.stringify({
        source: "dr-video",
        type: message,
        severity: level,
        message,
        payload: meta
      })
    });
  } catch {
    // best-effort only
  }
}

function createId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAccessToken(token, expectedRoomId, expectedMeetingId) {
  if (!REQUIRE_ACCESS) return true;
  if (!ACCESS_SECRET) return false;
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) return false;
  const [encoded, signature] = raw.split(".", 2);
  if (!encoded || !signature) return false;
  const expectedSig = crypto.createHmac("sha256", ACCESS_SECRET).update(encoded).digest("base64url");
  if (!timingSafeEqual(signature, expectedSig)) return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const exp = Number(payload?.exp || 0);
  if (!exp || Date.now() / 1000 > exp) return false;
  const normalizeRoomId = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
  const roomId = normalizeRoomId(payload?.roomId);
  const expectedRoom = normalizeRoomId(expectedRoomId);
  if (!roomId || !expectedRoom || roomId !== expectedRoom) return false;
  if (expectedMeetingId) {
    const meetingId = String(payload?.meetingId || "").trim();
    if (meetingId && meetingId !== String(expectedMeetingId || "").trim()) return false;
  }
  return true;
}

function requireAccessToken(req, roomId) {
  const meetingId = String(req.query?.meetingId || "").trim() || null;
  const token = String(req.query?.access || req.headers["x-access-token"] || "").trim();
  return verifyAccessToken(token, roomId, meetingId);
}

function requireAdminApiKey(req) {
  if (!ADMIN_API_KEY) return false;
  const headerValue = String(req.headers["x-api-key"] || "").trim();
  if (headerValue && timingSafeEqual(headerValue, ADMIN_API_KEY)) return true;
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token && timingSafeEqual(token, ADMIN_API_KEY)) return true;
  }
  return false;
}

function rotateLogsIfNeeded() {
  try {
    if (!fs.existsSync(LOG_PATH)) return;
    const stat = fs.statSync(LOG_PATH);
    if (stat.size < LOG_MAX_BYTES) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = path.join(LOG_DIR, `${LOG_FILE}.${stamp}`);
    fs.renameSync(LOG_PATH, rotatedPath);

    const files = fs
      .readdirSync(LOG_DIR)
      .filter((name) => name.startsWith(`${LOG_FILE}.`))
      .map((name) => ({ name, mtime: fs.statSync(path.join(LOG_DIR, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    files.slice(LOG_MAX_FILES).forEach((entry) => {
      fs.unlinkSync(path.join(LOG_DIR, entry.name));
    });
  } catch (error) {
    console.error("log rotation failed", error);
  }
}

function writeLog(level, message, meta = {}) {
  const minRank = levelRank[LOG_LEVEL] ?? levelRank.info;
  if ((levelRank[level] ?? 999) < minRank) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  const line = `${JSON.stringify(entry)}\n`;

  if (levelRank[level] >= levelRank.error) {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }

  try {
    rotateLogsIfNeeded();
    fs.appendFileSync(LOG_PATH, line);
  } catch (error) {
    console.error("failed to write log", error);
  }

  void postEventHub(message, level, meta);
}

const logger = {
  debug: (message, meta) => writeLog("debug", message, meta),
  info: (message, meta) => writeLog("info", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  error: (message, meta) => writeLog("error", message, meta),
  fatal: (message, meta) => writeLog("fatal", message, meta)
};

function traceRecTrans(event, meta = {}) {
  if (!REC_TRANS_TRACE) return;
  logger.info("rec_trans_trace", { event, ...meta });
}

const hubMetrics = {
  totalAttempts: 0,
  successCount: 0,
  failedCount: 0,
  queuedCount: 0,
  drainedCount: 0,
  droppedCount: 0,
  lastError: "",
  lastAttemptAt: null,
  lastSuccessAt: null
};

function sanitizePendingFileName(value) {
  return String(value || "pending")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function getPendingFiles() {
  if (!fs.existsSync(HUB_PENDING_DIR)) return [];
  return fs
    .readdirSync(HUB_PENDING_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function queueHubPayload(payload, reason = "") {
  try {
    const eventId = sanitizePendingFileName(payload?.eventId || createId("hub"));
    const filename = Date.now() + "_" + eventId + ".json";
    const fullPath = path.join(HUB_PENDING_DIR, filename);
    const wrapped = {
      queuedAt: new Date().toISOString(),
      reason,
      attempts: 0,
      payload
    };
    fs.writeFileSync(fullPath, JSON.stringify(wrapped, null, 2));
    hubMetrics.queuedCount += 1;
    logger.warn("transcription_hub_payload_queued", {
      fullPath,
      roomId: payload?.roomId || null,
      sessionId: payload?.sessionId || null,
      reason
    });
  } catch (error) {
    hubMetrics.droppedCount += 1;
    logger.error("transcription_hub_payload_queue_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function postTranscriptionFinalizeToHub(payload) {
  if (!TRANSCRIPTION_HUB_URL) {
    return { ok: false, status: 0, error: "hub_url_not_configured" };
  }

  const endpoint = TRANSCRIPTION_HUB_URL.replace(/\/$/, "") + "/api/ingest/finalize";
  const headers = { "content-type": "application/json" };
  if (TRANSCRIPTION_HUB_API_KEY) headers["x-api-key"] = TRANSCRIPTION_HUB_API_KEY;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    hubMetrics.totalAttempts += 1;
    hubMetrics.lastAttemptAt = new Date().toISOString();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        hubMetrics.successCount += 1;
        hubMetrics.lastSuccessAt = new Date().toISOString();
        logger.info("transcription_hub_ingest_ok", {
          endpoint,
          attempt,
          roomId: payload?.roomId || null,
          sessionId: payload?.sessionId || null
        });
        return { ok: true, status: response.status, error: "" };
      }

      const text = await response.text().catch(() => "");
      hubMetrics.failedCount += 1;
      hubMetrics.lastError = "HTTP " + response.status + " " + String(text || "").slice(0, 240);
      logger.warn("transcription_hub_ingest_failed", {
        endpoint,
        attempt,
        status: response.status,
        body: String(text || "").slice(0, 500)
      });
    } catch (error) {
      hubMetrics.failedCount += 1;
      hubMetrics.lastError = error instanceof Error ? error.message : String(error);
      logger.warn("transcription_hub_ingest_error", {
        endpoint,
        attempt,
        error: hubMetrics.lastError
      });
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }

  return { ok: false, status: 0, error: hubMetrics.lastError || "ingest_failed" };
}

async function sendTranscriptionFinalizeToHub(payload, queueOnFail = true) {
  const result = await postTranscriptionFinalizeToHub(payload);
  if (!result.ok && queueOnFail) {
    queueHubPayload(payload, result.error || "hub_ingest_failed");
  }
  return result.ok;
}

let hubQueueBusy = false;
async function processPendingHubQueue() {
  if (hubQueueBusy) return;
  hubQueueBusy = true;
  try {
    const files = getPendingFiles();
    for (const filename of files) {
      const fullPath = path.join(HUB_PENDING_DIR, filename);
      let wrapped = null;
      try {
        wrapped = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      } catch (error) {
        hubMetrics.droppedCount += 1;
        try { fs.unlinkSync(fullPath); } catch {}
        logger.warn("transcription_hub_queue_bad_file", {
          fullPath,
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }

      const payload = wrapped?.payload || null;
      if (!payload) {
        hubMetrics.droppedCount += 1;
        try { fs.unlinkSync(fullPath); } catch {}
        continue;
      }

      const ok = await sendTranscriptionFinalizeToHub(payload, false);
      if (ok) {
        hubMetrics.drainedCount += 1;
        try { fs.unlinkSync(fullPath); } catch {}
      } else {
        wrapped.attempts = Number(wrapped?.attempts || 0) + 1;
        wrapped.lastRetryAt = new Date().toISOString();
        wrapped.lastError = hubMetrics.lastError || "retry_failed";
        try {
          fs.writeFileSync(fullPath, JSON.stringify(wrapped, null, 2));
        } catch {}
      }
    }
  } finally {
    hubQueueBusy = false;
  }
}

setInterval(() => {
  void processPendingHubQueue();
}, HUB_RETRY_SCAN_MS);
setTimeout(() => {
  void processPendingHubQueue();
}, 4000);

const app = express();

app.use((req, res, next) => {
  if (
    req.path === "/" ||
    req.path === "/app.js" ||
    req.path.startsWith("/meet/")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.use((req, res, next) => {
  const requestId = createId("req");
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null
    });
  });

  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/meet/:roomId", (req, res) => {
  if (REQUIRE_ACCESS && !requireAccessToken(req, req.params.roomId)) {
    return res.status(403).send("Access denied");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/api/join-url", (req, res) => {
  if (REQUIRE_ACCESS && !requireAccessToken(req, String(req.query.roomId || req.query.room || ""))) {
    return json(res, 403, { error: "Access denied" });
  }
  const roomId = String(req.query.roomId || req.query.room || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  const name = String(req.query.name || req.query.user || "").trim();
  const autojoin = String(req.query.autojoin || "1").toLowerCase();

  if (!roomId) {
    return json(res, 400, { error: "roomId is required" });
  }

  const host = req.headers.host || `localhost:${PORT}`;
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
  const url = new URL(`/meet/${encodeURIComponent(roomId)}`, `${proto}://${host}`);

  if (name) url.searchParams.set("name", name);
  if (autojoin === "1" || autojoin === "true" || autojoin === "yes") {
    url.searchParams.set("autojoin", "1");
  }

  return json(res, 200, {
    roomId,
    name: name || null,
    joinUrl: url.toString(),
    embedUrl: url.toString()
  });
});
app.post("/api/client-events", express.json({ limit: "256kb" }), (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const access = String(req.body?.access || "").trim();
  const clientSessionId = String(req.body?.clientSessionId || "").trim() || null;

  if (!events.length) {
    return json(res, 200, { ok: true, accepted: 0 });
  }

  let accepted = 0;
  for (const entry of events.slice(0, 200)) {
    const roomId = String(entry?.roomId || "").trim();
    const meetingId = String(entry?.meetingId || "").trim() || null;
    if (REQUIRE_ACCESS && roomId && !verifyAccessToken(access, roomId, meetingId)) {
      continue;
    }

    accepted += 1;
    const level = String(entry?.level || "info").toLowerCase();
    const write = logger[level] || logger.info;
    write("client_media_trace", {
      event: String(entry?.event || "client_event"),
      roomId: roomId || null,
      meetingId,
      peerId: String(entry?.peerId || "").trim() || null,
      name: String(entry?.name || "").trim() || null,
      clientSessionId,
      clientTs: String(entry?.ts || "").trim() || null,
      details: entry?.details && typeof entry.details === "object" ? entry.details : null
    });
  }

  return json(res, 200, { ok: true, accepted });
});
app.use(express.raw({ type: "application/octet-stream", limit: "25mb" }));

const rooms = new Map();
const peers = new Map();
const recordingIngest = new Map();
const recordingRuns = new Map();
const transcriptionSessions = new Map();
const chatSessions = new Map();
let worker;

function normalizeRecordingMode(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "audio" || v === "a") return "audio";
  return "av";
}

function json(res, status, payload) {
  res.status(status);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function createWorker() {
  const w = await mediasoup.createWorker({
    rtcMinPort: RTC_MIN_PORT,
    rtcMaxPort: RTC_MAX_PORT,
    logLevel: "warn"
  });

  w.on("died", () => {
    logger.fatal("mediasoup_worker_died", { action: "process_exit", delayMs: 2000 });
    setTimeout(() => process.exit(1), 2000);
  });

  return w;
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (room) return room;

  const mediaCodecs = [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
      parameters: {
        useinbandfec: 1,
        usedtx: 1,
        "sprop-stereo": 0,
        maxaveragebitrate: 64000
      }
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {
        "x-google-start-bitrate": 1000
      }
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1
      }
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "4d0032",
        "level-asymmetry-allowed": 1
      }
    }
  ];

  const router = await worker.createRouter({ mediaCodecs });

  room = {
    id: roomId,
    meetingId: null,
    router,
    peers: new Set(),
    recordingState: {
      enabled: false,
      ownerPeerId: null,
      mode: "av",
      transcriptionLanguage: "",
      sessions: new Set(),
      activeRunId: null,
      runStartedAt: null
    }
  };

  rooms.set(roomId, room);
  logger.info("room_created", { roomId });
  return room;
}

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: ANNOUNCED_IP }],
    enableUdp: !FORCE_TCP,
    enableTcp: true,
    preferUdp: !FORCE_TCP
  });

  return transport;
}

function broadcastToRoom(roomId, event, data, exceptPeerId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const peerId of room.peers) {
    if (exceptPeerId && peerId === exceptPeerId) continue;
    const peer = peers.get(peerId);
    if (!peer || peer.ws.readyState !== 1) continue;
    try {
      peer.ws.send(JSON.stringify({ event, data }));
    } catch (error) {
      logger.warn("ws_broadcast_failed", {
        roomId,
        peerId,
        event,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function pickRecordingOwner(room, excludedPeerId = null) {
  for (const candidateId of room.peers) {
    if (candidateId === excludedPeerId) continue;
    const candidate = peers.get(candidateId);
    if (!candidate) continue;
    if (candidate.ws.readyState !== 1) continue;
    return candidateId;
  }
  return null;
}

function getRoomSummary(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return {
      roomId,
      exists: false,
      participantCount: 0,
      participants: [],
      recordingEnabled: false,
      recordingOwnerPeerId: null,
      transcriptionActive: false,
      canClose: false
    };
  }

  const participants = Array.from(room.peers)
    .map((peerId) => peers.get(peerId))
    .filter(Boolean)
    .map((peer) => ({
      peerId: peer.id,
      name: peer.name,
      connected: peer.ws?.readyState === 1
    }));

  return {
    roomId: room.id,
    exists: true,
    participantCount: participants.filter((peer) => peer.connected).length,
    participants,
    recordingEnabled: Boolean(room.recordingState.enabled),
    recordingOwnerPeerId: room.recordingState.ownerPeerId || null,
    transcriptionActive: transcriptionSessions.has(room.id),
    canClose: participants.filter((peer) => peer.connected).length === 0
  };
}

function closeRoomById(roomId, reason = "room_closed") {
  const room = rooms.get(roomId);
  if (!room) return false;

  if (room.recordingState.enabled) {
    room.recordingState.enabled = false;
    room.recordingState.ownerPeerId = null;
    room.recordingState.mode = "av";
    room.recordingState.transcriptionLanguage = "";
    endRecordingRun(roomId, reason);
  }

  stopTranscriptionSession(roomId, reason);
  chatSessions.delete(roomId);

  try {
    room.router.close();
  } catch {}

  rooms.delete(roomId);
  logger.info("room_closed", { roomId, reason });
  return true;
}

function recordingRunKey(roomId, runId) {
  return `${roomId}:${runId}`;
}

function startRecordingRun(room, mode = "av") {
  if (!room) return null;
  if (room.recordingState.activeRunId) {
    const existing = recordingRuns.get(recordingRunKey(room.id, room.recordingState.activeRunId));
    if (existing) return existing;
  }

  const runId = createId("rec");
  const run = {
    roomId: room.id,
    runId,
    mode: normalizeRecordingMode(mode),
    startedAt: new Date().toISOString(),
    endedAt: null,
    sessions: new Set(),
    mergeScheduled: false,
    mergeCompletedAt: null
  };
  room.recordingState.activeRunId = runId;
  room.recordingState.runStartedAt = run.startedAt;
  recordingRuns.set(recordingRunKey(room.id, runId), run);
  logger.info("recording_run_started", { roomId: room.id, runId, mode: run.mode });
  traceRecTrans("recording_run_started", {
    roomId: room.id,
    runId,
    mode: run.mode,
    ownerPeerId: room.recordingState.ownerPeerId || null
  });
  return run;
}

function getActiveRecordingRun(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const runId = room.recordingState.activeRunId;
  if (!runId) return null;
  return recordingRuns.get(recordingRunKey(roomId, runId)) || null;
}

function attachSessionToActiveRun(roomId, sessionId) {
  const room = rooms.get(roomId);
  if (!room || !room.recordingState.enabled) return null;
  let run = getActiveRecordingRun(roomId);
  if (!run) {
    run = startRecordingRun(room, room.recordingState.mode || "av");
  }
  if (!run) return null;
  run.sessions.add(sessionId);
  recordingRuns.set(recordingRunKey(roomId, run.runId), run);
  traceRecTrans("recording_session_attached_to_run", {
    roomId,
    runId: run.runId,
    sessionId,
    sessionsCount: run.sessions.size
  });
  return run.runId;
}

function getSessionStartMs(roomId, sessionId) {
  const ingest = recordingIngest.get(`${roomId}:${sessionId}`);
  const ingestStart = Date.parse(String(ingest?.startedAt || ""));
  if (Number.isFinite(ingestStart)) return ingestStart;

  const metaPath = path.join(RECORDINGS_DIR, roomId, `${sessionId}.jsonl`);
  if (fs.existsSync(metaPath)) {
    try {
      const content = fs.readFileSync(metaPath, "utf8");
      const firstLine = content.split("\n").find((line) => line.trim());
      if (firstLine) {
        const parsed = JSON.parse(firstLine);
        const ts = Date.parse(String(parsed?.ts || ""));
        if (Number.isFinite(ts)) return ts;
      }
    } catch {}
  }

  const mediaPath = path.join(RECORDINGS_DIR, roomId, `${sessionId}.webm`);
  if (fs.existsSync(mediaPath)) {
    try {
      return fs.statSync(mediaPath).mtimeMs;
    } catch {}
  }
  return Number.MAX_SAFE_INTEGER;
}

function finalizeSessionPartsIfPresent(roomId, sessionId) {
  const roomDir = path.join(RECORDINGS_DIR, roomId);
  const mediaPath = path.join(roomDir, `${sessionId}.webm`);
  const partsDir = path.join(roomDir, `${sessionId}.parts`);
  if (!fs.existsSync(partsDir)) return fs.existsSync(mediaPath);

  const partFiles = fs
    .readdirSync(partsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".part"))
    .map((e) => e.name)
    .sort();

  if (!partFiles.length) {
    try {
      fs.rmdirSync(partsDir);
    } catch {}
    return fs.existsSync(mediaPath);
  }

  const tmpPath = `${mediaPath}.tmp`;
  const fd = fs.openSync(tmpPath, "w");
  try {
    for (const filename of partFiles) {
      const chunkPath = path.join(partsDir, filename);
      const chunk = fs.readFileSync(chunkPath);
      fs.writeSync(fd, chunk);
    }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, mediaPath);

  for (const filename of partFiles) {
    try {
      fs.unlinkSync(path.join(partsDir, filename));
    } catch {}
  }
  try {
    fs.rmdirSync(partsDir);
  } catch {}

  return fs.existsSync(mediaPath);
}

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function recordTranscriptionActiveSpeaker(roomId, senderPeerId, activePeerIdRaw, tsRaw) {
  const session = transcriptionSessions.get(roomId);
  if (!session) return;
  if (session.ownerPeerId !== senderPeerId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const activePeerId = String(activePeerIdRaw || "").trim();
  if (!activePeerId) return;
  if (!room.peers.has(activePeerId)) return;

  const now = Date.now();
  let tsMs = clampNumber(tsRaw, now);
  if (tsMs > now + 5000 || tsMs < now - 5 * 60 * 1000) tsMs = now;

  session.activeSpeakerEvents.push({ peerId: activePeerId, tsMs });

  const minTs = now - 15 * 60 * 1000;
  if (session.activeSpeakerEvents.length > 5000) {
    session.activeSpeakerEvents = session.activeSpeakerEvents.slice(session.activeSpeakerEvents.length - 5000);
  }
  while (session.activeSpeakerEvents.length > 0 && session.activeSpeakerEvents[0].tsMs < minTs) {
    session.activeSpeakerEvents.shift();
  }

  traceRecTrans("transcription_active_speaker", {
    roomId,
    senderPeerId,
    activePeerId,
    tsMs,
    bufferSize: session.activeSpeakerEvents.length
  });
}

function trimPeerSpeechWindows(session, now = Date.now()) {
  if (!session) return;
  const minTs = now - 15 * 60 * 1000;
  const windowsByPeer = session.peerSpeechWindows || {};
  for (const [peerId, windows] of Object.entries(windowsByPeer)) {
    if (!Array.isArray(windows)) {
      delete windowsByPeer[peerId];
      continue;
    }
    const kept = windows.filter((window) => Number(window?.endMs || 0) >= minTs);
    if (kept.length > 0) {
      windowsByPeer[peerId] = kept;
    } else {
      delete windowsByPeer[peerId];
    }
  }
  const openByPeer = session.peerSpeechOpen || {};
  for (const [peerId, entry] of Object.entries(openByPeer)) {
    const startMs = Number(entry?.startMs || 0);
    const lastTsMs = Number(entry?.lastTsMs || 0);
    if ((startMs && startMs < minTs) || (lastTsMs && lastTsMs < minTs)) {
      delete openByPeer[peerId];
    }
  }
}

function closePeerSpeechWindow(session, peerId, endMsRaw) {
  if (!session || !peerId) return;
  const openByPeer = session.peerSpeechOpen || {};
  const current = openByPeer[peerId];
  if (!current) return;

  const endMs = Math.max(Number(endMsRaw || 0), Number(current.lastTsMs || current.startMs || endMsRaw || 0));
  const startMs = Number(current.startMs || 0);
  if (startMs > 0 && endMs >= startMs) {
    session.peerSpeechWindows[peerId] ||= [];
    session.peerSpeechWindows[peerId].push({
      startMs,
      endMs
    });
  }
  delete openByPeer[peerId];
}

function recordTranscriptionVoiceActivity(roomId, senderPeerId, payload) {
  const session = transcriptionSessions.get(roomId);
  if (!session) return;
  if (session.ownerPeerId !== senderPeerId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const activePeerId = String(payload?.activePeerId || "").trim();
  if (!activePeerId) return;
  if (!room.peers.has(activePeerId)) return;

  const speaking = Boolean(payload?.speaking);
  const now = Date.now();
  let tsMs = clampNumber(payload?.ts, now);
  if (tsMs > now + 5000 || tsMs < now - 5 * 60 * 1000) tsMs = now;

  session.peerSpeechWindows ||= {};
  session.peerSpeechOpen ||= {};

  const openByPeer = session.peerSpeechOpen;
  const current = openByPeer[activePeerId];

  if (speaking) {
    if (current) {
      current.lastTsMs = Math.max(Number(current.lastTsMs || current.startMs || tsMs), tsMs);
    } else {
      openByPeer[activePeerId] = {
        startMs: tsMs,
        lastTsMs: tsMs
      };
    }
  } else {
    closePeerSpeechWindow(session, activePeerId, tsMs);
  }

  trimPeerSpeechWindows(session, now);

  traceRecTrans("transcription_voice_activity", {
    roomId,
    senderPeerId,
    activePeerId,
    speaking,
    tsMs,
    openCount: Object.keys(session.peerSpeechOpen || {}).length
  });
}

function collectPeerOverlapScores(session, segStartMs, segEndMs) {
  const overlapByPeer = new Map();
  const fromMs = segStartMs - 250;
  const toMs = segEndMs + 250;
  const now = Date.now();

  const windowsByPeer = session.peerSpeechWindows || {};
  for (const [peerId, windows] of Object.entries(windowsByPeer)) {
    if (!Array.isArray(windows)) continue;
    let totalOverlap = 0;
    for (const window of windows) {
      const startMs = Number(window?.startMs || 0);
      const endMs = Number(window?.endMs || 0);
      if (!startMs || !endMs || endMs < fromMs || startMs > toMs) continue;
      totalOverlap += Math.max(0, Math.min(endMs, toMs) - Math.max(startMs, fromMs));
    }
    if (totalOverlap > 0) overlapByPeer.set(peerId, totalOverlap);
  }

  const openByPeer = session.peerSpeechOpen || {};
  for (const [peerId, open] of Object.entries(openByPeer)) {
    const startMs = Number(open?.startMs || 0);
    const endMs = Math.max(Number(open?.lastTsMs || startMs), now);
    if (!startMs || endMs < fromMs || startMs > toMs) continue;
    const overlap = Math.max(0, Math.min(endMs, toMs) - Math.max(startMs, fromMs));
    if (overlap > 0) {
      overlapByPeer.set(peerId, (overlapByPeer.get(peerId) || 0) + overlap);
    }
  }

  return overlapByPeer;
}

function mapDiarizedSpeakerToPeer(session, speakerInfo) {
  const speakerId = String(speakerInfo?.speakerId || "").trim();
  const startSec = Number(speakerInfo?.startSec);
  const endSec = Number(speakerInfo?.endSec);
  if (!speakerId || !Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return { mappedPeerId: null, mappedPeerName: null, mappingConfidence: 0, mappingMethod: "none" };
  }

  const room = rooms.get(session.roomId);
  const connectedPeers = room
    ? Array.from(room.peers.values()).filter((peer) => peer && peer.connected !== false)
    : [];
  if (connectedPeers.length === 1) {
    const onlyPeer = connectedPeers[0];
    if (onlyPeer?.id) {
      if (onlyPeer.name) {
        session.peerNameById[onlyPeer.id] = onlyPeer.name;
      }
      return {
        mappedPeerId: onlyPeer.id,
        mappedPeerName: onlyPeer.name || null,
        mappingConfidence: 1,
        mappingMethod: "single_participant"
      };
    }
  }

  const segStartMs = session.startedAtMs + startSec * 1000;
  const segEndMs = session.startedAtMs + endSec * 1000;
  trimPeerSpeechWindows(session, Date.now());
  let counts = collectPeerOverlapScores(session, segStartMs, segEndMs);
  let mappingMethod = "voice_overlap";

  if (!counts.size) {
    const fromMs = segStartMs - 600;
    const toMs = segEndMs + 600;
    counts = new Map();
    for (const ev of session.activeSpeakerEvents) {
      if (ev.tsMs < fromMs || ev.tsMs > toMs) continue;
      counts.set(ev.peerId, (counts.get(ev.peerId) || 0) + 1);
    }
    mappingMethod = counts.size ? "active_speaker_fallback" : "none";
  }

  if (!counts.size) {
    return { mappedPeerId: null, mappedPeerName: null, mappingConfidence: 0, mappingMethod };
  }

  let winnerPeerId = null;
  let winnerVotes = -1;
  let totalVotes = 0;
  for (const [peerId, votes] of counts.entries()) {
    totalVotes += votes;
    if (votes > winnerVotes) {
      winnerVotes = votes;
      winnerPeerId = peerId;
    }
  }

  if (!winnerPeerId || winnerVotes <= 0) {
    return { mappedPeerId: null, mappedPeerName: null, mappingConfidence: 0, mappingMethod };
  }

  const perSpeakerVotes = session.speakerPeerVotes[speakerId] || {};
  perSpeakerVotes[winnerPeerId] = (perSpeakerVotes[winnerPeerId] || 0) + winnerVotes;
  session.speakerPeerVotes[speakerId] = perSpeakerVotes;

  let stablePeerId = null;
  let stableVotes = -1;
  let stableTotal = 0;
  for (const [peerId, votes] of Object.entries(perSpeakerVotes)) {
    stableTotal += votes;
    if (votes > stableVotes) {
      stableVotes = votes;
      stablePeerId = peerId;
    }
  }

  const mappedPeerId = stablePeerId || winnerPeerId;
  const confidence = stableTotal > 0 ? stableVotes / stableTotal : winnerVotes / Math.max(totalVotes, 1);
  const mappedPeer = mappedPeerId ? peers.get(mappedPeerId) : null;
  if (mappedPeerId && mappedPeer?.name) {
    session.peerNameById[mappedPeerId] = mappedPeer.name;
  }

  return {
    mappedPeerId,
    mappedPeerName: mappedPeer ? mappedPeer.name : null,
    mappingConfidence: confidence,
    mappingMethod
  };
}

const SUPPORTED_TRANSCRIPTION_LANGUAGES = new Set([
  "multi",
  "ar", "ar-AE", "ar-SA", "ar-QA", "ar-KW", "ar-SY", "ar-LB", "ar-PS", "ar-JO", "ar-EG", "ar-SD", "ar-TD", "ar-MA", "ar-DZ", "ar-TN", "ar-IQ", "ar-IR",
  "be", "bg", "bn", "bs", "ca", "cs", "da", "da-DK", "de", "de-CH", "el", "en", "en-US", "en-AU", "en-GB", "en-IN", "en-NZ",
  "es", "es-419", "et", "fa", "fi", "fr", "fr-CA", "he", "hi", "hr", "hu", "id", "it", "ja", "kn", "ko", "ko-KR", "lt", "lv", "mk", "mr", "ms", "nl", "nl-BE", "no", "pl", "pt", "pt-BR", "pt-PT", "ro", "ru", "sk", "sl", "sr", "sv", "sv-SE", "ta", "te", "tl", "tr", "uk", "ur", "vi"
]);

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

function isSupportedTranscriptionLanguage(language) {
  return SUPPORTED_TRANSCRIPTION_LANGUAGES.has(language);
}

function buildDeepgramListenUrl(language) {
  const params = new URLSearchParams();
  params.set("model", DEEPGRAM_MODEL);
  params.set("language", language || "en");
  params.set("punctuate", String(DEEPGRAM_PUNCTUATE));
  params.set("smart_format", String(DEEPGRAM_SMART_FORMAT));
  params.set("interim_results", String(DEEPGRAM_INTERIM_RESULTS));
  params.set("diarize", String(DEEPGRAM_DIARIZE));
  params.set("utterances", String(DEEPGRAM_UTTERANCES));
  return "wss://api.deepgram.com/v1/listen?" + params.toString();
}

function formatTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe % 1) * 1000);
  return `PT${String(hours).padStart(2, "0")}H${String(minutes).padStart(2, "0")}M${String(secs).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}S`;
}

function cleanFilename(filename) {
  let name = String(filename || "").replace(/\.[^/.]+$/, "");
  name = name.replace(/[<>:"/\\|?*]/g, "_");
  name = name.replace(/["""''']/g, "");
  name = name.replace(/[_\s]+/g, "_");
  name = name.replace(/^_+|_+$/g, "");
  return name;
}

function extractSpeakerFromAlternative(alt) {
  const words = Array.isArray(alt?.words) ? alt.words : [];
  if (!words.length) return { speakerNumber: null, speakerId: null, startSec: null, endSec: null };

  let startSec = null;
  let endSec = null;
  const speakerCounts = new Map();

  for (const w of words) {
    const st = Number(w?.start);
    const en = Number(w?.end);
    if (Number.isFinite(st)) startSec = startSec === null ? st : Math.min(startSec, st);
    if (Number.isFinite(en)) endSec = endSec === null ? en : Math.max(endSec, en);
    if (Number.isInteger(w?.speaker)) {
      const s = Number(w.speaker);
      speakerCounts.set(s, (speakerCounts.get(s) || 0) + 1);
    }
  }

  if (!speakerCounts.size) {
    return { speakerNumber: null, speakerId: null, startSec, endSec };
  }

  let winnerSpeaker = null;
  let winnerCount = -1;
  for (const [speaker, count] of speakerCounts.entries()) {
    if (count > winnerCount) {
      winnerSpeaker = speaker;
      winnerCount = count;
    }
  }

  return {
    speakerNumber: winnerSpeaker,
    speakerId: winnerSpeaker === null ? null : `speaker_${winnerSpeaker}`,
    startSec,
    endSec
  };
}

function groupWordsBySpeaker(words) {
  const contributions = [];
  if (!Array.isArray(words) || words.length === 0) return contributions;

  let currentSpeaker = null;
  let currentWords = [];
  let currentStart = null;
  let currentEnd = null;

  for (const word of words) {
    const wordSpeaker = Number.isInteger(word?.speaker) ? Number(word.speaker) : 0;
    const wordText = String(word?.word || "").trim();
    const wordStart = Number(word?.start || 0);
    const wordEnd = Number(word?.end || 0);
    if (!wordText) continue;

    if (currentSpeaker !== wordSpeaker) {
      if (currentWords.length > 0 && currentSpeaker !== null && currentStart !== null && currentEnd !== null) {
        const contributionText = currentWords.join(" ").trim();
        if (contributionText) {
          contributions.push({
            speaker: currentSpeaker,
            text: contributionText,
            start_time: currentStart,
            end_time: currentEnd,
            words: currentWords.length
          });
        }
      }
      currentSpeaker = wordSpeaker;
      currentWords = [wordText];
      currentStart = wordStart;
      currentEnd = wordEnd;
    } else {
      currentWords.push(wordText);
      currentEnd = wordEnd;
    }
  }

  if (currentWords.length > 0 && currentSpeaker !== null && currentStart !== null && currentEnd !== null) {
    const contributionText = currentWords.join(" ").trim();
    if (contributionText) {
      contributions.push({
        speaker: currentSpeaker,
        text: contributionText,
        start_time: currentStart,
        end_time: currentEnd,
        words: currentWords.length
      });
    }
  }

  return contributions;
}

function createDeliberationOntologyFromWords({
  recordingSessionId,
  language,
  model,
  confidence,
  words,
  processedAt,
  speakerNameByNumber = {}
}) {
  const safeWords = Array.isArray(words) ? words.slice() : [];
  safeWords.sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  const contributions = groupWordsBySpeaker(safeWords);
  const speakers = Array.from(new Set(contributions.map((c) => c.speaker))).sort((a, b) => a - b);
  const totalDuration = Math.max(...safeWords.map((w) => Number(w.end || 0)), 0);
  const sourceFile = `${recordingSessionId}.webm`;
  const cleanName = cleanFilename(sourceFile);
  const debateId = `debate_${cleanName.toLowerCase()}`;
  const readableName = cleanName.replace(/_/g, " ");

  const out = {
    "@context": {
      del: "https://w3id.org/deliberation/ontology#",
      xsd: "http://www.w3.org/2001/XMLSchema#"
    },
    deliberation_process: {
      "@type": "del:DeliberationProcess",
      identifier: debateId,
      name: readableName
        .split(" ")
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" "),
      topic: {
        "@type": "del:Topic",
        identifier: `topic_${cleanName.toLowerCase()}`,
        text: readableName
      },
      source_file: sourceFile,
      duration: formatTimestamp(totalDuration),
      transcription_metadata: {
        model: model || DEEPGRAM_MODEL,
        language: language || "en",
        confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
        processed_at: processedAt || new Date().toISOString(),
        word_count: safeWords.length,
        speaker_count: speakers.length
      }
    },
    participants: [],
    contributions: [],
    statistics: {
      total_contributions: contributions.length,
      total_speakers: speakers.length,
      total_words: safeWords.length,
      average_contribution_length:
        contributions.length > 0
          ? contributions.reduce((sum, c) => sum + c.words, 0) / contributions.length
          : 0,
      duration_seconds: totalDuration
    }
  };

  for (const speakerId of speakers) {
    const speakerContributions = contributions.filter((c) => c.speaker === speakerId);
    const totalWords = speakerContributions.reduce((sum, c) => sum + c.words, 0);
    const speakingTime = speakerContributions.reduce((sum, c) => sum + (c.end_time - c.start_time), 0);
    out.participants.push({
      "@type": "del:Participant",
      identifier: `speaker_${speakerId}`,
      name: speakerNameByNumber[speakerId] || `Speaker ${speakerId}`,
      role: {
        "@type": "del:Role",
        identifier: `debater_${speakerId}`,
        name: "Debate Participant"
      },
      statistics: {
        total_contributions: speakerContributions.length,
        total_words: totalWords,
        speaking_time_seconds: speakingTime,
        average_words_per_contribution: speakerContributions.length > 0 ? totalWords / speakerContributions.length : 0
      }
    });
  }

  for (let i = 0; i < contributions.length; i += 1) {
    const c = contributions[i];
    out.contributions.push({
      "@type": "del:Contribution",
      identifier: `contribution_${String(i + 1).padStart(4, "0")}`,
      text: c.text,
      madeBy: `speaker_${c.speaker}`,
      timestamp: formatTimestamp(c.start_time),
      duration: formatTimestamp(c.end_time - c.start_time),
      start_time_seconds: c.start_time,
      end_time_seconds: c.end_time,
      word_count: c.words,
      sequence_number: i + 1
    });
  }

  return out;
}

function getLegacyTranscriptPath(roomId, recordingSessionId) {
  return path.join(RECORDINGS_DIR, roomId, `${recordingSessionId}.transcript.json`);
}

function getRawTranscriptPath(roomId, recordingSessionId) {
  return path.join(RECORDINGS_DIR, roomId, `${recordingSessionId}_raw.json`);
}

function getDeliberationTranscriptPath(roomId, recordingSessionId) {
  return path.join(RECORDINGS_DIR, roomId, `${recordingSessionId}_deliberation.json`);
}

function getChatLogPath(roomId, chatSessionId) {
  return path.join(RECORDINGS_DIR, roomId, `${chatSessionId}_chat.json`);
}

function createChatPayload(session) {
  const messages = (session.messages || []).map((m, idx) => ({
    "@type": "drchat:Message",
    identifier: `message_${String(idx + 1).padStart(4, "0")}`,
    sequence_number: idx + 1,
    timestamp: String(m.ts || new Date().toISOString()),
    participant_id: String(m.peerId || ""),
    participant_name: String(m.name || "participant"),
    text: String(m.text || "")
  }));

  return {
    "@context": {
      del: "https://w3id.org/deliberation/ontology#",
      drchat: "https://democracyroutes.com/ontology/chat#"
    },
    "@type": "drchat:ChatLog",
    chat_log: {
      "@type": "drchat:Session",
      identifier: String(session.chatSessionId || ""),
      room_id: String(session.roomId || ""),
      created_at: String(session.createdAt || new Date().toISOString()),
      updated_at: String(session.updatedAt || new Date().toISOString()),
      total_messages: messages.length
    },
    messages
  };
}

function persistChatSession(session) {
  if (!session || !session.roomId || !session.chatSessionId) return;
  const roomDir = path.join(RECORDINGS_DIR, session.roomId);
  fs.mkdirSync(roomDir, { recursive: true });
  const outPath = getChatLogPath(session.roomId, session.chatSessionId);
  fs.writeFileSync(outPath, JSON.stringify(createChatPayload(session), null, 2));
  return outPath;
}

function getOrCreateChatSession(roomId) {
  const key = String(roomId || "").trim();
  if (!key) return null;
  const existing = chatSessions.get(key);
  if (existing) return existing;

  const session = {
    roomId: key,
    chatSessionId: createId("chat"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  chatSessions.set(key, session);
  try {
    persistChatSession(session);
  } catch (error) {
    logger.warn("chat_session_persist_init_failed", {
      roomId: key,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  return session;
}

function appendChatMessage(roomId, peerId, name, text) {
  const safeText = String(text || "").trim();
  if (!safeText) return null;
  const session = getOrCreateChatSession(roomId);
  if (!session) return null;

  const entry = {
    ts: new Date().toISOString(),
    peerId: String(peerId || ""),
    name: String(name || "participant"),
    text: safeText
  };
  session.messages.push(entry);
  session.updatedAt = entry.ts;

  if (session.messages.length > 10000) {
    session.messages = session.messages.slice(session.messages.length - 10000);
  }

  let outPath = "";
  try {
    outPath = persistChatSession(session) || "";
  } catch (error) {
    logger.warn("chat_session_persist_failed", {
      roomId,
      chatSessionId: session.chatSessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  logger.info("chat_message", {
    roomId,
    peerId: entry.peerId,
    chatSessionId: session.chatSessionId,
    textLength: entry.text.length
  });
  traceRecTrans("chat_message", {
    roomId,
    peerId: entry.peerId,
    chatSessionId: session.chatSessionId,
    textLength: entry.text.length,
    persistedPath: outPath || null
  });

  return { ...entry, chatSessionId: session.chatSessionId };
}

function mergeMediaFiles(roomId, runId, orderedSessionIds) {
  const roomDir = path.join(RECORDINGS_DIR, roomId);
  const mergedPath = path.join(roomDir, `${runId}.webm`);
  const sourcePaths = orderedSessionIds
    .map((sessionId) => path.join(roomDir, `${sessionId}.webm`))
    .filter((p) => fs.existsSync(p));
  if (!sourcePaths.length) return null;

  if (sourcePaths.length === 1) {
    fs.copyFileSync(sourcePaths[0], mergedPath);
    return mergedPath;
  }

  const listPath = path.join(roomDir, `${runId}.concat.txt`);
  const concatList = sourcePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(listPath, concatList);
  try {
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      mergedPath
    ]);
  } finally {
    try {
      fs.unlinkSync(listPath);
    } catch {}
  }
  return fs.existsSync(mergedPath) ? mergedPath : null;
}

function mergeTranscriptFiles(roomId, runId, orderedSessionIds) {
  const roomDir = path.join(RECORDINGS_DIR, roomId);
  const mergedRawPath = getRawTranscriptPath(roomId, runId);
  const mergedDeliberationPath = getDeliberationTranscriptPath(roomId, runId);
  const mergedLegacyPath = getLegacyTranscriptPath(roomId, runId);

  const mergedRaw = {
    roomId,
    recordingSessionId: runId,
    mergedFromSessionIds: orderedSessionIds,
    ownerPeerId: null,
    language: "en",
    model: DEEPGRAM_MODEL,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedReason: "merged_run",
    events: [],
    entries: [],
    words: [],
    speaker_peer_votes: {},
    speaker_name_by_number: {}
  };

  for (const sessionId of orderedSessionIds) {
    const rawPath = getRawTranscriptPath(roomId, sessionId);
    const legacyPath = getLegacyTranscriptPath(roomId, sessionId);
    const sourcePath = fs.existsSync(rawPath) ? rawPath : fs.existsSync(legacyPath) ? legacyPath : "";
    if (!sourcePath) continue;

    try {
      const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      if (Array.isArray(parsed?.events)) mergedRaw.events.push(...parsed.events);
      if (Array.isArray(parsed?.entries)) mergedRaw.entries.push(...parsed.entries);
      if (Array.isArray(parsed?.words)) mergedRaw.words.push(...parsed.words);
      if (parsed?.language) mergedRaw.language = String(parsed.language);
      if (parsed?.model) mergedRaw.model = String(parsed.model);
      if (parsed?.ownerPeerId && !mergedRaw.ownerPeerId) mergedRaw.ownerPeerId = parsed.ownerPeerId;

      const votes = parsed?.speaker_peer_votes || {};
      for (const [speakerId, peerVotes] of Object.entries(votes)) {
        mergedRaw.speaker_peer_votes[speakerId] ||= {};
        for (const [peerId, votesRaw] of Object.entries(peerVotes || {})) {
          const votesNum = Number(votesRaw) || 0;
          mergedRaw.speaker_peer_votes[speakerId][peerId] =
            (mergedRaw.speaker_peer_votes[speakerId][peerId] || 0) + votesNum;
        }
      }

      const names = parsed?.speaker_name_by_number || {};
      for (const [speakerNumber, name] of Object.entries(names)) {
        if (name && !mergedRaw.speaker_name_by_number[speakerNumber]) {
          mergedRaw.speaker_name_by_number[speakerNumber] = name;
        }
      }
    } catch {}
  }

  mergedRaw.entries.sort((a, b) => Date.parse(String(a?.ts || "")) - Date.parse(String(b?.ts || "")));
  mergedRaw.words.sort((a, b) => Number(a?.start || 0) - Number(b?.start || 0));

  const confidences = mergedRaw.entries
    .map((e) => Number(e?.confidence))
    .filter((n) => Number.isFinite(n));
  const avgConfidence = confidences.length ? confidences.reduce((sum, n) => sum + n, 0) / confidences.length : 0;

  const deliberation = createDeliberationOntologyFromWords({
    recordingSessionId: runId,
    language: mergedRaw.language,
    model: mergedRaw.model,
    confidence: avgConfidence,
    words: mergedRaw.words,
    processedAt: new Date().toISOString(),
    speakerNameByNumber: Object.fromEntries(
      Object.entries(mergedRaw.speaker_name_by_number || {}).map(([k, v]) => [Number(k), v])
    )
  });

  fs.writeFileSync(mergedRawPath, JSON.stringify(mergedRaw, null, 2));
  fs.writeFileSync(mergedDeliberationPath, JSON.stringify(deliberation, null, 2));
  fs.writeFileSync(mergedLegacyPath, JSON.stringify(mergedRaw, null, 2));

  return {
    mergedRawPath,
    mergedDeliberationPath
  };
}

function cleanupMergedSourceSessions(roomId, runId, orderedSessionIds) {
  const roomDir = path.join(RECORDINGS_DIR, roomId);
  for (const sessionId of orderedSessionIds) {
    if (sessionId === runId) continue;
    const targets = [
      path.join(roomDir, `${sessionId}.webm`),
      path.join(roomDir, `${sessionId}.jsonl`),
      path.join(roomDir, `${sessionId}.parts`),
      getRawTranscriptPath(roomId, sessionId),
      getDeliberationTranscriptPath(roomId, sessionId),
      getLegacyTranscriptPath(roomId, sessionId)
    ];

    for (const target of targets) {
      if (!fs.existsSync(target)) continue;
      try {
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          fs.unlinkSync(target);
        }
      } catch {}
    }

    recordingIngest.delete(`${roomId}:${sessionId}`);
  }
}

function mergeRunArtifacts(run) {
  const roomId = run.roomId;
  const runId = run.runId;
  const sessionIds = Array.from(run.sessions || []);
  if (!sessionIds.length) return;

  const roomDir = path.join(RECORDINGS_DIR, roomId);
  fs.mkdirSync(roomDir, { recursive: true });

  for (const sessionId of sessionIds) {
    try {
      finalizeSessionPartsIfPresent(roomId, sessionId);
    } catch {}
  }

  const orderedSessionIds = sessionIds
    .slice()
    .sort((a, b) => getSessionStartMs(roomId, a) - getSessionStartMs(roomId, b));

  try {
    const mergedMediaPath = mergeMediaFiles(roomId, runId, orderedSessionIds);
    mergeTranscriptFiles(roomId, runId, orderedSessionIds);
    cleanupMergedSourceSessions(roomId, runId, orderedSessionIds);
    run.mergeCompletedAt = new Date().toISOString();
    recordingRuns.set(recordingRunKey(roomId, runId), run);
    logger.info("recording_run_merged", {
      roomId,
      runId,
      sessions: orderedSessionIds.length,
      mergedMediaPath
    });
    traceRecTrans("recording_run_merged", {
      roomId,
      runId,
      sessions: orderedSessionIds.length,
      mergedMediaPath
    });
  } catch (error) {
    logger.warn("recording_run_merge_failed", {
      roomId,
      runId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function endRecordingRun(roomId, reason = "recording_stopped") {
  const room = rooms.get(roomId);
  if (!room) return;
  const runId = room.recordingState.activeRunId;
  if (!runId) return;

  const key = recordingRunKey(roomId, runId);
  const run = recordingRuns.get(key);
  room.recordingState.activeRunId = null;
  room.recordingState.runStartedAt = null;
  if (!run) return;

  if (run.endedAt) return;
  run.endedAt = new Date().toISOString();
  recordingRuns.set(key, run);

  if (!run.mergeScheduled) {
    run.mergeScheduled = true;
    recordingRuns.set(key, run);
    setTimeout(() => {
      const latest = recordingRuns.get(key);
      if (!latest) return;
      mergeRunArtifacts(latest);
    }, 3000);
  }

  logger.info("recording_run_ended", { roomId, runId, reason });
  traceRecTrans("recording_run_ended", { roomId, runId, reason, sessionsCount: run.sessions.size });
}

function buildSpeakerNameByNumber(session) {
  const out = {};
  const votesBySpeaker = session?.speakerPeerVotes || {};
  const peerNames = session?.peerNameById || {};

  for (const [speakerId, peerVotes] of Object.entries(votesBySpeaker)) {
    const match = String(speakerId).match(/^speaker_(\d+)$/);
    if (!match) continue;
    const speakerNumber = Number(match[1]);
    if (!Number.isInteger(speakerNumber)) continue;

    let winnerPeerId = "";
    let winnerVotes = -1;
    let totalVotes = 0;
    for (const [peerId, votesRaw] of Object.entries(peerVotes || {})) {
      const votes = Number(votesRaw) || 0;
      totalVotes += votes;
      if (votes > winnerVotes) {
        winnerVotes = votes;
        winnerPeerId = peerId;
      }
    }
    if (!winnerPeerId || winnerVotes <= 0 || totalVotes <= 0) continue;

    const confidence = winnerVotes / totalVotes;
    const peerObj = peers.get(winnerPeerId);
    const winnerName = (peerObj && peerObj.name) || peerNames[winnerPeerId] || "";
    if (!winnerName) continue;
    if (confidence < 0.55) continue;
    out[speakerNumber] = winnerName;
  }

  return out;
}

function persistTranscriptionSession(session, reason = "manual_stop") {
  const recordingSessionId = String(session?.recordingSessionId || "").trim();
  const roomId = String(session?.roomId || "").trim();
  if (!roomId || !recordingSessionId) return;

  try {
    const roomDir = path.join(RECORDINGS_DIR, roomId);
    fs.mkdirSync(roomDir, { recursive: true });
    const rawPath = getRawTranscriptPath(roomId, recordingSessionId);
    const deliberationPath = getDeliberationTranscriptPath(roomId, recordingSessionId);
    const legacyPath = getLegacyTranscriptPath(roomId, recordingSessionId);

    const confidences = (Array.isArray(session.entries) ? session.entries : [])
      .map((e) => Number(e?.confidence))
      .filter((n) => Number.isFinite(n));
    const avgConfidence = confidences.length
      ? confidences.reduce((sum, n) => sum + n, 0) / confidences.length
      : 0;
    const speakerNameByNumber = buildSpeakerNameByNumber(session);

    const rawPayload = {
      roomId,
      recordingSessionId,
      ownerPeerId: session.ownerPeerId,
      language: session.language,
      model: DEEPGRAM_MODEL,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
      closedReason: reason,
      events: Array.isArray(session.rawEvents) ? session.rawEvents : [],
      entries: Array.isArray(session.entries) ? session.entries : [],
      words: Array.isArray(session.finalWords) ? session.finalWords : [],
      speaker_peer_votes: session.speakerPeerVotes || {},
      speaker_name_by_number: speakerNameByNumber
    };

    const deliberationPayload = createDeliberationOntologyFromWords({
      recordingSessionId,
      language: session.language,
      model: DEEPGRAM_MODEL,
      confidence: avgConfidence,
      words: Array.isArray(session.finalWords) ? session.finalWords : [],
      processedAt: new Date().toISOString(),
      speakerNameByNumber
    });

    fs.writeFileSync(rawPath, JSON.stringify(rawPayload, null, 2));
    fs.writeFileSync(deliberationPath, JSON.stringify(deliberationPayload, null, 2));
    // Backward compatibility for old admin endpoint/state.
    fs.writeFileSync(legacyPath, JSON.stringify(rawPayload, null, 2));

    const finalizedAt = new Date().toISOString();
    const segments = rawPayload.entries.map((entry, idx) => ({
      seq: idx + 1,
      text: String(entry?.text || "").trim(),
      isFinal: Boolean(entry?.isFinal ?? true),
      startMs: Number.isFinite(Number(entry?.start_time)) ? Math.round(Number(entry.start_time) * 1000) : null,
      endMs: Number.isFinite(Number(entry?.end_time)) ? Math.round(Number(entry.end_time) * 1000) : null,
      speakerTag: entry?.speakerId ? String(entry.speakerId) : null,
      mappedUserId: entry?.mappedPeerId ? String(entry.mappedPeerId) : null,
      mappedUserName: entry?.mappedPeerName ? String(entry.mappedPeerName) : null,
      confidence: Number.isFinite(Number(entry?.confidence)) ? Number(entry.confidence) : null,
      payload: entry
    })).filter((s) => Boolean(s.text));

    const artifacts = [
      { type: "deliberation", uri: deliberationPath, payload: deliberationPayload },
      { type: "raw", uri: rawPath, payload: rawPayload },
      { type: "legacy", uri: legacyPath, payload: rawPayload }
    ];

    const roomState = rooms.get(roomId);
    const meetingId = roomState?.meetingId || null;

    void sendTranscriptionFinalizeToHub({
      source: "dr-video",
      eventId: "dr-video:" + roomId + ":" + recordingSessionId + ":" + reason,
      roomId,
      sessionId: recordingSessionId,
      meetingId,
      runId: recordingSessionId,
      provider: "DEEPGRAMLIVE",
      language: rawPayload.language || null,
      status: "finalized",
      startedAt: rawPayload.createdAt || null,
      endedAt: finalizedAt,
      metadata: {
        ownerPeerId: rawPayload.ownerPeerId || null,
        model: rawPayload.model || null,
        closedReason: reason,
        deliberationStyle: true
      },
      segments,
      artifacts
    });

    traceRecTrans("transcription_persisted", {
      roomId,
      recordingSessionId,
      reason,
      entries: rawPayload.entries.length,
      words: rawPayload.words.length,
      rawPath,
      deliberationPath
    });
  } catch (error) {
    logger.warn("transcription_persist_failed", {
      roomId,
      recordingSessionId,
      reason,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function stopTranscriptionSession(roomId, reason = "manual_stop", recordingSessionIdHint = "") {
  const session = transcriptionSessions.get(roomId);
  if (!session) return;
  if (recordingSessionIdHint && session.recordingSessionId !== recordingSessionIdHint) return;

  persistTranscriptionSession(session, reason);

  transcriptionSessions.delete(roomId);

  if (session.keepAliveTimer) {
    clearInterval(session.keepAliveTimer);
  }

  if (session.ws && (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING)) {
    try {
      session.ws.close(1000, String(reason || "manual_stop").slice(0, 120));
    } catch {}
  }

  logger.info("transcription_session_stopped", {
    roomId,
    sessionId: session.sessionId,
    ownerPeerId: session.ownerPeerId,
    language: session.language,
    reason
  });
  traceRecTrans("transcription_session_stopped", {
    roomId,
    sessionId: session.sessionId,
    recordingSessionId: session.recordingSessionId,
    ownerPeerId: session.ownerPeerId,
    language: session.language,
    reason
  });
}

function getOrCreateTranscriptionSession(roomId, ownerPeerId, languageRaw, recordingSessionIdRaw = "") {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const language = normalizeTranscriptionLanguage(languageRaw);
  if (!language) {
    throw new Error("invalid transcription language");
  }
  if (!isSupportedTranscriptionLanguage(language)) {
    throw new Error("unsupported transcription language: " + language);
  }

  const recordingSessionId = String(recordingSessionIdRaw || "").trim();
  if (!recordingSessionId) {
    throw new Error("recording sessionId is required");
  }

  const existing = transcriptionSessions.get(roomId);
  if (existing && existing.language === language && existing.recordingSessionId === recordingSessionId) {
    // Single Deepgram call strategy:
    // keep one room-level DG websocket for the whole recording run even if owner changes.
    if (ownerPeerId && ownerPeerId !== existing.ownerPeerId) {
      existing.ownerPeerId = ownerPeerId;
      logger.info("transcription_session_owner_updated", {
        roomId,
        sessionId: existing.sessionId,
        ownerPeerId
      });
    }
    return existing;
  }

  if (existing) {
    stopTranscriptionSession(roomId, "replaced");
  }

  const sessionId = createId("dg");
  const wsUrl = buildDeepgramListenUrl(language);
  const dgWs = new WebSocket(wsUrl, {
    headers: {
      Authorization: "Token " + DEEPGRAM_API_KEY
    }
  });

  const session = {
    sessionId,
    roomId,
    ownerPeerId,
    recordingSessionId,
    language,
    ws: dgWs,
    queue: [],
    createdAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    lastChunkAt: null,
    lastTranscriptAt: null,
    entries: [],
    rawEvents: [],
    finalWords: [],
    activeSpeakerEvents: [],
    peerSpeechWindows: {},
    peerSpeechOpen: {},
    speakerPeerVotes: {},
    peerNameById: {},
    ready: false,
    keepAliveTimer: null
  };

  transcriptionSessions.set(roomId, session);
  traceRecTrans("transcription_session_created", {
    roomId,
    sessionId,
    recordingSessionId,
    ownerPeerId,
    language
  });

  dgWs.on("open", () => {
    session.ready = true;
    if (session.queue.length > 0) {
      for (const chunk of session.queue.splice(0)) {
        try {
          dgWs.send(chunk);
        } catch {}
      }
    }

    logger.info("transcription_session_open", {
      roomId,
      sessionId,
      ownerPeerId,
      language,
      model: DEEPGRAM_MODEL
    });
    traceRecTrans("transcription_session_open", {
      roomId,
      sessionId,
      recordingSessionId,
      ownerPeerId,
      language,
      queuedChunksFlushed: session.queue.length
    });
  });

  dgWs.on("message", (payloadRaw) => {
    let payload;
    try {
      payload = JSON.parse(String(payloadRaw));
    } catch {
      return;
    }

    if (payload && payload.type === "Error") {
      logger.warn("deepgram_error", { roomId, sessionId, error: payload.description || payload.message || "unknown" });
      return;
    }

    session.rawEvents.push(payload);

    const alt = payload && payload.channel && payload.channel.alternatives ? payload.channel.alternatives[0] : null;
    const text = String((alt && alt.transcript) || "").trim();
    if (!text) return;

    const isFinal = Boolean(payload && (payload.is_final || payload.speech_final));
    const speakerInfo = extractSpeakerFromAlternative(alt);
    const mapping = mapDiarizedSpeakerToPeer(session, speakerInfo);
    session.lastTranscriptAt = new Date().toISOString();
    session.entries.push({
      text,
      isFinal,
      confidence: alt && typeof alt.confidence === "number" ? alt.confidence : null,
      speakerNumber: speakerInfo.speakerNumber,
      speakerId: speakerInfo.speakerId,
      mappedPeerId: mapping.mappedPeerId,
      mappedPeerName: mapping.mappedPeerName,
      mappingConfidence: mapping.mappingConfidence,
      startSec: speakerInfo.startSec,
      endSec: speakerInfo.endSec,
      ts: session.lastTranscriptAt
    });

    if (isFinal && Array.isArray(alt?.words) && alt.words.length > 0) {
      const normalizedWords = alt.words
        .map((w) => ({
          word: String(w?.word || "").trim(),
          start: Number(w?.start || 0),
          end: Number(w?.end || 0),
          confidence: Number(w?.confidence || 0),
          speaker: Number.isInteger(w?.speaker) ? Number(w.speaker) : speakerInfo.speakerNumber ?? 0
        }))
        .filter((w) => Boolean(w.word));
      if (normalizedWords.length > 0) {
        session.finalWords.push(...normalizedWords);
      }
    }

    broadcastToRoom(roomId, "transcription", {
      text,
      isFinal,
      confidence: alt && typeof alt.confidence === "number" ? alt.confidence : null,
      speakerNumber: speakerInfo.speakerNumber,
      speakerId: speakerInfo.speakerId,
      mappedPeerId: mapping.mappedPeerId,
      mappedPeerName: mapping.mappedPeerName,
      mappingConfidence: mapping.mappingConfidence,
      startSec: speakerInfo.startSec,
      endSec: speakerInfo.endSec,
      language,
      peerId: session.ownerPeerId,
      ts: session.lastTranscriptAt
    });

    logger.debug("transcription_line", {
      roomId,
      sessionId,
      ownerPeerId: session.ownerPeerId,
      language,
      isFinal,
      mappedPeerId: mapping.mappedPeerId,
      chars: text.length
    });
  });

  dgWs.on("close", (code, reasonBuffer) => {
    if (session.keepAliveTimer) clearInterval(session.keepAliveTimer);
    const reason = String(reasonBuffer || "");

    if (transcriptionSessions.get(roomId) && transcriptionSessions.get(roomId).sessionId === sessionId) {
      transcriptionSessions.delete(roomId);
    }

    logger.info("transcription_session_closed", {
      roomId,
      sessionId,
      ownerPeerId: session.ownerPeerId,
      language,
      code,
      reason: reason || null
    });
    traceRecTrans("transcription_session_closed", {
      roomId,
      sessionId,
      recordingSessionId,
      ownerPeerId: session.ownerPeerId,
      language,
      code,
      reason: reason || null
    });
  });

  dgWs.on("error", (error) => {
    logger.warn("transcription_session_error", {
      roomId,
      sessionId,
      ownerPeerId: session.ownerPeerId,
      language,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  session.keepAliveTimer = setInterval(() => {
    if (dgWs.readyState !== WebSocket.OPEN) return;
    try {
      dgWs.send(JSON.stringify({ type: "KeepAlive" }));
    } catch {}
  }, Math.max(1000, DEEPGRAM_KEEPALIVE_MS));

  return session;
}

function pushTranscriptionChunk(session, chunk) {
  session.lastChunkAt = new Date().toISOString();

  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(chunk);
    traceRecTrans("transcription_chunk_sent_to_deepgram", {
      roomId: session.roomId,
      sessionId: session.sessionId,
      recordingSessionId: session.recordingSessionId,
      bytes: chunk.length,
      queuedChunks: session.queue.length
    });
    return;
  }

  session.queue.push(chunk);
  if (session.queue.length > 80) {
    session.queue.splice(0, session.queue.length - 80);
  }
  traceRecTrans("transcription_chunk_queued", {
    roomId: session.roomId,
    sessionId: session.sessionId,
    recordingSessionId: session.recordingSessionId,
    bytes: chunk.length,
    queuedChunks: session.queue.length,
    wsState: session.ws.readyState
  });
}

function closePeer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;

  const roomId = peer.roomId;
  const now = Date.now();
  const transcriptionSession = transcriptionSessions.get(roomId);
  if (transcriptionSession) {
    closePeerSpeechWindow(transcriptionSession, peerId, now);
    delete transcriptionSession.peerSpeechOpen?.[peerId];
    delete transcriptionSession.peerSpeechWindows?.[peerId];
  }

  for (const consumer of peer.consumers.values()) {
    try {
      consumer.close();
    } catch {}
  }

  for (const producer of peer.producers.values()) {
    try {
      producer.close();
    } catch {}
  }

  for (const transport of peer.transports.values()) {
    try {
      transport.close();
    } catch {}
  }

  peers.delete(peerId);

  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(peerId);

    if (room.recordingState.ownerPeerId === peerId && room.recordingState.enabled) {
      const nextOwnerPeerId = pickRecordingOwner(room, peerId);
      if (nextOwnerPeerId) {
        room.recordingState.enabled = true;
        room.recordingState.ownerPeerId = nextOwnerPeerId;
        broadcastToRoom(roomId, "recording-state", {
          enabled: true,
          ownerPeerId: nextOwnerPeerId,
          mode: room.recordingState.mode,
          transcriptionLanguage: room.recordingState.transcriptionLanguage || ""
        });
        logger.info("recording_owner_handover", {
          roomId,
          previousOwnerPeerId: peerId,
          nextOwnerPeerId,
          mode: room.recordingState.mode
        });
      } else {
        room.recordingState.enabled = false;
        room.recordingState.ownerPeerId = null;
        room.recordingState.mode = "av";
        room.recordingState.transcriptionLanguage = "";
        stopTranscriptionSession(roomId, "recording_owner_left_no_successor");
        endRecordingRun(roomId, "recording_owner_left_no_successor");
        broadcastToRoom(roomId, "recording-state", {
          enabled: false,
          ownerPeerId: null,
          mode: "av",
          transcriptionLanguage: ""
        });
        logger.info("recording_owner_left_no_successor", { roomId, peerId });
      }
    }

    broadcastToRoom(roomId, "peer-left", { peerId }, peerId);

    if (room.peers.size === 0) {
      closeRoomById(roomId, "room_closed");
    }
  }

  logger.info("peer_closed", {
    peerId,
    roomId,
    transportCount: peer.transports.size,
    producerCount: peer.producers.size,
    consumerCount: peer.consumers.size
  });
}

function ok(ws, requestId, data = {}) {
  ws.send(JSON.stringify({ requestId, ok: true, data }));
}

function fail(ws, requestId, error) {
  ws.send(JSON.stringify({ requestId, ok: false, error: String(error) }));
}

app.post("/api/record/chunk", (req, res) => {
  const roomId = String(req.query.roomId || "").trim();
  const peerId = String(req.query.peerId || "").trim();
  const sessionId = String(req.query.sessionId || "").trim();
  const mode = normalizeRecordingMode(req.query.mode);
  const seqRaw = Number(req.query.seq || 0);
  const seq = Number.isInteger(seqRaw) && seqRaw >= 0 ? seqRaw : NaN;

  if (!roomId || !peerId || !sessionId) {
    logger.warn("record_chunk_invalid_params", {
      requestId: req.requestId,
      roomId,
      peerId,
      sessionId,
      seq
    });
    return json(res, 400, { error: "roomId, peerId and sessionId are required" });
  }

  if (!Number.isInteger(seq)) {
    logger.warn("record_chunk_invalid_seq", {
      requestId: req.requestId,
      roomId,
      peerId,
      sessionId,
      seq: req.query.seq
    });
    return json(res, 400, { error: "invalid seq" });
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    logger.warn("record_chunk_empty", {
      requestId: req.requestId,
      roomId,
      peerId,
      sessionId,
      seq
    });
    return json(res, 400, { error: "empty chunk" });
  }

  const roomDir = path.join(RECORDINGS_DIR, roomId);
  fs.mkdirSync(roomDir, { recursive: true });

  const partsDir = path.join(roomDir, `${sessionId}.parts`);
  fs.mkdirSync(partsDir, { recursive: true });
  const partPath = path.join(partsDir, `${String(seq).padStart(8, "0")}.part`);
  const metaPath = path.join(roomDir, `${sessionId}.jsonl`);

  fs.writeFileSync(partPath, req.body);
  fs.appendFileSync(
    metaPath,
    JSON.stringify({ ts: new Date().toISOString(), seq, bytes: req.body.length, peerId }) + "\n"
  );

  const ingestKey = `${roomId}:${sessionId}`;
  const runId = attachSessionToActiveRun(roomId, sessionId);
  const prev = recordingIngest.get(ingestKey);
  recordingIngest.set(ingestKey, {
    roomId,
    peerId,
    sessionId,
    runId: runId || prev?.runId || null,
    mode,
    startedAt: prev?.startedAt || new Date().toISOString(),
    lastChunkAt: new Date().toISOString(),
    lastSeq: seq,
    chunks: (prev?.chunks || 0) + 1,
    bytes: (prev?.bytes || 0) + req.body.length
  });

  logger.debug("record_chunk_written", {
    requestId: req.requestId,
    roomId,
    peerId,
    sessionId,
    mode,
    seq,
    bytes: req.body.length
  });
  traceRecTrans("record_chunk_written", {
    requestId: req.requestId,
    roomId,
    peerId,
    sessionId,
    runId: runId || null,
    mode,
    seq,
    bytes: req.body.length
  });

  return json(res, 200, { ok: true, bytes: req.body.length });
});

app.post("/api/record/finalize", express.json(), (req, res) => {
  const roomId = String(req.body?.roomId || "").trim();
  const sessionId = String(req.body?.sessionId || "").trim();
  const mode = normalizeRecordingMode(req.body?.mode);

  if (!roomId || !sessionId) {
    logger.warn("record_finalize_invalid_params", {
      requestId: req.requestId,
      roomId,
      sessionId
    });
    return json(res, 400, { error: "roomId and sessionId are required" });
  }

  const roomDir = path.join(RECORDINGS_DIR, roomId);
  const mediaPath = path.join(roomDir, `${sessionId}.webm`);
  const partsDir = path.join(roomDir, `${sessionId}.parts`);
  let exists = fs.existsSync(mediaPath);
  let chunksCount = 0;

  if (fs.existsSync(partsDir)) {
    const partFiles = fs
      .readdirSync(partsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".part"))
      .map((e) => e.name)
      .sort();

    chunksCount = partFiles.length;

    if (partFiles.length > 0) {
      const seqs = partFiles
        .map((name) => Number(name.replace(/\.part$/, "")))
        .filter((n) => Number.isInteger(n))
        .sort((a, b) => a - b);
      const missingSeq = [];
      for (let i = 1; i < seqs.length; i += 1) {
        if (seqs[i] > seqs[i - 1] + 1) {
          for (let j = seqs[i - 1] + 1; j < seqs[i]; j += 1) missingSeq.push(j);
        }
      }
      if (missingSeq.length > 0) {
        logger.warn("record_finalize_missing_chunks", {
          requestId: req.requestId,
          roomId,
          sessionId,
          missingSeqCount: missingSeq.length,
          firstMissingSeq: missingSeq[0]
        });
      }

      const tmpPath = `${mediaPath}.tmp`;
      const fd = fs.openSync(tmpPath, "w");
      try {
        for (const filename of partFiles) {
          const chunkPath = path.join(partsDir, filename);
          const chunk = fs.readFileSync(chunkPath);
          fs.writeSync(fd, chunk);
        }
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmpPath, mediaPath);
      exists = true;
    }

    for (const filename of partFiles) {
      const chunkPath = path.join(partsDir, filename);
      if (fs.existsSync(chunkPath)) {
        try {
          fs.unlinkSync(chunkPath);
        } catch {}
      }
    }
    if (fs.existsSync(partsDir)) {
      try {
        fs.rmdirSync(partsDir);
      } catch {}
    }
  }

  if (!exists && chunksCount === 0) {
    logger.warn("record_finalize_no_media_chunks", {
      requestId: req.requestId,
      roomId,
      sessionId,
      mode: ingest?.mode || mode
    });
    traceRecTrans("record_finalize_no_media_chunks", {
      requestId: req.requestId,
      roomId,
      sessionId,
      mode: ingest?.mode || mode
    });
  }
  const ingestKey = `${roomId}:${sessionId}`;
  const ingest = recordingIngest.get(ingestKey);
  if (ingest) {
    ingest.finalizedAt = new Date().toISOString();
    recordingIngest.set(ingestKey, ingest);
  }

  logger.info("record_finalize", {
    requestId: req.requestId,
    roomId,
    sessionId,
    mode: ingest?.mode || mode,
    chunksCount,
    exists,
    path: mediaPath
  });
  traceRecTrans("record_finalize", {
    requestId: req.requestId,
    roomId,
    sessionId,
    mode: ingest?.mode || mode,
    chunksCount,
    exists,
    path: mediaPath
  });

  return json(res, 200, {
    ok: true,
    exists,
    path: mediaPath
  });
});

app.post("/api/transcription/chunk", (req, res) => {
  const roomId = String(req.query.roomId || "").trim();
  const peerId = String(req.query.peerId || "").trim();
  const recordingSessionIdRaw = String(req.query.sessionId || "").trim();
  const languageRaw = String(req.query.language || req.query.transcriptionLanguage || "").trim();
  const language = normalizeTranscriptionLanguage(languageRaw);

  if (!DEEPGRAM_API_KEY) {
    return json(res, 503, { error: "DEEPGRAM_API_KEY is not configured" });
  }

  if (!roomId || !peerId || !language || !recordingSessionIdRaw) {
    return json(res, 400, { error: "roomId, peerId, sessionId and language are required" });
  }

  if (!isSupportedTranscriptionLanguage(language)) {
    return json(res, 400, { error: "unsupported transcription language: " + language });
  }

  const room = rooms.get(roomId);
  if (!room) {
    return json(res, 404, { error: "room not found" });
  }

  if (room.recordingState.enabled && room.recordingState.ownerPeerId && room.recordingState.ownerPeerId !== peerId) {
    return json(res, 409, { error: "only recording owner can stream transcription chunks" });
  }

  const recordingSessionId = String(room.recordingState.activeRunId || recordingSessionIdRaw || "").trim();
  if (!recordingSessionId) {
    return json(res, 409, { error: "no active transcription session id" });
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return json(res, 400, { error: "empty chunk" });
  }

  try {
    const session = getOrCreateTranscriptionSession(roomId, peerId, language, recordingSessionId);
    room.recordingState.transcriptionLanguage = session.language;
    pushTranscriptionChunk(session, req.body);
    traceRecTrans("transcription_chunk_accepted", {
      requestId: req.requestId,
      roomId,
      peerId,
      recordingSessionId,
      language,
      deepgramSessionId: session.sessionId,
      queued: !session.ready,
      bytes: req.body.length
    });

    return json(res, 200, {
      ok: true,
      queued: !session.ready,
      language: session.language,
      sessionId: session.sessionId
    });
  } catch (error) {
    logger.warn("transcription_chunk_failed", {
      requestId: req.requestId,
      roomId,
      peerId,
      language,
      error: error instanceof Error ? error.message : String(error)
    });
    return json(res, 400, { error: error instanceof Error ? error.message : "transcription ingest failed" });
  }
});

app.post("/api/transcription/finalize", express.json(), (req, res) => {
  const roomId = String(req.body && req.body.roomId || "").trim();
  const peerId = String(req.body && req.body.peerId || "").trim();
  const recordingSessionId = String(req.body && req.body.sessionId || "").trim();

  if (!roomId) {
    return json(res, 400, { error: "roomId is required" });
  }

  const room = rooms.get(roomId);
  const session = transcriptionSessions.get(roomId);
  if (session && (!room || !room.recordingState.enabled)) {
    stopTranscriptionSession(roomId, "client_finalize", recordingSessionId);
  }
  traceRecTrans("transcription_finalize_requested", {
    requestId: req.requestId,
    roomId,
    peerId: peerId || null,
    recordingSessionId: recordingSessionId || null,
    sessionExists: Boolean(session),
    roomRecordingEnabled: Boolean(room?.recordingState?.enabled)
  });

  return json(res, 200, { ok: true });
});

function sanitizeRecordingId(value) {
  const v = String(value || "").trim();
  if (!v || !/^[a-zA-Z0-9_-]+$/.test(v)) return "";
  return v;
}

function listRoomTranscriptCandidates(roomId) {
  const safeRoomId = sanitizeRecordingId(roomId);
  if (!safeRoomId) return [];
  const roomDir = path.join(RECORDINGS_DIR, safeRoomId);
  if (!fs.existsSync(roomDir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(roomDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const isRaw = name.endsWith("_raw.json");
    const isLegacy = name.endsWith(".transcript.json");
    if (!isRaw && !isLegacy) continue;
    const fullPath = path.join(roomDir, name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    out.push({
      path: fullPath,
      format: isRaw ? "raw" : "legacy",
      mtimeMs: stat.mtimeMs
    });
  }

  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

function toHistoryEntry(raw, fallbackLanguage = "en") {
  const text = String(raw?.text || "").trim();
  if (!text) return null;
  const language = normalizeTranscriptionLanguage(raw?.language || fallbackLanguage || "") || "en";
  return {
    text,
    isFinal: Boolean(raw?.isFinal ?? true),
    language,
    speakerId: raw?.speakerId ? String(raw.speakerId) : "",
    mappedPeerId: raw?.mappedPeerId ? String(raw.mappedPeerId) : "",
    mappedPeerName: raw?.mappedPeerName ? String(raw.mappedPeerName) : "",
    peerId: raw?.peerId ? String(raw.peerId) : "",
    ts: raw?.ts ? String(raw.ts) : null
  };
}

function getRoomTranscriptHistory(roomId, maxItems = 200) {
  const safeRoomId = sanitizeRecordingId(roomId);
  if (!safeRoomId) return [];

  const active = transcriptionSessions.get(safeRoomId);
  if (active && Array.isArray(active.entries) && active.entries.length > 0) {
    const sourceEntries = active.entries.filter((e) => Boolean(e?.isFinal));
    const fallbackEntries = sourceEntries.length > 0 ? sourceEntries : active.entries;
    return fallbackEntries
      .slice(-maxItems)
      .map((e) => toHistoryEntry({ ...e, language: active.language, peerId: active.ownerPeerId }, active.language))
      .filter(Boolean);
  }

  const candidates = listRoomTranscriptCandidates(safeRoomId);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate.path, "utf8"));
      const language = normalizeTranscriptionLanguage(parsed?.language || "") || "en";
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
      if (!entries.length) continue;
      const finals = entries.filter((e) => Boolean(e?.isFinal));
      const sourceEntries = finals.length > 0 ? finals : entries;
      return sourceEntries
        .slice(-maxItems)
        .map((e) => toHistoryEntry(e, language))
        .filter(Boolean);
    } catch {}
  }

  return [];
}

function readMergedSourceSessions(roomId, sessionId) {
  const rawPath = getRawTranscriptPath(roomId, sessionId);
  const legacyPath = getLegacyTranscriptPath(roomId, sessionId);
  const sourcePath = fs.existsSync(rawPath) ? rawPath : fs.existsSync(legacyPath) ? legacyPath : "";
  if (!sourcePath) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const ids = Array.isArray(parsed?.mergedFromSessionIds)
      ? parsed.mergedFromSessionIds.map((v) => sanitizeRecordingId(v)).filter(Boolean)
      : [];
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

app.get("/api/recordings", (_req, res) => {
  const items = [];

  if (!fs.existsSync(RECORDINGS_DIR)) {
    return json(res, 200, { ok: true, items });
  }

  for (const roomEntry of fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })) {
    if (!roomEntry.isDirectory()) continue;
    const roomId = sanitizeRecordingId(roomEntry.name);
    if (!roomId) continue;

    const roomDir = path.join(RECORDINGS_DIR, roomEntry.name);
    for (const fileEntry of fs.readdirSync(roomDir, { withFileTypes: true })) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith(".webm")) continue;

      const sessionId = sanitizeRecordingId(fileEntry.name.slice(0, -5));
      if (!sessionId) continue;

      const fullPath = path.join(roomDir, fileEntry.name);
      const stat = fs.statSync(fullPath);
      const deliberationPath = getDeliberationTranscriptPath(roomId, sessionId);
      const rawPath = getRawTranscriptPath(roomId, sessionId);
      const legacyPath = getLegacyTranscriptPath(roomId, sessionId);
      const transcriptPath = fs.existsSync(deliberationPath)
        ? deliberationPath
        : fs.existsSync(legacyPath)
          ? legacyPath
          : fs.existsSync(rawPath)
            ? rawPath
            : "";
      const transcriptExists = Boolean(transcriptPath);
      const transcriptUpdatedAt = transcriptExists ? fs.statSync(transcriptPath).mtime.toISOString() : null;
      const transcriptFormat = fs.existsSync(deliberationPath)
        ? "deliberation"
        : fs.existsSync(legacyPath)
          ? "legacy"
          : fs.existsSync(rawPath)
            ? "raw"
            : null;
      const mergedFromSessionIds = readMergedSourceSessions(roomId, sessionId);
      items.push({
        roomId,
        sessionId,
        filename: fileEntry.name,
        bytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        transcriptExists,
        transcriptUpdatedAt,
        transcriptFormat,
        isMergedRun: mergedFromSessionIds.length > 0,
        mergedFromSessionIds,
        mergedFromCount: mergedFromSessionIds.length
      });
    }
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json(res, 200, { ok: true, items });
});

app.get("/api/recordings/file", (req, res) => {
  const roomId = sanitizeRecordingId(req.query.roomId);
  const sessionId = sanitizeRecordingId(req.query.sessionId);
  if (!roomId || !sessionId) {
    return json(res, 400, { error: "roomId and sessionId are required" });
  }

  const filePath = path.join(RECORDINGS_DIR, roomId, `${sessionId}.webm`);
  if (!fs.existsSync(filePath)) {
    return json(res, 404, { error: "recording not found" });
  }

  return res.sendFile(filePath);
});

app.get("/api/recordings/transcript", (req, res) => {
  const roomId = sanitizeRecordingId(req.query.roomId);
  const sessionId = sanitizeRecordingId(req.query.sessionId);
  const format = String(req.query.format || "deliberation").trim().toLowerCase();
  if (!roomId || !sessionId) {
    return json(res, 400, { error: "roomId and sessionId are required" });
  }

  const deliberationPath = getDeliberationTranscriptPath(roomId, sessionId);
  const rawPath = getRawTranscriptPath(roomId, sessionId);
  const legacyPath = getLegacyTranscriptPath(roomId, sessionId);
  let transcriptPath = "";
  if (format === "raw") transcriptPath = rawPath;
  else if (format === "legacy") transcriptPath = legacyPath;
  else transcriptPath = deliberationPath;
  if (!fs.existsSync(transcriptPath)) {
    // Fallback chain for compatibility.
    transcriptPath = [deliberationPath, legacyPath, rawPath].find((p) => fs.existsSync(p)) || "";
  }
  if (!fs.existsSync(transcriptPath)) {
    return json(res, 404, { error: "transcript not found" });
  }

  return res.sendFile(transcriptPath);
});

app.delete("/api/recordings", express.json(), (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const removed = [];

  for (const raw of rawItems) {
    const roomId = sanitizeRecordingId(raw?.roomId);
    const sessionId = sanitizeRecordingId(raw?.sessionId);
    if (!roomId || !sessionId) continue;

    const roomDir = path.join(RECORDINGS_DIR, roomId);
    const mediaPath = path.join(roomDir, `${sessionId}.webm`);
    const metaPath = path.join(roomDir, `${sessionId}.jsonl`);
    const deliberationPath = getDeliberationTranscriptPath(roomId, sessionId);
    const rawPath = getRawTranscriptPath(roomId, sessionId);
    const transcriptPath = getLegacyTranscriptPath(roomId, sessionId);
    const partsDir = path.join(roomDir, `${sessionId}.parts`);

    if (fs.existsSync(mediaPath)) {
      try {
        fs.unlinkSync(mediaPath);
        removed.push({ roomId, sessionId });
        recordingIngest.delete(`${roomId}:${sessionId}`);
      } catch {}
    }

    if (fs.existsSync(metaPath)) {
      try {
        fs.unlinkSync(metaPath);
      } catch {}
    }

    if (fs.existsSync(transcriptPath)) {
      try {
        fs.unlinkSync(transcriptPath);
      } catch {}
    }
    if (fs.existsSync(deliberationPath)) {
      try {
        fs.unlinkSync(deliberationPath);
      } catch {}
    }
    if (fs.existsSync(rawPath)) {
      try {
        fs.unlinkSync(rawPath);
      } catch {}
    }

    if (fs.existsSync(partsDir)) {
      try {
        for (const entry of fs.readdirSync(partsDir, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const fp = path.join(partsDir, entry.name);
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
        fs.rmdirSync(partsDir);
      } catch {}
    }

    if (fs.existsSync(roomDir) && fs.readdirSync(roomDir).length === 0) {
      try {
        fs.rmdirSync(roomDir);
      } catch {}
    }
  }

  return json(res, 200, { ok: true, removedCount: removed.length, removed });
});

app.get("/api/admin/status", (_req, res) => {
  const now = Date.now();
  const activeIngestThresholdMs = 15_000;

  const roomsState = Array.from(rooms.values()).map((room) => {
    const peersState = Array.from(room.peers)
      .map((id) => peers.get(id))
      .filter(Boolean)
      .map((p) => ({
        peerId: p.id,
        name: p.name,
        producers: p.producers.size,
        consumers: p.consumers.size,
        transports: p.transports.size
      }));

    return {
      roomId: room.id,
      peerCount: room.peers.size,
      recordingEnabled: room.recordingState.enabled,
      recordingOwnerPeerId: room.recordingState.ownerPeerId,
      recordingMode: room.recordingState.mode,
      peers: peersState
    };
  });

  const ingest = Array.from(recordingIngest.values())
    .map((s) => {
      const lastMs = Date.parse(s.lastChunkAt || "");
      const ageMs = Number.isFinite(lastMs) ? now - lastMs : null;
      return {
        roomId: s.roomId,
        peerId: s.peerId,
        sessionId: s.sessionId,
        runId: s.runId || null,
        mode: s.mode || "av",
        startedAt: s.startedAt,
        lastChunkAt: s.lastChunkAt,
        lastSeq: s.lastSeq,
        chunks: s.chunks,
        bytes: s.bytes,
        finalizedAt: s.finalizedAt || null,
        active: typeof ageMs === "number" ? ageMs <= activeIngestThresholdMs : false
      };
    })
    .sort((a, b) => Date.parse(b.lastChunkAt) - Date.parse(a.lastChunkAt));

  const transcription = Array.from(transcriptionSessions.values()).map((s) => ({
    roomId: s.roomId,
    ownerPeerId: s.ownerPeerId,
    sessionId: s.sessionId,
    recordingSessionId: s.recordingSessionId || null,
    language: s.language,
    createdAt: s.createdAt,
    lastChunkAt: s.lastChunkAt || null,
    lastTranscriptAt: s.lastTranscriptAt || null,
    transcriptEntries: Array.isArray(s.entries) ? s.entries.length : 0,
    wsState: s.ws && typeof s.ws.readyState === "number" ? s.ws.readyState : null,
    queuedChunks: s.queue ? s.queue.length : 0
  }));

  return json(res, 200, {
    ok: true,
    now: new Date(now).toISOString(),
    activeIngestThresholdMs,
    rooms: roomsState,
    ingest,
    transcription
  });
});

app.get("/api/rooms/state", (req, res) => {
  if (!requireAdminApiKey(req)) {
    return json(res, 403, { error: "Access denied" });
  }

  const roomId = String(req.query.roomId || req.query.room || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  if (!roomId) {
    return json(res, 400, { error: "roomId is required" });
  }

  return json(res, 200, {
    ok: true,
    ...getRoomSummary(roomId)
  });
});

app.post("/api/rooms/close-if-empty", express.json(), (req, res) => {
  if (!requireAdminApiKey(req)) {
    return json(res, 403, { error: "Access denied" });
  }

  const roomId = String(req.body?.roomId || req.body?.room || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  if (!roomId) {
    return json(res, 400, { error: "roomId is required" });
  }

  const summary = getRoomSummary(roomId);
  if (!summary.exists) {
    return json(res, 200, {
      ok: true,
      closed: false,
      reason: "room_not_found",
      ...summary
    });
  }

  if (summary.participantCount > 0) {
    return json(res, 409, {
      ok: false,
      closed: false,
      reason: "room_not_empty",
      ...summary
    });
  }

  const closed = closeRoomById(roomId, "api_close_if_empty");
  return json(res, 200, {
    ok: true,
    closed,
    reason: closed ? "room_closed" : "room_not_found",
    ...getRoomSummary(roomId)
  });
});

app.post("/api/recording/start", express.json(), (req, res) => {
  const roomId = String(req.body?.roomId || "").trim();
  const targetPeerId = String(req.body?.peerId || req.body?.targetPeerId || "").trim();
  const mode = normalizeRecordingMode(req.body?.mode);
  const requestedTranscriptionLanguage = normalizeTranscriptionLanguage(
    String(req.body?.transcriptionLanguage || "")
  );

  if (!roomId || !targetPeerId) {
    return json(res, 400, { error: "roomId and peerId are required" });
  }

  const room = rooms.get(roomId);
  if (!room) {
    return json(res, 404, { error: "room not found" });
  }

  if (!room.peers.has(targetPeerId)) {
    return json(res, 404, { error: "target peer not found in room" });
  }

  const targetPeer = peers.get(targetPeerId);
  if (!targetPeer || targetPeer.ws.readyState !== 1) {
    return json(res, 409, { error: "target peer is not connected" });
  }

  if (room.recordingState.enabled && room.recordingState.ownerPeerId && room.recordingState.ownerPeerId !== targetPeerId) {
    return json(res, 409, {
      error: "recording already active in this room",
      ownerPeerId: room.recordingState.ownerPeerId
    });
  }

  room.recordingState.enabled = true;
  room.recordingState.ownerPeerId = targetPeerId;
  room.recordingState.mode = mode;
  if (requestedTranscriptionLanguage) {
    room.recordingState.transcriptionLanguage = requestedTranscriptionLanguage;
  }
  if (!room.recordingState.activeRunId) {
    startRecordingRun(room, mode);
  }
  const state = {
    enabled: true,
    ownerPeerId: targetPeerId,
    mode,
    transcriptionLanguage: room.recordingState.transcriptionLanguage || ""
  };
  broadcastToRoom(roomId, "recording-state", state);

  logger.info("recording_start_requested_via_api", {
    requestId: req.requestId,
    roomId,
    targetPeerId,
    mode,
    transcriptionLanguage: room.recordingState.transcriptionLanguage || ""
  });

  return json(res, 200, {
    ok: true,
    roomId,
    ownerPeerId: targetPeerId,
    recordingEnabled: true,
    mode,
    transcriptionLanguage: room.recordingState.transcriptionLanguage || ""
  });
});

app.get("/api/metrics/hub", (_req, res) => {
  json(res, 200, {
    ok: true,
    hubConfigured: Boolean(TRANSCRIPTION_HUB_URL),
    pendingQueueSize: getPendingFiles().length,
    metrics: hubMetrics
  });
});

app.get("/api/health", (_req, res) => {
  json(res, 200, {
    ok: true,
    rooms: rooms.size,
    peers: peers.size
  });
});

const httpServer = app.listen(PORT, HOST, async () => {
  try {
    worker = await createWorker();
    logger.info("server_started", {
      host: HOST,
      port: PORT,
      announcedIp: ANNOUNCED_IP || null,
      rtcMinPort: RTC_MIN_PORT,
      rtcMaxPort: RTC_MAX_PORT,
      autoRecordOnJoin: AUTO_RECORD_ON_JOIN,
      forceTcp: FORCE_TCP,
      logPath: LOG_PATH,
      logLevel: LOG_LEVEL
    });
  } catch (error) {
    logger.fatal("server_start_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  const wsId = createId("ws");
  let currentPeerId = null;

  logger.info("ws_connected", { wsId });

  ws.on("message", async (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      logger.warn("ws_bad_json", { wsId });
      return;
    }

    const { action, requestId, data } = message;

    try {
      if (action === "join") {
        const roomId = String(data?.roomId || "").trim();
        const meetingId = String(data?.meetingId || "").trim();
        const name = String(data?.name || "Guest").trim() || "Guest";
        if (!roomId) throw new Error("roomId is required");
        if (!verifyAccessToken(String(data?.access || ""), roomId, meetingId || null)) {
          fail(ws, requestId, "access denied");
          try {
            ws.close();
          } catch {}
          return;
        }

        const room = await getOrCreateRoom(roomId);
        if (meetingId && !room.meetingId) room.meetingId = meetingId;
        if (meetingId && room.meetingId && room.meetingId !== meetingId) {
          logger.warn("room_meeting_id_mismatch", { roomId, existingMeetingId: room.meetingId, incomingMeetingId: meetingId });
        }
        const peerId = createId("peer");

        const peer = {
          id: peerId,
          roomId,
          name,
          ws,
          wsId,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map()
        };

        peers.set(peerId, peer);
        room.peers.add(peerId);
        currentPeerId = peerId;

        const existingPeers = Array.from(room.peers)
          .filter((id) => id !== peerId)
          .map((id) => {
            const p = peers.get(id);
            return p ? { peerId: p.id, name: p.name } : null;
          })
          .filter(Boolean);

        const producerIds = [];
        for (const id of room.peers) {
          if (id === peerId) continue;
          const p = peers.get(id);
          if (!p) continue;
          for (const producer of p.producers.values()) {
            producerIds.push({ peerId: id, producerId: producer.id, kind: producer.kind });
          }
        }

        const autoRecordModeRequested = data?.autoRecordMode ? normalizeRecordingMode(data?.autoRecordMode) : null;
        const autoRecordTranscriptionLanguageRequested = normalizeTranscriptionLanguage(
          String(data?.transcriptionLanguage || "")
        );
        const chatSession = getOrCreateChatSession(roomId);
        const chatMessages = Array.isArray(chatSession?.messages)
          ? chatSession.messages.slice(-120).map((m) => ({
              ts: m.ts,
              peerId: m.peerId,
              name: m.name,
              text: m.text
            }))
          : [];
        const transcriptHistory = getRoomTranscriptHistory(roomId, 200);

        if (
          AUTO_RECORD_ON_JOIN &&
          autoRecordModeRequested &&
          !room.recordingState.enabled &&
          !room.recordingState.ownerPeerId
        ) {
          room.recordingState.enabled = true;
          room.recordingState.ownerPeerId = peerId;
          room.recordingState.mode = autoRecordModeRequested;
          room.recordingState.transcriptionLanguage = autoRecordTranscriptionLanguageRequested || "";
          startRecordingRun(room, autoRecordModeRequested);
        }

        ok(ws, requestId, {
          peerId,
          roomId,
          rtpCapabilities: room.router.rtpCapabilities,
          peers: existingPeers,
          producerIds,
          autoRecord: room.recordingState.enabled,
          autoRecordMode: room.recordingState.mode,
          recordingEnabled: room.recordingState.enabled,
          recordingOwnerPeerId: room.recordingState.ownerPeerId,
          recordingMode: room.recordingState.mode,
          recordingTranscriptionLanguage: room.recordingState.transcriptionLanguage || "",
          meetingId: room.meetingId || null,
          chatMessages,
          chatSessionId: chatSession?.chatSessionId || null,
          transcriptHistory
        });

        logger.info("peer_joined", {
          wsId,
          peerId,
          roomId,
          name,
          roomPeerCount: room.peers.size,
          autoRecord: room.recordingState.enabled,
          autoRecordMode: room.recordingState.mode
        });

        broadcastToRoom(roomId, "peer-joined", { peerId, name }, peerId);
        return;
      }

      const peer = peers.get(currentPeerId);
      if (!peer) throw new Error("not joined");

      if (action === "createTransport") {
        const room = rooms.get(peer.roomId);
        if (!room) throw new Error("room not found");

        const direction = data?.direction === "recv" ? "recv" : "send";
        const transport = await createWebRtcTransport(room.router);
        peer.transports.set(transport.id, transport);

        transport.on("icestatechange", (state) => {
          logger.debug("transport_ice_state", {
            peerId: peer.id,
            roomId: peer.roomId,
            transportId: transport.id,
            direction,
            state
          });
        });

        transport.on("iceselectedtuplechange", (tuple) => {
          logger.debug("transport_ice_tuple", {
            peerId: peer.id,
            roomId: peer.roomId,
            transportId: transport.id,
            direction,
            tuple
          });
        });

        transport.on("dtlsstatechange", (state) => {
          logger.debug("transport_dtls_state", {
            peerId: peer.id,
            roomId: peer.roomId,
            transportId: transport.id,
            direction,
            state
          });

          if (state === "closed") {
            try {
              transport.close();
            } catch {}
            peer.transports.delete(transport.id);
            logger.debug("transport_closed", {
              peerId: peer.id,
              roomId: peer.roomId,
              transportId: transport.id,
              reason: "dtls_closed"
            });
          }
        });

        ok(ws, requestId, {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          direction
        });

        logger.debug("transport_created", {
          peerId: peer.id,
          roomId: peer.roomId,
          transportId: transport.id,
          direction
        });
        return;
      }

      if (action === "connectTransport") {
        const transport = peer.transports.get(String(data?.transportId || ""));
        if (!transport) throw new Error("transport not found");

        await transport.connect({ dtlsParameters: data?.dtlsParameters });
        ok(ws, requestId);

        logger.debug("transport_connected", {
          peerId: peer.id,
          roomId: peer.roomId,
          transportId: transport.id
        });
        return;
      }

      if (action === "produce") {
        const transport = peer.transports.get(String(data?.transportId || ""));
        if (!transport) throw new Error("transport not found");

        const producer = await transport.produce({
          kind: data?.kind,
          rtpParameters: data?.rtpParameters
        });

        peer.producers.set(producer.id, producer);

        producer.on("score", (score) => {
          logger.debug("producer_score", {
            peerId: peer.id,
            roomId: peer.roomId,
            producerId: producer.id,
            kind: producer.kind,
            score
          });
        });

        producer.on("transportclose", () => {
          peer.producers.delete(producer.id);
          logger.debug("producer_closed", {
            peerId: peer.id,
            roomId: peer.roomId,
            producerId: producer.id,
            reason: "transport_close"
          });
        });

        ok(ws, requestId, { producerId: producer.id });
        broadcastToRoom(
          peer.roomId,
          "new-producer",
          { peerId: peer.id, producerId: producer.id, kind: producer.kind },
          peer.id
        );

        logger.info("producer_created", {
          peerId: peer.id,
          roomId: peer.roomId,
          producerId: producer.id,
          kind: producer.kind
        });
        return;
      }

      if (action === "consume") {
        const room = rooms.get(peer.roomId);
        if (!room) throw new Error("room not found");

        const transport = peer.transports.get(String(data?.transportId || ""));
        if (!transport) throw new Error("recv transport not found");

        const producerId = String(data?.producerId || "");
        if (!producerId) throw new Error("producerId is required");

        if (!room.router.canConsume({ producerId, rtpCapabilities: data?.rtpCapabilities })) {
          throw new Error("cannot consume producer");
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities: data?.rtpCapabilities,
          paused: true
        });

        peer.consumers.set(consumer.id, consumer);

        consumer.on("score", (score) => {
          logger.debug("consumer_score", {
            peerId: peer.id,
            roomId: peer.roomId,
            consumerId: consumer.id,
            producerId,
            kind: consumer.kind,
            score
          });
        });

        consumer.on("transportclose", () => {
          peer.consumers.delete(consumer.id);
          logger.debug("consumer_closed", {
            peerId: peer.id,
            roomId: peer.roomId,
            consumerId: consumer.id,
            reason: "transport_close"
          });
        });

        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);
          try {
            consumer.close();
          } catch {}
          ws.send(JSON.stringify({ event: "consumer-closed", data: { consumerId: consumer.id, producerId } }));

          logger.debug("consumer_closed", {
            peerId: peer.id,
            roomId: peer.roomId,
            consumerId: consumer.id,
            producerId,
            reason: "producer_close"
          });
        });

        ok(ws, requestId, {
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        });

        logger.debug("consumer_created", {
          peerId: peer.id,
          roomId: peer.roomId,
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind
        });
        return;
      }

      if (action === "resumeConsumer") {
        const consumer = peer.consumers.get(String(data?.consumerId || ""));
        if (!consumer) throw new Error("consumer not found");
        await consumer.resume();
        ok(ws, requestId);

        logger.debug("consumer_resumed", {
          peerId: peer.id,
          roomId: peer.roomId,
          consumerId: consumer.id
        });
        return;
      }

      if (action === "setRecording") {
        const room = rooms.get(peer.roomId);
        if (!room) throw new Error("room not found");

        const enabled = Boolean(data?.enabled);
        const requestedMode = normalizeRecordingMode(data?.mode || room.recordingState.mode);
        traceRecTrans("setRecording_request", {
          peerId: peer.id,
          roomId: peer.roomId,
          requestedEnabled: enabled,
          requestedMode,
          currentEnabled: room.recordingState.enabled,
          currentOwnerPeerId: room.recordingState.ownerPeerId || null
        });

        if (enabled) {
          const wasEnabled = room.recordingState.enabled;
          const requestedTranscriptionLanguage = normalizeTranscriptionLanguage(
            String(data?.transcriptionLanguage || "")
          );
          if (room.recordingState.enabled && room.recordingState.ownerPeerId !== peer.id) {
            throw new Error("Recording already active in this room");
          }
          room.recordingState.enabled = true;
          room.recordingState.ownerPeerId = peer.id;
          room.recordingState.mode = requestedMode;
          if (requestedTranscriptionLanguage) {
            room.recordingState.transcriptionLanguage = requestedTranscriptionLanguage;
          } else if (!room.recordingState.transcriptionLanguage) {
            const activeTranscriptionSession = transcriptionSessions.get(peer.roomId);
            room.recordingState.transcriptionLanguage = activeTranscriptionSession?.language || "";
          }
          if (!wasEnabled) {
            startRecordingRun(room, requestedMode);
          }
        } else {
          if (room.recordingState.enabled && room.recordingState.ownerPeerId !== peer.id) {
            throw new Error("Only the recording owner can stop recording");
          }
          room.recordingState.enabled = false;
          room.recordingState.ownerPeerId = null;
          room.recordingState.mode = "av";
          room.recordingState.transcriptionLanguage = "";
          stopTranscriptionSession(peer.roomId, "recording_stopped");
          endRecordingRun(peer.roomId, "recording_stopped");
        }

        const state = {
          enabled: room.recordingState.enabled,
          ownerPeerId: room.recordingState.ownerPeerId,
          mode: room.recordingState.mode,
          transcriptionLanguage: room.recordingState.transcriptionLanguage || ""
        };
        ok(ws, requestId, state);
        broadcastToRoom(peer.roomId, "recording-state", state);

        logger.info("recording_state_changed", {
          peerId: peer.id,
          roomId: peer.roomId,
          enabled: room.recordingState.enabled,
          ownerPeerId: room.recordingState.ownerPeerId,
          mode: room.recordingState.mode
        });
        traceRecTrans("recording_state_changed", {
          peerId: peer.id,
          roomId: peer.roomId,
          enabled: room.recordingState.enabled,
          ownerPeerId: room.recordingState.ownerPeerId || null,
          mode: room.recordingState.mode
        });
        return;
      }

      if (action === "activeSpeaker") {
        recordTranscriptionActiveSpeaker(peer.roomId, peer.id, data?.activePeerId, data?.ts);
        if (requestId) ok(ws, requestId, { ok: true });
        return;
      }

      if (action === "voiceActivity") {
        recordTranscriptionVoiceActivity(peer.roomId, peer.id, data || {});
        if (requestId) ok(ws, requestId, { ok: true });
        return;
      }

      if (action === "chat") {
        const text = String(data?.text || "").trim();
        if (!text) throw new Error("chat text is required");
        if (text.length > 800) throw new Error("chat text too long");

        const entry = appendChatMessage(peer.roomId, peer.id, peer.name, text);
        if (!entry) throw new Error("chat send failed");

        const payload = {
          ts: entry.ts,
          peerId: entry.peerId,
          name: entry.name,
          text: entry.text,
          chatSessionId: entry.chatSessionId
        };
        if (requestId) ok(ws, requestId, { sent: true, chatSessionId: entry.chatSessionId, ts: entry.ts });
        broadcastToRoom(peer.roomId, "chat-message", payload);
        return;
      }

      if (action === "leave") {
        ok(ws, requestId);
        logger.info("peer_leave_requested", {
          peerId: peer.id,
          roomId: peer.roomId
        });
        closePeer(peer.id);
        currentPeerId = null;
        return;
      }

      throw new Error(`Unknown action: ${action}`);
    } catch (err) {
      logger.warn("ws_action_failed", {
        wsId,
        peerId: currentPeerId,
        action,
        requestId,
        error: err instanceof Error ? err.message : String(err)
      });
      fail(ws, requestId, err instanceof Error ? err.message : "internal error");
    }
  });

  ws.on("close", () => {
    logger.info("ws_closed", { wsId, peerId: currentPeerId });
    if (currentPeerId) {
      closePeer(currentPeerId);
      currentPeerId = null;
    }
  });

  ws.on("error", (error) => {
    logger.warn("ws_error", {
      wsId,
      peerId: currentPeerId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on("uncaughtException", (error) => {
  logger.fatal("uncaught_exception", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
