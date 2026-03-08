import express from "express";

const app = express();
const PORT = Number(process.env.DR_REMOTE_WORKER_PORT || 3012);
const HOST = process.env.HOST || "0.0.0.0";
const basePath = String(process.env.NEXT_PUBLIC_BASE_PATH || "/remote-worker-app").replace(/\/$/, "");

function stripBasePath(pathname) {
  if (!basePath) return pathname || "/";
  if (!pathname) return "/";
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname;
}

function renderHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DR Remote Worker</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f1e8;
      --card: rgba(255,255,255,0.82);
      --stroke: rgba(148,163,184,0.26);
      --text: #0f172a;
      --muted: #475569;
      --accent: #0f766e;
      --accent-soft: rgba(15,118,110,0.12);
      --error: #b91c1c;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background:
      radial-gradient(circle at top left, rgba(245,158,11,0.12), transparent 32%),
      radial-gradient(circle at top right, rgba(20,184,166,0.12), transparent 38%),
      linear-gradient(180deg, #f8f4eb 0%, var(--bg) 100%);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      height: 100%;
      overflow: hidden;
    }
    body { padding: 12px; }
    .shell { height: calc(100dvh - 24px); max-width: 1180px; margin: 0 auto; display: grid; gap: 12px; grid-template-rows: auto minmax(0,1fr); }
    .hero, .card {
      border: 1px solid var(--stroke);
      background: var(--card);
      backdrop-filter: blur(14px);
      border-radius: 26px;
      box-shadow: 0 20px 50px rgba(15,23,42,0.08);
    }
    .hero { padding: 16px 18px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .24em; color: #64748b; font-weight: 700; }
    h1 { margin: 6px 0 4px; font-size: 28px; line-height: 1.05; font-family: Georgia, "Times New Roman", serif; }
    .sub { color: var(--muted); max-width: 760px; font-size: 13px; }
    .grid { min-height: 0; display: grid; gap: 12px; grid-template-columns: 1fr; }
    .card { padding: 16px; min-height: 0; display: flex; flex-direction: column; }
    .card h2 { margin: 0; font-size: 16px; }
    .muted { color: var(--muted); font-size: 13px; }
    .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--accent-soft); color: var(--accent); }
    .pill.idle { background: rgba(148,163,184,0.14); color: #475569; }
    .pill.error { background: rgba(239,68,68,0.12); color: var(--error); }
    .stats { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 14px; }
    .stat { border: 1px solid rgba(148,163,184,0.22); border-radius: 18px; padding: 12px; background: rgba(255,255,255,0.72); min-width: 0; }
    .stat .label { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .stat .value { font-size: 24px; font-weight: 700; margin-top: 8px; }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    button {
      appearance: none; border: 0; border-radius: 999px; padding: 11px 16px;
      font-size: 13px; font-weight: 700; cursor: pointer;
    }
    button.primary { background: linear-gradient(135deg, #0f766e, #0d9488); color: white; }
    button.secondary { background: white; color: #0f172a; border: 1px solid rgba(148,163,184,0.26); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .log {
      margin-top: 14px; min-height: 0; flex: 1; overflow: auto;
      border-radius: 18px; border: 1px solid rgba(148,163,184,0.22);
      background: rgba(15,23,42,0.94); color: #e2e8f0; padding: 14px;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    @media (max-width: 900px) {
      body { padding: 10px; }
      .shell { height: calc(100dvh - 20px); gap: 10px; }
      .hero { padding: 14px; }
      h1 { font-size: 24px; }
      .grid { grid-template-columns: 1fr; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        <div class="eyebrow">Democracy Routes</div>
        <h1>Remote Worker</h1>
        <div class="sub">
          Use this page to run post-call transcription jobs in the browser. For Auto Remote jobs, the chosen participant must keep this page open until processing finishes.
        </div>
      </div>
      <div id="status-pill" class="pill idle">Idle</div>
    </section>

    <section class="grid">
      <div class="card">
        <h2>Worker console</h2>
        <p class="muted">Keep this page open when you want the browser to act as a volunteer worker.</p>
        <div class="stats">
          <div class="stat"><div class="label">Worker user</div><div id="worker-user" class="value">-</div></div>
          <div class="stat"><div class="label">WebGPU</div><div id="worker-webgpu" class="value">-</div></div>
          <div class="stat"><div class="label">CPU cores</div><div id="worker-cores" class="value">-</div></div>
          <div class="stat"><div class="label">Device memory</div><div id="worker-memory" class="value">-</div></div>
        </div>
        <div class="controls">
          <button id="start-btn" class="primary">Start worker</button>
          <button id="stop-btn" class="secondary" disabled>Stop worker</button>
        </div>
        <div id="log" class="log"></div>
      </div>
    </section>
  </div>

  <script type="module">
    const query = new URLSearchParams(window.location.search);
    const token = query.get("token") || "";
    const logEl = document.getElementById("log");
    const statusPill = document.getElementById("status-pill");
    const startBtn = document.getElementById("start-btn");
    const stopBtn = document.getElementById("stop-btn");
    const workerUser = document.getElementById("worker-user");
    const workerWebgpu = document.getElementById("worker-webgpu");
    const workerCores = document.getElementById("worker-cores");
    const workerMemory = document.getElementById("worker-memory");

    let heartbeatTimer = null;
    let claimTimer = null;
    let running = false;
    let workerId = null;
    let processingJob = false;
    let transcriber = null;
    let transcriberLoading = null;
    let currentJobId = null;
    let currentJobProvider = null;

    function log(line) {
      const ts = new Date().toLocaleTimeString();
      logEl.textContent += "[" + ts + "] " + line + "\\n";
      logEl.scrollTop = logEl.scrollHeight;
    }

    function getJobMeta(job) {
      try {
        return job && job.payloadJson ? JSON.parse(job.payloadJson) : {};
      } catch {
        return {};
      }
    }

    window.addEventListener("beforeunload", function (event) {
      if (!processingJob) return;
      event.preventDefault();
      event.returnValue = "A remote transcription is still running. Leaving now may interrupt the job.";
      return event.returnValue;
    });

    function setStatus(label, cls) {
      statusPill.textContent = label;
      statusPill.className = "pill " + (cls || "idle");
    }

    async function api(path, method = "GET", body = null) {
      const options = {
        method,
        headers: {
          "Authorization": "Bearer " + token
        }
      };
      if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
      const response = await fetch(path, options);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload && payload.error) || "Request failed");
      }
      return payload;
    }

    async function fetchAudioBuffer(audioUrl) {
      const response = await fetch(audioUrl, {
        headers: {
          "Authorization": "Bearer " + token
        }
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Unable to download job audio");
      }
      return response.arrayBuffer();
    }

    async function loadTranscriber() {
      if (transcriber) return transcriber;
      if (transcriberLoading) return transcriberLoading;

      transcriberLoading = (async () => {
        log("Loading browser transcription runtime...");
        const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        const instance = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-tiny.en",
          {
            dtype: "fp32",
            progress_callback: (item) => {
              if (item?.status === "progress" && typeof item.progress === "number") {
                log("Model download " + Math.round(item.progress) + "%");
              }
            }
          }
        );
        log("Browser transcriber ready: whisper-tiny.en");
        transcriber = instance;
        return instance;
      })().catch((error) => {
        transcriberLoading = null;
        throw error;
      });

      return transcriberLoading;
    }

    async function decodeAudioToMono(arrayBuffer) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext is not supported in this browser");
      }
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const { numberOfChannels, length } = audioBuffer;
        const mono = new Float32Array(length);
        for (let channel = 0; channel < numberOfChannels; channel += 1) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < length; i += 1) {
            mono[i] += channelData[i] / numberOfChannels;
          }
        }
        return mono;
      } finally {
        try {
          await audioContext.close();
        } catch {}
      }
    }

    async function uploadCheckpoint(job, chunkIndex, chunkStartSec, chunkEndSec, transcriptText, transcriptSegments) {
      await api("/api/remote-workers/jobs/" + job.id + "/checkpoint", "POST", {
        workerId,
        chunkIndex,
        chunkStartSec,
        chunkEndSec,
        transcriptText,
        transcriptSegments
      });
    }

    async function processMeetingRecordingJob(job) {
      if (!job.audioUrl) {
        throw new Error("Meeting recording job has no audio URL");
      }
      const startedAt = performance.now();
      currentJobId = job.id;
      currentJobProvider = job.provider || null;
      processingJob = true;
      setStatus("Processing", "");
      const meta = getJobMeta(job);
      const isAutoRemote = (job.provider === "AUTOREMOTE") || meta.transcriptionProvider === "AUTOREMOTE";
      if (isAutoRemote) {
        log("Auto Remote job selected. Keep this page open until the transcription completes.");
      }
      log("Downloading audio for " + job.id + "...");
      const arrayBuffer = await fetchAudioBuffer(job.audioUrl);
      log("Decoding audio (" + Math.round(arrayBuffer.byteLength / 1024) + " KB)...");
      const audio = await decodeAudioToMono(arrayBuffer);
      const asr = await loadTranscriber();
      const sampleRate = 16000;
      const chunkSeconds = 60;
      const chunkSamples = sampleRate * chunkSeconds;
      const checkpoints = Array.isArray(meta.checkpoints) ? meta.checkpoints : [];
      const resumeFrom = Number.isFinite(Number(meta.resumeFromChunkIndex)) ? Math.max(0, Number(meta.resumeFromChunkIndex)) : 0;
      const transcriptParts = checkpoints
        .sort((a, b) => Number(a?.chunkIndex || 0) - Number(b?.chunkIndex || 0))
        .map((entry) => typeof entry?.transcriptText === "string" ? entry.transcriptText : "")
        .filter(Boolean);
      const mergedSegments = checkpoints.flatMap((entry) => Array.isArray(entry?.transcriptSegments) ? entry.transcriptSegments : []);

      for (let offset = resumeFrom * chunkSamples, chunkIndex = resumeFrom; offset < audio.length; offset += chunkSamples, chunkIndex += 1) {
        const chunk = audio.slice(offset, Math.min(audio.length, offset + chunkSamples));
        const chunkStartSec = offset / sampleRate;
        const chunkEndSec = (offset + chunk.length) / sampleRate;
        log("Transcribing chunk " + (chunkIndex + 1) + " (" + Math.round(chunkStartSec) + "s-" + Math.round(chunkEndSec) + "s)...");
        const output = await asr(chunk, {
          chunk_length_s: 20,
          stride_length_s: 5,
          return_timestamps: true,
          task: "transcribe",
          language: "english"
        });
        const chunkText = output && typeof output.text === "string" ? output.text.trim() : "";
        if (!chunkText) {
          throw new Error("No transcript text returned by the browser model");
        }
        transcriptParts.push(chunkText);
        const chunkSegments = Array.isArray(output?.chunks)
          ? output.chunks.map((entry) => {
              const ts = Array.isArray(entry?.timestamp) ? entry.timestamp : [];
              return {
                text: entry?.text || "",
                timestamp: [
                  typeof ts[0] === "number" ? ts[0] + chunkStartSec : chunkStartSec,
                  typeof ts[1] === "number" ? ts[1] + chunkStartSec : chunkEndSec
                ]
              };
            })
          : [];
        mergedSegments.push(...chunkSegments);
        await uploadCheckpoint(job, chunkIndex, chunkStartSec, chunkEndSec, chunkText, chunkSegments);
        log("Checkpoint saved for chunk " + (chunkIndex + 1));
      }

      const transcriptText = transcriptParts.join(" ").trim();
      if (!transcriptText) {
        throw new Error("No transcript text returned by the browser model");
      }
      await api("/api/remote-workers/jobs/" + job.id + "/complete", "POST", {
        workerId,
        transcriptText,
        transcriptJson: {
          text: transcriptText,
          chunks: mergedSegments
        },
        confidence: null,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt))
      });
      log("Completed meeting recording job " + job.id);
    }

    async function failJob(jobId, message) {
      try {
        await api("/api/remote-workers/jobs/" + jobId + "/fail", "POST", {
          workerId,
          error: message
        });
        log("Marked job failed: " + jobId);
      } catch (error) {
        log("Fail endpoint error for " + jobId + ": " + error.message);
      }
    }

    async function bootstrap() {
      if (!token) {
        setStatus("Missing token", "error");
        log("No worker token was provided.");
        startBtn.disabled = true;
        return;
      }
      const hasWebGpu = !!navigator.gpu;
      workerWebgpu.textContent = hasWebGpu ? "Available" : "Unavailable";
      workerCores.textContent = String(navigator.hardwareConcurrency || "-");
      workerMemory.textContent = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "-";

      try {
        const payload = await api("/api/remote-workers/bootstrap");
        workerUser.textContent = payload.user && payload.user.email ? payload.user.email : "-";
        setStatus("Ready", "");
        log("Worker authenticated.");
        log("Capability snapshot: webgpu=" + hasWebGpu + ", cores=" + (navigator.hardwareConcurrency || "-") + ", memory=" + (navigator.deviceMemory || "-"));
      } catch (error) {
        setStatus("Unauthorized", "error");
        log("Bootstrap failed: " + error.message);
        startBtn.disabled = true;
      }
    }

    async function heartbeat() {
      if (!workerId) return;
      try {
        const payload = await api("/api/remote-workers/heartbeat", "POST", {
          workerId,
          browser: navigator.userAgent,
          webgpu: !!navigator.gpu,
          cores: navigator.hardwareConcurrency || null,
          memoryGb: navigator.deviceMemory || null,
          visibility: document.visibilityState
        });
        log("Heartbeat ok at " + payload.now);
      } catch (error) {
        log("Heartbeat failed: " + error.message);
      }
    }

    async function claim() {
      if (!workerId || processingJob) return;
      try {
        const payload = await api("/api/remote-workers/claim", "POST", { workerId });
        if (payload.job) {
          log("Claimed job " + payload.job.id + " (" + payload.job.sourceType + ")");
          if (payload.job.sourceType === "MEETING_RECORDING" && payload.job.audioUrl) {
            log("Audio ready at " + payload.job.audioUrl);
          }
          if (payload.job.sourceType === "DEMO") {
            window.setTimeout(async () => {
              try {
                await api("/api/remote-workers/jobs/" + payload.job.id + "/complete", "POST", {
                  workerId,
                  transcriptText: "Demo completion from browser worker.",
                  transcriptJson: {
                    sourceType: payload.job.sourceType,
                    sourceId: payload.job.sourceId || null,
                    note: "Placeholder result until real STT is wired."
                  },
                  confidence: 1,
                  durationMs: 1200
                });
                log("Completed demo job " + payload.job.id);
              } catch (error) {
                log("Complete failed: " + error.message);
              }
            }, 1200);
          } else if (payload.job.sourceType === "MEETING_RECORDING") {
            try {
              await processMeetingRecordingJob(payload.job);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Meeting recording job failed";
              log("Processing failed: " + message);
              await failJob(payload.job.id, message);
            } finally {
              processingJob = false;
              currentJobId = null;
              currentJobProvider = null;
              if (running) {
                setStatus("Running", "");
              } else {
                setStatus("Ready", "");
              }
            }
          }
        } else {
          log(payload.message || "No jobs available.");
        }
      } catch (error) {
        log("Claim failed: " + error.message);
      }
    }

    async function registerWorker() {
      const payload = await api("/api/remote-workers/register", "POST", {
        label: "Browser worker",
        browserInfo: navigator.userAgent,
        capabilities: {
          webgpu: !!navigator.gpu,
          cores: navigator.hardwareConcurrency || null,
          memoryGb: navigator.deviceMemory || null
        }
      });
      workerId = payload && payload.worker && payload.worker.id ? payload.worker.id : null;
      if (!workerId) {
        throw new Error("Worker registration did not return an id");
      }
      log("Registered worker " + workerId);
    }

    async function startWorker() {
      if (running) return;
      startBtn.disabled = true;
      try {
        await registerWorker();
        running = true;
        setStatus("Running", "");
        stopBtn.disabled = false;
        log("Worker loop started.");
        heartbeat();
        claim();
        heartbeatTimer = window.setInterval(heartbeat, 30000);
        claimTimer = window.setInterval(claim, 12000);
      } catch (error) {
        setStatus("Error", "error");
        startBtn.disabled = false;
        log("Worker start failed: " + error.message);
      }
    }

    function stopWorker() {
      running = false;
      workerId = null;
      currentJobId = null;
      processingJob = false;
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (claimTimer) window.clearInterval(claimTimer);
      heartbeatTimer = null;
      claimTimer = null;
      setStatus("Ready", "");
      startBtn.disabled = false;
      stopBtn.disabled = true;
      log("Worker loop stopped.");
    }

    startBtn.addEventListener("click", startWorker);
    stopBtn.addEventListener("click", stopWorker);
    bootstrap();
  </script>
</body>
</html>`;
}

app.get(`${basePath}/api/health`, (_req, res) => {
  res.json({ ok: true, service: "dr-remote-worker" });
});

app.use((req, res, next) => {
  const strippedPath = stripBasePath(req.path);
  if (strippedPath !== req.path) {
    req.url = strippedPath + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
  }
  next();
});

app.get("/", (_req, res) => {
  res.status(200).type("html").send(renderHtml());
});

app.get("*", (_req, res) => {
  res.redirect(basePath || "/");
});

app.listen(PORT, HOST, () => {
  console.log(`dr-remote-worker listening on http://${HOST}:${PORT}${basePath || ""}`);
});
