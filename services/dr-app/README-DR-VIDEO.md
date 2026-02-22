# DR-video Integration README

This document collects the current DR-video setup, behavior, APIs, and operations used with dr-app.

## 1) What DR-video is

`DR-video` is a standalone SFU video service (mediasoup + WebSocket) running on the same machine as dr-app.

- Source folder: `/root/DR-video`
- Main app URL (prod): `https://video.democracyroutes.com`
- Local port: `3020`
- Admin page: `/admin`

It is currently used as a testable standalone video platform before replacing embedded dr-app SFU in dr-app.

## 2) Current architecture

- dr-app app (this repo): `/root/dr-app`
- DR-video app: `/root/DR-video`
- dr-app SFU: still separate and not removed
- Reverse proxy routes domain traffic to services

Important:
- DR-video and dr-app SFU can run at the same time.
- They do not conflict if they use different domains/ports.

## 3) Main DR-video features implemented

- Multi-room SFU calls
- Lobby/join flow with room + name + device pre-selection
- URL-driven room/name/autojoin behavior
- Bottom bar call controls (mic/cam/record/view/leave) with icons
- Device switching for mic/cam during call
- Recording modes:
  - audio-only
  - video+audio
- Smart single-recorder ownership per room
- Recorder owner handover if owner disconnects
- Live transcription via Deepgram (direct from DR-video, no bridge)
- Transcription box in UI with scrolling list
- Transcript persistence to JSON (`raw`, `deliberation`, legacy)
- Admin page with:
  - active rooms
  - ingest status
  - recordings list + delete
  - transcript viewer
  - merged-from sessions panel

## 4) Recording and transcription behavior

### Recording ownership

- Only one recorder can be active in a room at a time.
- Different rooms can record simultaneously.
- If current recorder leaves, ownership moves to another peer when possible.

### Smart merge behavior

- A room recording run can include multiple recorder sessions (handover/reload cases).
- Server merges media/transcript artifacts into one run output.
- Admin shows merged session sources.

### Single Deepgram call strategy (implemented)

- Deepgram transcription session is tied to the room recording run.
- Owner handover does **not** restart the Deepgram websocket.
- Finalize from a single client does not stop room transcription if recording is still active.
- Result: one continuous live Deepgram session per room run.

## 5) URL routes and query parameters

## Routes

- `/` -> join lobby
- `/meet/:roomId` -> room page
- `/admin` -> admin dashboard

## Query parameters (join/embed)

- `name` or `user`: participant display name
- `room`: room id (when not using `/meet/:roomId`)
- `autojoin=1|true|yes`: auto join
- `autorecordaudio=1|true|yes|on`: auto record audio-only
- `autorecordvideo=1|true|yes|on`: auto record video+audio
- `autorecord` / `autoRecord`: legacy auto-record flag
- `recordmode=audio|av`: preferred mode
- `transcriptionLanguage=<code>` (or `transcriptionLang`): enable live transcription in that language
- `embed=1|true|yes`: embed mode
- `hideDock=1|true|yes`: hide bottom dock in embed mode

Notes:
- If URL already provides room/name/transcription/autorecord params, matching lobby controls are hidden.
- If name is missing and `autojoin` is used, join is blocked until name is present.

## 6) Embed integration

DR-video supports iframe embedding and host-page commands via `postMessage`.

### Commands accepted (`message.type = "dr-video-command"`)

- `join` with data `{ roomId, name, autoRecordMode }`
- `leave`
- `toggleMic`
- `toggleCam`
- `startRecording` with optional `{ mode: "audio" | "av" }`
- `stopRecording`
- `setView` with `{ mode: "auto" | "grid" | "speaker" }`

### Events emitted from iframe (`source = "dr-video"`)

- `ready`
- `connected`
- `left`
- `participants`
- `recording-state`
- `join-required`
- `join-error`
- `command-error`

## 7) Server APIs (most used)

### Utility

- `GET /api/health`
- `GET /api/join-url?roomId=...&name=...&autojoin=1`

### Recording / transcription ingest

- `POST /api/record/chunk`
- `POST /api/record/finalize`
- `POST /api/transcription/chunk`
- `POST /api/transcription/finalize`

### Admin/data

- `GET /api/admin/status`
- `GET /api/recordings`
- `GET /api/recordings/file?roomId=...&sessionId=...`
- `GET /api/recordings/transcript?roomId=...&sessionId=...&format=deliberation|raw|legacy`
- `DELETE /api/recordings`

### External control

- `POST /api/recording/start` with `{ roomId, peerId, mode }`

## 8) Env configuration (`/root/DR-video/.env`)

Key variables:

- `PORT`, `HOST`, `PUBLIC_BASE_URL`
- `ANNOUNCED_IP`, `RTC_MIN_PORT`, `RTC_MAX_PORT`
- `RECORDINGS_DIR`
- `AUTO_RECORD_ON_JOIN`
- logging (`LOG_DIR`, `LOG_FILE`, `LOG_LEVEL`, ...)
- Deepgram:
  - `DEEPGRAM_API_KEY`
  - `DEEPGRAM_MODEL`
  - `DEEPGRAM_INTERIM_RESULTS`
  - `DEEPGRAM_PUNCTUATE`
  - `DEEPGRAM_SMART_FORMAT`
  - `DEEPGRAM_DIARIZE`
  - `DEEPGRAM_UTTERANCES`
  - `DEEPGRAM_KEEPALIVE_MS`

## 9) Run / restart commands

From server shell:

```bash
cd /root/DR-video
npm install
cp .env.example .env
# edit .env
node server.js
```

Background restart:

```bash
for p in $(pgrep -f "node server.js"); do
  cwd=$(readlink -f /proc/$p/cwd 2>/dev/null || true)
  if [ "$cwd" = "/root/DR-video" ]; then kill $p; fi
done
sleep 1
cd /root/DR-video && setsid node server.js >> run.log 2>&1 < /dev/null &
curl -sS http://127.0.0.1:3020/api/health && echo
```

## 10) Troubleshooting quick checks

1. Service up:
```bash
curl -sS http://127.0.0.1:3020/api/health
```

2. Live status:
```bash
curl -sS http://127.0.0.1:3020/api/admin/status
```

3. Recordings list:
```bash
curl -sS http://127.0.0.1:3020/api/recordings
```

4. Logs:
```bash
tail -f /root/DR-video/run.log
tail -f /root/DR-video/logs/dr-video.log
```

## 11) File locations

- DR-video code: `/root/DR-video`
- Recordings: `/root/DR-video/recordings`
- Admin UI:
  - `/root/DR-video/public/admin.html`
  - `/root/DR-video/public/admin.js`
- Main client UI:
  - `/root/DR-video/public/index.html`
  - `/root/DR-video/public/app.js`
- Server:
  - `/root/DR-video/server.js`

