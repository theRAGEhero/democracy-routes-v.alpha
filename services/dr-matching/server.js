import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.DR_MATCHING_PORT || 3002);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const API_KEY = process.env.DR_MATCHING_API_KEY || "";
const DATA_DIR = process.env.DR_MATCHING_DATA_DIR || "/app/data";
const RUNS_FILE = path.join(DATA_DIR, "matching-runs.json");
const EVENT_HUB_BASE_URL = String(process.env.EVENT_HUB_BASE_URL || "").trim();
const EVENT_HUB_API_KEY = String(process.env.EVENT_HUB_API_KEY || "").trim();

function nowIso() {
  return new Date().toISOString();
}

async function postEventHub(event) {
  if (!EVENT_HUB_BASE_URL || !EVENT_HUB_API_KEY) return;
  try {
    await fetch(`${EVENT_HUB_BASE_URL.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EVENT_HUB_API_KEY
      },
      body: JSON.stringify(event)
    });
  } catch {
    // best-effort only
  }
}

async function readRuns() {
  try {
    const raw = await fs.readFile(RUNS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRuns(runs) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RUNS_FILE, JSON.stringify(runs, null, 2), "utf8");
}

function extractApiKey(req) {
  const headerKey = req.header("x-api-key");
  if (headerKey) return String(headerKey);
  const queryKey = req.query?.key;
  if (typeof queryKey === "string" && queryKey.trim()) return queryKey.trim();
  return "";
}

function requireApiKey(req, res) {
  if (!API_KEY) {
    res.status(500).json({ error: "DR_MATCHING_API_KEY not configured" });
    return false;
  }
  const provided = extractApiKey(req);
  if (!provided || provided !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function buildFallbackRooms(participants, groupSize) {
  const rooms = [];
  const normalized = [...participants];
  for (let i = 0; i < normalized.length; i += groupSize) {
    const slice = normalized.slice(i, i + groupSize);
    if (slice.length > 0) {
      rooms.push({
        participants: slice,
        reason: "Fallback pairing (Gemini unavailable)."
      });
    }
  }
  return rooms;
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response missing text");
  }
  return text;
}

function buildPrompt({ plan, recap, mode, groupSize }) {
  const transcriptSnippets = recap.meetingTranscripts
    .map((entry) => {
      const people = entry.participants?.join(" & ") || "Participants";
      const text = (entry.transcriptText || "").slice(0, 1200);
      return `Round ${entry.roundNumber} (${people}): ${text}`;
    })
    .join("\n\n");

  const participants = recap.participants || [];
  const modeLabel = mode === "anti" ? "anti-polarizing" : "polarizing";

  return `You are an expert facilitator. Create new meeting groups for the next round.

Mode: ${modeLabel}
Group size target: ${groupSize}

Participants:
${participants.join("\n")}

Transcript highlights:
${transcriptSnippets || "No transcripts available."}

Rules:
- Return JSON only.
- Output format:
{
  "summary": "short summary of the reasoning",
  "rooms": [
    {"participants": ["email"], "reason": "why this match"}
  ]
}
- Keep reasons concise and human-readable.
`;
}

function parseGeminiRooms(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON found in Gemini response");
  }
  const json = text.slice(start, end + 1);
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.rooms)) {
    throw new Error("Invalid Gemini JSON format");
  }
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    rooms: parsed.rooms
      .filter((room) => Array.isArray(room.participants))
      .map((room) => ({
        participants: room.participants,
        reason: typeof room.reason === "string" ? room.reason : ""
      }))
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

app.get("/api/runs", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  const runs = await readRuns();
  res.json({ runs });
});

app.post("/api/match", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  const body = req.body || {};
  const plan = body.plan || {};
  const recap = body.recap || {};
  const mode = body.mode === "anti" ? "anti" : "polar";
  const participants = recap.participants || [];
  const groupSize = Number(body.groupSize || plan.maxParticipantsPerRoom || 2);

  if (!Array.isArray(participants) || participants.length === 0) {
    res.status(400).json({ error: "Missing participants" });
    return;
  }

  const runId = crypto.randomUUID();
  let result = null;
  let error = null;

  try {
    const prompt = buildPrompt({ plan, recap, mode, groupSize });
    const responseText = await callGemini(prompt);
    result = parseGeminiRooms(responseText);
  } catch (err) {
    error = err?.message || "Unknown error";
    result = {
      summary: "Fallback matching used.",
      rooms: buildFallbackRooms(participants, groupSize)
    };
  }

  const payload = {
    id: runId,
    planId: plan.id || null,
    createdAt: nowIso(),
    mode: mode === "anti" ? "anti-polarizing" : "polarizing",
    groupSize,
    summary: result.summary,
    rooms: result.rooms,
    error
  };

  const runs = await readRuns();
  runs.unshift(payload);
  await writeRuns(runs.slice(0, 200));

  await postEventHub({
    source: "dr-matching",
    type: "matching_run",
    severity: error ? "warn" : "info",
    message: error ? "Matching fallback used" : "Matching run completed",
    templateId: plan.id || null,
    payload: {
      planId: plan.id || null,
      mode: payload.mode,
      groupSize,
      error
    }
  });

  res.json(payload);
});

app.get("/", async (req, res) => {
  if (!requireApiKey(req, res)) {
    res.status(401).send("Unauthorized");
    return;
  }
  const runs = await readRuns();
  const rows = runs.slice(0, 15).map((run) => {
    const rooms = run.rooms
      .map((room) => `<li><strong>${room.participants.join(" & ")}</strong><div class="reason">${room.reason}</div></li>`)
      .join("");
    return `<section class="run">
      <div class="run-head">
        <div>
          <div class="title">${run.mode}</div>
          <div class="meta">Plan: ${run.planId || "-"} · ${run.createdAt}</div>
        </div>
        <div class="badge">Group size: ${run.groupSize}</div>
      </div>
      <div class="summary">${run.summary || ""}</div>
      ${run.error ? `<div class="error">${run.error}</div>` : ""}
      <ul class="rooms">${rooms}</ul>
    </section>`;
  });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>DR Matching Console</title>
<style>
  body { font-family: "Inter", sans-serif; background:#0f172a; color:#e2e8f0; margin:0; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 60px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
  .run { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 20px 40px rgba(15,23,42,0.35); }
  .run-head { display:flex; justify-content:space-between; gap:12px; align-items:center; }
  .title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color:#fbbf24; }
  .meta { font-size: 12px; color:#94a3b8; margin-top: 4px; }
  .badge { background:#1f2937; color:#e2e8f0; padding:4px 10px; border-radius:999px; font-size:12px; }
  .summary { margin: 12px 0; font-size: 14px; }
  .error { color:#fecaca; font-size: 12px; margin-bottom: 12px; }
  .rooms { list-style:none; padding:0; margin:0; display:grid; gap:10px; }
  .rooms li { background:#0b1220; border:1px solid #1f2937; border-radius:12px; padding:10px; font-size: 13px; }
  .rooms .reason { color:#94a3b8; font-size: 12px; margin-top:4px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>DR Matching Console</h1>
  <div class="subtitle">Internal matching runs and AI rationale.</div>
  ${rows.length ? rows.join("") : `<div class="run">No matching runs yet.</div>`}
</div>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`[dr-matching] listening on ${PORT}`);
  void postEventHub({
    source: "dr-matching",
    type: "startup",
    severity: "info",
    message: `Listening on ${PORT}`
  });
});
