import crypto from "node:crypto";
import express from "express";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const PORT = Number(process.env.PORT || 3030);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = String(process.env.TRANSCRIPTION_HUB_DATABASE_URL || process.env.DATABASE_URL || "").trim();
const API_KEY = String(process.env.TRANSCRIPTION_HUB_API_KEY || "").trim();
const EVENT_HUB_BASE_URL = String(process.env.EVENT_HUB_BASE_URL || "").trim();
const EVENT_HUB_API_KEY = String(process.env.EVENT_HUB_API_KEY || "").trim();
const EVENT_HUB_MIN_LEVEL = String(process.env.EVENT_HUB_MIN_LEVEL || "info").toLowerCase();

if (!DATABASE_URL) {
  console.error("TRANSCRIPTION_HUB_DATABASE_URL (or DATABASE_URL) is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: "2mb" }));

function nowIso() {
  return new Date().toISOString();
}

function makeRequestId() {
  return `req_${Math.random().toString(36).slice(2, 11)}`;
}

function log(level, message, meta = {}) {
  const payload = { ts: nowIso(), level, message, ...meta };
  const line = JSON.stringify(payload);
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  void postEventHub(message, level, meta);
}

const levelRank = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

function shouldSendEvent(level) {
  const minRank = levelRank[EVENT_HUB_MIN_LEVEL] ?? levelRank.info;
  const rank = levelRank[level] ?? 999;
  return rank >= minRank;
}

async function postEventHub(type, level, meta = {}) {
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
        source: "transcription-hub",
        type,
        severity: level,
        message: type,
        payload: meta
      })
    });
  } catch {
    // best-effort only
  }
}

app.use((req, res, next) => {
  const requestId = makeRequestId();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    log("info", "http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });
  next();
});

function createPayloadHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload || {})).digest("hex");
}

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const incoming = String(req.headers["x-api-key"] || "").trim();
  if (incoming && incoming === API_KEY) return next();
  return res.status(401).json({ error: "unauthorized" });
}

async function initSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS transcription_sessions (
    session_id TEXT PRIMARY KEY,
    meeting_id TEXT,
    room_id TEXT NOT NULL,
    run_id TEXT,
    provider TEXT,
    language TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS transcription_segments (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES transcription_sessions(session_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    start_ms INTEGER,
    end_ms INTEGER,
    text TEXT NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT TRUE,
    speaker_tag TEXT,
    mapped_user_id TEXT,
    mapped_user_name TEXT,
    confidence DOUBLE PRECISION,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, seq, text)
  );

  CREATE TABLE IF NOT EXISTS transcription_artifacts (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES transcription_sessions(session_id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    uri TEXT,
    checksum TEXT,
    bytes BIGINT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ingest_events (
    event_id TEXT PRIMARY KEY,
    source TEXT,
    session_id TEXT,
    room_id TEXT,
    meeting_id TEXT,
    payload_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_transcription_sessions_meeting ON transcription_sessions(meeting_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transcription_sessions_room ON transcription_sessions(room_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transcription_segments_session_seq ON transcription_segments(session_id, seq);
  `;

  await pool.query(sql);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, ts: nowIso() });
  } catch (error) {
    log("error", "health_check_failed", { error: String(error?.message || error) });
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.post("/api/ingest/finalize", requireApiKey, async (req, res) => {
  const body = req.body || {};
  const source = String(body.source || "unknown");
  const eventId = String(body.eventId || "").trim() || `${source}:${String(body.sessionId || "")}:${String(body.roomId || "")}:${Date.now()}`;
  const roomId = String(body.roomId || "").trim();
  const sessionId = String(body.sessionId || "").trim();

  if (!roomId || !sessionId) {
    return res.status(400).json({ error: "roomId and sessionId are required" });
  }

  const meetingId = body.meetingId ? String(body.meetingId) : null;
  const runId = body.runId ? String(body.runId) : null;
  const provider = body.provider ? String(body.provider) : null;
  const language = body.language ? String(body.language) : null;
  const status = String(body.status || "finalized");
  const startedAt = body.startedAt ? new Date(body.startedAt) : null;
  const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const payloadHash = createPayloadHash(body);

  const segments = Array.isArray(body.segments) ? body.segments : [];
  const artifacts = Array.isArray(body.artifacts) ? body.artifacts : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const eventInsert = await client.query(
      `INSERT INTO ingest_events(event_id, source, session_id, room_id, meeting_id, payload_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, source, sessionId, roomId, meetingId, payloadHash]
    );

    if (eventInsert.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.json({ ok: true, duplicate: true, eventId, sessionId, roomId });
    }

    await client.query(
      `INSERT INTO transcription_sessions(session_id, meeting_id, room_id, run_id, provider, language, status, started_at, ended_at, metadata, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         meeting_id = COALESCE(EXCLUDED.meeting_id, transcription_sessions.meeting_id),
         room_id = EXCLUDED.room_id,
         run_id = COALESCE(EXCLUDED.run_id, transcription_sessions.run_id),
         provider = COALESCE(EXCLUDED.provider, transcription_sessions.provider),
         language = COALESCE(EXCLUDED.language, transcription_sessions.language),
         status = EXCLUDED.status,
         started_at = COALESCE(transcription_sessions.started_at, EXCLUDED.started_at),
         ended_at = COALESCE(EXCLUDED.ended_at, transcription_sessions.ended_at),
         metadata = COALESCE(EXCLUDED.metadata, transcription_sessions.metadata),
         updated_at = NOW()`,
      [sessionId, meetingId, roomId, runId, provider, language, status, startedAt, endedAt, metadata]
    );

    let insertedSegments = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i] || {};
      const text = String(seg.text || "").trim();
      if (!text) continue;
      const seq = Number.isInteger(seg.seq) ? seg.seq : i + 1;
      const startMs = Number.isFinite(Number(seg.startMs)) ? Number(seg.startMs) : null;
      const endMs = Number.isFinite(Number(seg.endMs)) ? Number(seg.endMs) : null;
      const isFinal = seg.isFinal !== false;
      const speakerTag = seg.speakerTag ? String(seg.speakerTag) : null;
      const mappedUserId = seg.mappedUserId ? String(seg.mappedUserId) : null;
      const mappedUserName = seg.mappedUserName ? String(seg.mappedUserName) : null;
      const confidence = Number.isFinite(Number(seg.confidence)) ? Number(seg.confidence) : null;
      const payload = seg.payload && typeof seg.payload === "object" ? seg.payload : {};

      const r = await client.query(
        `INSERT INTO transcription_segments(session_id, seq, start_ms, end_ms, text, is_final, speaker_tag, mapped_user_id, mapped_user_name, confidence, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (session_id, seq, text) DO NOTHING`,
        [sessionId, seq, startMs, endMs, text, isFinal, speakerTag, mappedUserId, mappedUserName, confidence, payload]
      );
      insertedSegments += r.rowCount;
    }

    let insertedArtifacts = 0;
    for (const artRaw of artifacts) {
      const art = artRaw || {};
      const artifactType = String(art.type || "").trim();
      if (!artifactType) continue;
      const uri = art.uri ? String(art.uri) : null;
      const checksum = art.checksum ? String(art.checksum) : null;
      const bytes = Number.isFinite(Number(art.bytes)) ? Number(art.bytes) : null;
      const payload = art.payload && typeof art.payload === "object" ? art.payload : {};
      const r = await client.query(
        `INSERT INTO transcription_artifacts(session_id, artifact_type, uri, checksum, bytes, payload)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [sessionId, artifactType, uri, checksum, bytes, payload]
      );
      insertedArtifacts += r.rowCount;
    }

    await client.query("COMMIT");
    return res.json({
      ok: true,
      duplicate: false,
      eventId,
      roomId,
      sessionId,
      insertedSegments,
      insertedArtifacts
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    log("error", "ingest_finalize_failed", {
      requestId: req.requestId || null,
      roomId,
      sessionId,
      error: String(error?.message || error)
    });
    return res.status(500).json({ error: "ingest_failed", message: String(error?.message || error) });
  } finally {
    client.release();
  }
});

app.get("/api/sessions/:sessionId", async (req, res) => {
  const sessionId = String(req.params.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  try {
    const sessionResult = await pool.query(
      `SELECT * FROM transcription_sessions WHERE session_id = $1`,
      [sessionId]
    );
    if (sessionResult.rowCount === 0) {
      return res.status(404).json({ error: "session_not_found" });
    }

    const segmentsResult = await pool.query(
      `SELECT seq, start_ms, end_ms, text, is_final, speaker_tag, mapped_user_id, mapped_user_name, confidence
       FROM transcription_segments
       WHERE session_id = $1
       ORDER BY seq ASC
       LIMIT 5000`,
      [sessionId]
    );

    const artifactsResult = await pool.query(
      `SELECT artifact_type, uri, checksum, bytes, payload, created_at
       FROM transcription_artifacts
       WHERE session_id = $1
       ORDER BY id ASC`,
      [sessionId]
    );

    return res.json({
      ok: true,
      session: sessionResult.rows[0],
      segments: segmentsResult.rows,
      artifacts: artifactsResult.rows
    });
  } catch (error) {
    log("error", "get_session_failed", {
      requestId: req.requestId || null,
      sessionId,
      error: String(error?.message || error)
    });
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

app.get("/api/sessions/:sessionId/deliberation", async (req, res) => {
  const sessionId = String(req.params.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  try {
    const result = await pool.query(
      `SELECT payload
       FROM transcription_artifacts
       WHERE session_id = $1 AND artifact_type = 'deliberation'
       ORDER BY id DESC
       LIMIT 1`,
      [sessionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "deliberation_not_found" });
    }

    return res.json({ ok: true, sessionId, deliberation: result.rows[0].payload });
  } catch (error) {
    log("error", "get_deliberation_failed", {
      requestId: req.requestId || null,
      sessionId,
      error: String(error?.message || error)
    });
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

app.get("/api/meetings/:meetingId/latest", async (req, res) => {
  const meetingId = String(req.params.meetingId || "").trim();
  if (!meetingId) return res.status(400).json({ error: "meetingId is required" });

  try {
    const result = await pool.query(
      `SELECT * FROM transcription_sessions
       WHERE meeting_id = $1
       ORDER BY COALESCE(ended_at, updated_at) DESC
       LIMIT 1`,
      [meetingId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ ok: true, session: result.rows[0] });
  } catch (error) {
    log("error", "get_meeting_latest_failed", {
      requestId: req.requestId || null,
      meetingId,
      error: String(error?.message || error)
    });
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

async function initSchemaWithRetry() {
  let lastError = null;
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    try {
      await initSchema();
      return;
    } catch (error) {
      lastError = error;
      log("warn", "transcription_hub_db_retry", {
        attempt,
        error: String(error?.message || error)
      });
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw lastError || new Error("database init failed");
}

(async () => {
  try {
    await initSchemaWithRetry();
    app.listen(PORT, HOST, () => {
      log("info", "transcription_hub_started", { host: HOST, port: PORT });
    });
  } catch (error) {
    log("fatal", "transcription_hub_start_failed", { error: String(error?.message || error) });
    process.exit(1);
  }
})();
