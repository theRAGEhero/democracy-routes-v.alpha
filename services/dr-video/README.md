# DR-video (standalone)

Minimal standalone SFU MVP for local testing before replacing dr-app SFU.

## What this includes

- Node.js SFU signaling server (`mediasoup` + WebSocket)
- Basic browser client (join room, webcam/mic, consume remote streams)
- Near-real-time recording upload (2s `MediaRecorder` chunks to server)
- Recording files written to `recordings/<roomId>/<sessionId>.webm`

## What this is not (yet)

- Production hardening (auth, TURN, TLS termination, clustering)
- Advanced moderation/UI
- Server-side compositor recording

## Run

1. Install dependencies:

```bash
cd /root/DR-video
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start:

```bash
npm run dev
```

4. Open in browser:

```text
http://localhost:3020
```

5. Open a second tab/browser and join same room.

## Recording behavior

- Client starts recording automatically after join if `AUTO_RECORD_ON_JOIN=true` or checkbox enabled.
- Chunks are appended server-side in near-real-time.
- Metadata is written to `.jsonl` alongside the media file.

## Next recommended steps

1. Add JWT auth from dr-app to this service.
2. Add TURN + HTTPS for non-local networks.
3. Add room policy: auto-record only when host/presenter joins.
4. Add server-side ffmpeg post-processing pipeline.
