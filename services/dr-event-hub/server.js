import express from "express";
import Database from "better-sqlite3";

const PORT = Number(process.env.EVENT_HUB_PORT || 3040);
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = process.env.EVENT_HUB_DB || "/data/events.db";
const API_KEY = String(process.env.EVENT_HUB_API_KEY || "").trim();

const app = express();
app.use(express.json({ limit: "1mb" }));

const db = new Database(DB_PATH);

const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT,
      message TEXT,
      actor_id TEXT,
      dataspace_id TEXT,
      meeting_id TEXT,
      template_id TEXT,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
    CREATE INDEX IF NOT EXISTS idx_events_meeting ON events(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_events_dataspace ON events(dataspace_id);
    CREATE INDEX IF NOT EXISTS idx_events_template ON events(template_id);
  `);
};

init();

function requireKey(req, res, next) {
  if (!API_KEY) {
    return res.status(500).json({ error: "EVENT_HUB_API_KEY not configured" });
  }
  const header = req.headers["x-api-key"] || "";
  if (header !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "dr-event-hub" });
});

app.post("/api/events", requireKey, (req, res) => {
  const body = req.body || {};
  const source = String(body.source || "unknown").slice(0, 80);
  const type = String(body.type || "event").slice(0, 120);
  const severity = body.severity ? String(body.severity).slice(0, 24) : null;
  const message = body.message ? String(body.message).slice(0, 800) : null;
  const actorId = body.actorId ? String(body.actorId).slice(0, 120) : null;
  const dataspaceId = body.dataspaceId ? String(body.dataspaceId).slice(0, 120) : null;
  const meetingId = body.meetingId ? String(body.meetingId).slice(0, 120) : null;
  const templateId = body.templateId ? String(body.templateId).slice(0, 120) : null;
  const payload = body.payload ? JSON.stringify(body.payload).slice(0, 100000) : null;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO events (
      created_at,
      source,
      type,
      severity,
      message,
      actor_id,
      dataspace_id,
      meeting_id,
      template_id,
      payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    createdAt,
    source,
    type,
    severity,
    message,
    actorId,
    dataspaceId,
    meetingId,
    templateId,
    payload
  );

  res.json({ ok: true });
});

app.get("/api/events", requireKey, (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  const source = req.query.source ? String(req.query.source).slice(0, 80) : "";
  const severity = req.query.severity ? String(req.query.severity).slice(0, 24) : "";
  const meetingId = req.query.meetingId ? String(req.query.meetingId).slice(0, 120) : "";
  const dataspaceId = req.query.dataspaceId ? String(req.query.dataspaceId).slice(0, 120) : "";
  const templateId = req.query.templateId ? String(req.query.templateId).slice(0, 120) : "";
  const q = req.query.q ? String(req.query.q).slice(0, 120) : "";
  const sql = [
    "SELECT id, created_at, source, type, severity, message, actor_id, dataspace_id, meeting_id, template_id, payload FROM events",
    "WHERE 1=1",
    source ? "AND source = @source" : "",
    severity ? "AND severity = @severity" : "",
    meetingId ? "AND meeting_id = @meetingId" : "",
    dataspaceId ? "AND dataspace_id = @dataspaceId" : "",
    templateId ? "AND template_id = @templateId" : "",
    q ? "AND (message LIKE @query OR type LIKE @query OR source LIKE @query)" : "",
    "ORDER BY created_at DESC LIMIT @limit"
  ].filter(Boolean).join(" ");
  const rows = db.prepare(sql).all({
    source,
    severity,
    meetingId,
    dataspaceId,
    templateId,
    query: `%${q}%`,
    limit
  });

  const events = rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    type: row.type,
    severity: row.severity,
    message: row.message,
    actorId: row.actor_id,
    dataspaceId: row.dataspace_id,
    meetingId: row.meeting_id,
    templateId: row.template_id,
    payload: row.payload ? JSON.parse(row.payload) : null
  }));

  res.json({ events });
});

app.get("/api/events/summary", requireKey, (req, res) => {
  const hours = Math.max(1, Math.min(24 * 30, Number(req.query.hours || 24)));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) AS errors,
        SUM(CASE WHEN severity = 'warn' THEN 1 ELSE 0 END) AS warnings,
        COUNT(DISTINCT source) AS sources
       FROM events
       WHERE created_at >= ?`
    )
    .get(since);

  const bySource = db
    .prepare(
      `SELECT source, COUNT(*) AS count
       FROM events
       WHERE created_at >= ?
       GROUP BY source
       ORDER BY count DESC, source ASC
       LIMIT 12`
    )
    .all(since);

  const bySeverity = db
    .prepare(
      `SELECT COALESCE(severity, 'unknown') AS severity, COUNT(*) AS count
       FROM events
       WHERE created_at >= ?
       GROUP BY COALESCE(severity, 'unknown')
       ORDER BY count DESC`
    )
    .all(since);

  const byType = db
    .prepare(
      `SELECT type, COUNT(*) AS count
       FROM events
       WHERE created_at >= ?
       GROUP BY type
       ORDER BY count DESC, type ASC
       LIMIT 12`
    )
    .all(since);

  res.json({
    ok: true,
    hours,
    since,
    totals: {
      total: Number(totals?.total || 0),
      errors: Number(totals?.errors || 0),
      warnings: Number(totals?.warnings || 0),
      sources: Number(totals?.sources || 0)
    },
    bySource,
    bySeverity,
    byType
  });
});

app.listen(PORT, HOST, () => {
  console.log(`dr-event-hub listening on ${HOST}:${PORT}`);
});
