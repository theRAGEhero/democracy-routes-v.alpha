import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.DR_MATCHING_PORT || 3002);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const API_KEY = process.env.DR_MATCHING_API_KEY || "";
const DATA_DIR = process.env.DR_MATCHING_DATA_DIR || "/app/data";
const RUNS_FILE = path.join(DATA_DIR, "matching-runs.json");
const SETTINGS_FILE = path.join(DATA_DIR, "matching-settings.json");
const EVENT_HUB_BASE_URL = String(process.env.EVENT_HUB_BASE_URL || "").trim();
const EVENT_HUB_API_KEY = String(process.env.EVENT_HUB_API_KEY || "").trim();

const DEFAULT_SETTINGS = {
  strategyName: "Deliberative rematching",
  basePrompt:
    "You are an expert facilitator for Democracy Routes. Read the recent conversation fragments and propose the next room composition for the next round in a way that is useful, understandable, and workable for participants.",
  polarPrompt:
    "Polarizing mode: group participants who already show aligned concerns, compatible priorities, and similar desired outcomes. The goal is to deepen convergence, sharpen common proposals, and help people who are already close move faster toward shared conclusions.",
  antiPrompt:
    "Depolarizing mode: create constructive diversity. Put participants with different framings, concerns, or goals together so they can encounter disagreement productively. Avoid chaotic combinations. Aim for rooms where differences are meaningful but still discussable.",
  rulePrompt:
    "Use transcript evidence where available. Prefer concise, human-readable reasons. Avoid empty rooms. Keep room sizes close to the requested group size. Do not isolate one participant unless necessary. If evidence is thin, still return a reasonable grouping and say that the evidence is limited.",
  outputPrompt:
    'Return JSON only in the format {"summary":"...", "rooms":[{"participants":["email"], "reason":"..."}]}. Do not include markdown.',
  transcriptCharsPerMeeting: 1200,
  defaultGroupSize: 2,
  maxStoredRuns: 200,
  updatedAt: null
};

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
  await ensureDataDir();
  await fs.writeFile(RUNS_FILE, JSON.stringify(runs, null, 2), "utf8");
}

function normalizeSettings(input = {}) {
  const transcriptCharsPerMeeting = Math.max(
    200,
    Math.min(4000, Number(input.transcriptCharsPerMeeting || DEFAULT_SETTINGS.transcriptCharsPerMeeting))
  );
  const defaultGroupSize = Math.max(
    2,
    Math.min(12, Number(input.defaultGroupSize || DEFAULT_SETTINGS.defaultGroupSize))
  );
  const maxStoredRuns = Math.max(
    20,
    Math.min(1000, Number(input.maxStoredRuns || DEFAULT_SETTINGS.maxStoredRuns))
  );

  return {
    strategyName: String(input.strategyName || DEFAULT_SETTINGS.strategyName).trim().slice(0, 120),
    basePrompt: String(input.basePrompt || DEFAULT_SETTINGS.basePrompt).trim().slice(0, 8000),
    polarPrompt: String(input.polarPrompt || DEFAULT_SETTINGS.polarPrompt).trim().slice(0, 8000),
    antiPrompt: String(input.antiPrompt || DEFAULT_SETTINGS.antiPrompt).trim().slice(0, 8000),
    rulePrompt: String(input.rulePrompt || DEFAULT_SETTINGS.rulePrompt).trim().slice(0, 8000),
    outputPrompt: String(input.outputPrompt || DEFAULT_SETTINGS.outputPrompt).trim().slice(0, 4000),
    transcriptCharsPerMeeting,
    defaultGroupSize,
    maxStoredRuns,
    updatedAt: nowIso()
  };
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(settings) {
  await ensureDataDir();
  const normalized = normalizeSettings(settings);
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
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
        reason: "Fallback pairing used because AI matching was unavailable."
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
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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

function buildPrompt({ plan, recap, mode, groupSize, settings }) {
  const transcriptLimit = Number(settings.transcriptCharsPerMeeting || DEFAULT_SETTINGS.transcriptCharsPerMeeting);
  const transcriptSnippets = (recap.meetingTranscripts || [])
    .map((entry) => {
      const people = entry.participants?.join(" & ") || "Participants";
      const text = String(entry.transcriptText || "").slice(0, transcriptLimit);
      return `Round ${entry.roundNumber} (${people}): ${text}`;
    })
    .join("\n\n");

  const participants = Array.isArray(recap.participants) ? recap.participants : [];
  const modeInstruction = mode === "anti" ? settings.antiPrompt : settings.polarPrompt;
  const modeLabel = mode === "anti" ? "anti-polarizing" : "polarizing";

  return [
    settings.basePrompt,
    "",
    `Strategy name: ${settings.strategyName}`,
    `Mode: ${modeLabel}`,
    `Group size target: ${groupSize}`,
    "",
    "Participants:",
    participants.join("\n"),
    "",
    "Transcript highlights:",
    transcriptSnippets || "No transcripts available.",
    "",
    "Mode-specific instruction:",
    modeInstruction,
    "",
    "Operating rules:",
    settings.rulePrompt,
    "",
    "Output contract:",
    settings.outputPrompt
  ].join("\n");
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

function renderConsoleHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>DR Matching Console</title>
<style>
  :root {
    color-scheme: light;
    --ink: #151515;
    --muted: #5a5a5a;
    --paper: #f7f3ea;
    --accent: #f97316;
    --accent-deep: #9a3412;
    --mint: #14b8a6;
    --shadow: rgba(18, 18, 18, 0.12);
    --card: rgba(255, 255, 255, 0.78);
    --stroke: rgba(0, 0, 0, 0.08);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at 15% 10%, #ffe9cf, transparent 45%),
      radial-gradient(circle at 80% 0%, #d8f4ff, transparent 55%),
      linear-gradient(180deg, #fffdf8 0%, #f2f0e8 100%);
  }
  .wrap {
    width: min(1280px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 48px;
  }
  .hero {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    margin-bottom: 20px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
  }
  h1 {
    margin: 6px 0 8px;
    font-family: "Fraunces", Georgia, serif;
    font-size: clamp(28px, 4vw, 44px);
    line-height: 1;
  }
  .subtitle {
    max-width: 720px;
    color: var(--muted);
    font-size: 14px;
  }
  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }
  .badge {
    border: 1px solid var(--stroke);
    border-radius: 999px;
    background: rgba(255,255,255,0.72);
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
    gap: 18px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--stroke);
    border-radius: 22px;
    box-shadow: 0 24px 60px var(--shadow);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }
  .card-head {
    padding: 18px 20px 14px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .card-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
  }
  .card-note {
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
  }
  .card-body {
    padding: 18px 20px 20px;
  }
  .mode-card {
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 18px;
    padding: 14px;
    background: rgba(255,255,255,0.72);
  }
  .mode-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #64748b;
  }
  .mode-title {
    margin-top: 6px;
    font-size: 16px;
    font-weight: 700;
  }
  .mode-copy {
    margin-top: 8px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .stack {
    display: grid;
    gap: 14px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }
  input, textarea {
    width: 100%;
    border-radius: 14px;
    border: 1px solid var(--stroke);
    background: rgba(255,255,255,0.75);
    color: var(--ink);
    padding: 11px 12px;
    font: inherit;
  }
  textarea {
    min-height: 110px;
    resize: vertical;
  }
  .two-up {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .button, .button-outline {
    border-radius: 999px;
    font-weight: 700;
    cursor: pointer;
    padding: 10px 14px;
    border: 1px solid transparent;
    font-size: 13px;
  }
  .button {
    background: var(--accent);
    color: white;
  }
  .button:hover { background: var(--accent-deep); }
  .button-outline {
    border-color: var(--stroke);
    background: rgba(255,255,255,0.7);
    color: var(--ink);
  }
  .status {
    font-size: 12px;
    color: var(--muted);
  }
  .run-list {
    display: grid;
    gap: 12px;
  }
  .run {
    border: 1px solid rgba(0,0,0,0.06);
    background: rgba(255,255,255,0.68);
    border-radius: 18px;
    padding: 14px;
  }
  .run-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .run-type {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent-deep);
  }
  .run-meta {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
  }
  .run-badge {
    border-radius: 999px;
    background: #fff;
    border: 1px solid var(--stroke);
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 700;
  }
  .run-summary {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 1.5;
  }
  .run-error {
    margin-top: 10px;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 600;
  }
  .rooms {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .room {
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.06);
    background: rgba(248,250,252,0.9);
    padding: 10px 11px;
  }
  .room-people {
    font-size: 13px;
    font-weight: 700;
  }
  .room-reason {
    margin-top: 4px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
  }
  .empty {
    border-radius: 18px;
    border: 1px dashed rgba(0,0,0,0.12);
    padding: 18px;
    color: var(--muted);
    background: rgba(255,255,255,0.58);
  }
  .hint {
    font-size: 12px;
    color: var(--muted);
  }
  @media (max-width: 980px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .wrap {
      width: min(100vw - 20px, 1280px);
      padding-top: 18px;
    }
    .card-head, .card-body {
      padding-left: 14px;
      padding-right: 14px;
    }
    .two-up {
      grid-template-columns: 1fr;
    }
    .mode-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div>
      <div class="eyebrow">Matching Admin</div>
      <h1>DR Matching Console</h1>
      <div class="subtitle">Tune the AI instructions that generate rematching decisions, then inspect recent runs and their human-readable reasons.</div>
    </div>
    <div class="badge-row">
      <div class="badge" id="badgeStrategy">Strategy</div>
      <div class="badge" id="badgeRuns">Runs</div>
      <div class="badge" id="badgeTranscript">Transcript clip</div>
    </div>
  </div>

  <div class="grid">
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Matching settings</h2>
        <div class="card-note">These settings shape the prompt sent to Gemini for every matching run.</div>
      </div>
      <div class="card-body">
        <div class="mode-grid">
          <div class="mode-card">
            <div class="mode-label">Mode</div>
            <div class="mode-title">Polarizing</div>
            <div class="mode-copy">
              Use this when you want to cluster people with similar concerns or goals so they can strengthen agreement, develop shared proposals, and move faster toward convergence.
            </div>
          </div>
          <div class="mode-card">
            <div class="mode-label">Mode</div>
            <div class="mode-title">Depolarizing</div>
            <div class="mode-copy">
              Use this when you want to mix people with different views in a constructive way, so disagreement becomes productive and participants can better understand tensions across positions.
            </div>
          </div>
        </div>
        <form id="settingsForm" class="stack">
          <label>
            Strategy name
            <input type="text" name="strategyName" />
          </label>

          <label>
            Base prompt
            <textarea name="basePrompt"></textarea>
          </label>

          <label>
            Polarizing instructions
            <textarea name="polarPrompt"></textarea>
          </label>

          <label>
            Depolarizing instructions
            <textarea name="antiPrompt"></textarea>
          </label>

          <label>
            General rules
            <textarea name="rulePrompt"></textarea>
          </label>

          <label>
            Output contract
            <textarea name="outputPrompt"></textarea>
          </label>

          <div class="two-up">
            <label>
              Transcript chars per meeting
              <input type="number" min="200" max="4000" step="50" name="transcriptCharsPerMeeting" />
            </label>
            <label>
              Default group size
              <input type="number" min="2" max="12" step="1" name="defaultGroupSize" />
            </label>
          </div>

          <label>
            Max stored runs
            <input type="number" min="20" max="1000" step="10" name="maxStoredRuns" />
          </label>

          <div class="actions">
            <button class="button" type="submit">Save settings</button>
            <button class="button-outline" type="button" id="reloadButton">Reload</button>
            <span class="status" id="saveStatus">Loading…</span>
          </div>
          <div class="hint" id="updatedAt"></div>
        </form>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Recent runs</h2>
        <div class="card-note">Latest matching decisions, grouped with rationale and any fallback/error state.</div>
      </div>
      <div class="card-body">
        <div id="runsList" class="run-list"></div>
      </div>
    </section>
  </div>
</div>
<script>
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key") || "";
  const settingsForm = document.getElementById("settingsForm");
  const saveStatus = document.getElementById("saveStatus");
  const reloadButton = document.getElementById("reloadButton");
  const runsList = document.getElementById("runsList");
  const badgeStrategy = document.getElementById("badgeStrategy");
  const badgeRuns = document.getElementById("badgeRuns");
  const badgeTranscript = document.getElementById("badgeTranscript");
  const updatedAt = document.getElementById("updatedAt");

  function roomHtml(room) {
    const people = Array.isArray(room.participants) ? room.participants.join(" &middot; ") : "";
    return '<li class="room"><div class="room-people">' + people + '</div><div class="room-reason">' + (room.reason || "") + '</div></li>';
  }

  function runHtml(run) {
    const rooms = Array.isArray(run.rooms) ? run.rooms.map(roomHtml).join("") : "";
    return '<article class="run">' +
      '<div class="run-head">' +
        '<div>' +
          '<div class="run-type">' + (run.mode || "matching") + '</div>' +
          '<div class="run-meta">Template: ' + (run.planId || "-") + ' · ' + (run.createdAt || "-") + '</div>' +
        '</div>' +
        '<div class="run-badge">Group size ' + (run.groupSize || "-") + '</div>' +
      '</div>' +
      '<div class="run-summary">' + (run.summary || "") + '</div>' +
      (run.error ? '<div class="run-error">' + run.error + '</div>' : '') +
      '<ul class="rooms">' + rooms + '</ul>' +
    '</article>';
  }

  function fillSettings(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      const field = settingsForm.elements.namedItem(key);
      if (!field) return;
      field.value = value == null ? "" : value;
    });
    badgeStrategy.textContent = 'Strategy: ' + (settings.strategyName || 'custom');
    badgeTranscript.textContent = 'Transcript clip: ' + (settings.transcriptCharsPerMeeting || '-') + ' chars';
    updatedAt.textContent = settings.updatedAt ? 'Last updated: ' + settings.updatedAt : 'Using default settings.';
  }

  async function loadSettings() {
    const response = await fetch('/api/settings?key=' + encodeURIComponent(key));
    if (!response.ok) {
      throw new Error('Unable to load settings');
    }
    const payload = await response.json();
    fillSettings(payload.settings || {});
  }

  async function loadRuns() {
    const response = await fetch('/api/runs?key=' + encodeURIComponent(key));
    if (!response.ok) {
      throw new Error('Unable to load runs');
    }
    const payload = await response.json();
    const runs = Array.isArray(payload.runs) ? payload.runs : [];
    badgeRuns.textContent = 'Runs: ' + runs.length;
    runsList.innerHTML = runs.length ? runs.slice(0, 20).map(runHtml).join('') : '<div class="empty">No matching runs yet.</div>';
  }

  async function bootstrap() {
    try {
      await Promise.all([loadSettings(), loadRuns()]);
      saveStatus.textContent = 'Ready';
    } catch (error) {
      saveStatus.textContent = error.message || 'Unable to load console';
      runsList.innerHTML = '<div class="empty">Unable to load data.</div>';
    }
  }

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveStatus.textContent = 'Saving…';
    const formData = new FormData(settingsForm);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch('/api/settings?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save settings');
      }
      fillSettings(data.settings || {});
      saveStatus.textContent = 'Saved';
    } catch (error) {
      saveStatus.textContent = error.message || 'Save failed';
    }
  });

  reloadButton.addEventListener('click', () => {
    saveStatus.textContent = 'Reloading…';
    bootstrap();
  });

  bootstrap();
</script>
</body>
</html>`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

app.get("/api/settings", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  const settings = await readSettings();
  res.json({ settings });
});

app.post("/api/settings", async (req, res) => {
  if (!requireApiKey(req, res)) return;
  const settings = await writeSettings(req.body || {});
  await postEventHub({
    source: "dr-matching",
    type: "matching_settings_updated",
    severity: "info",
    message: "Matching settings updated",
    payload: {
      strategyName: settings.strategyName,
      transcriptCharsPerMeeting: settings.transcriptCharsPerMeeting,
      defaultGroupSize: settings.defaultGroupSize,
      maxStoredRuns: settings.maxStoredRuns
    }
  });
  res.json({ ok: true, settings });
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
  const settings = await readSettings();
  const groupSize = Number(body.groupSize || plan.maxParticipantsPerRoom || settings.defaultGroupSize || 2);

  if (!Array.isArray(participants) || participants.length === 0) {
    res.status(400).json({ error: "Missing participants" });
    return;
  }

  const runId = crypto.randomUUID();
  let result = null;
  let error = null;
  let promptText = "";

  try {
    promptText = buildPrompt({ plan, recap, mode, groupSize, settings });
    const responseText = await callGemini(promptText);
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
    error,
    strategyName: settings.strategyName,
    promptPreview: promptText.slice(0, 2400)
  };

  const runs = await readRuns();
  runs.unshift(payload);
  await writeRuns(runs.slice(0, settings.maxStoredRuns || DEFAULT_SETTINGS.maxStoredRuns));

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
      strategyName: settings.strategyName,
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
  res.type("html").send(renderConsoleHtml());
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
