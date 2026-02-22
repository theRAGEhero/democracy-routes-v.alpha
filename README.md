# Democracy Routes Platform

Unified platform workspace for:
- `dr-app` (renamed from legacy dr-app copy)
- `dr-video`

## Structure
- `services/dr-app` - main app
- `services/dr-video` - video/transcription service
- `infra/nginx` - reverse proxy for single-domain routing
- `scripts` - operational helpers
- `contracts` - API/event contracts
- `docs` - runbooks

## Single-domain integration
The proxy routes:
- `/` -> `dr-app`
- `/video/` -> `dr-video`

## Quick start
```bash
cp .env.example .env
docker compose up -d --build
```

Open:
- http://localhost:8088/
- http://localhost:8088/video/
