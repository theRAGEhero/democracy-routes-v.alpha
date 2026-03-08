# dr-video

RTC/video service for Democracy Routes.

## Responsibilities

- room join and signaling
- mediasoup SFU transport
- local webcam/mic publishing and remote consumption
- embed mode for dr-app
- access-token validation for protected joins
- optional auto-record on join
- Deepgram live transcription forwarding
- finalize transcript/recording payloads to `transcription-hub`
- operational event posting to `dr-event-hub`

## Runtime

This service is usually started through the root `docker-compose.yml`.

Direct local run:

```bash
npm install
node server.js
```

Default local URL:

- `http://localhost:3020`

## Important env vars

- `PORT`
- `HOST`
- `ANNOUNCED_IP`
- `RTC_MIN_PORT`
- `RTC_MAX_PORT`
- `DEEPGRAM_API_KEY`
- `TRANSCRIPTION_HUB_URL`
- `TRANSCRIPTION_HUB_API_KEY`
- `EVENT_HUB_BASE_URL`
- `EVENT_HUB_API_KEY`
- `DR_VIDEO_ACCESS_SECRET`
- `DR_VIDEO_REQUIRE_ACCESS`

## Notes

- This is not just a standalone demo client anymore; it is part of the production stack.
- `dr-app` builds signed access tokens for embedded joins.
- Transcript persistence should be treated as hub-first, with `transcription-hub` as the canonical destination.
- Recordings and retry payloads are still written locally under the service volume.
