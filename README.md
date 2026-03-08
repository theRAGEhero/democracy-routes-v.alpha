# Democracy Routes Platform

Unified multi-service workspace for the Democracy Routes stack.

## Services

- `services/dr-app`: main product surface, auth, dashboard, meetings, templates, dataspaces, admin
- `services/dr-video`: RTC/video call service with embed mode, access tokens, recording, live transcript forwarding
- `services/transcription-hub`: canonical transcript/session store in Postgres
- `services/dr-event-hub`: centralized event log store in SQLite
- `services/dr-thinker`: analysis service used by dr-app for AI recap/analysis flows
- `services/dr-matching`: AI-assisted rematching service for matching blocks
- `audio-api/deepgram`: Deepgram-based audio transcription/admin surface
- `audio-api/vosk`: Vosk-based audio transcription/admin surface
- `infra/nginx`: reverse proxy for single-domain routing
- `scripts/backup`: operational backup helpers

## Runtime routing

The public reverse proxy exposes:

- `/` -> `dr-app`
- `/video/` -> `dr-video`
- `/audio-admin/deepgram/` -> `audio-api/deepgram`
- `/audio-admin/vosk/` -> `audio-api/vosk`

The remaining services are intended to stay internal and be called server-to-server.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
```

Default local entrypoints:

- `http://localhost:8088/`
- `http://localhost:8088/video/`
- `http://localhost:8088/audio-admin/deepgram/`
- `http://localhost:8088/audio-admin/vosk/`

## Main environment variables

See [.env.example](/root/Democracy%20Routes/.env.example) for the full list. Important groups:

- App/auth: `APP_BASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Video access: `DR_VIDEO_ACCESS_SECRET`, `DR_VIDEO_REQUIRE_ACCESS`
- AI: `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLAMA_API_URL`, `OLLAMA_MODEL`
- Transcript storage: `TRANSCRIPTION_HUB_DATABASE_URL`, `TRANSCRIPTION_HUB_API_KEY`
- Event logging: `EVENT_HUB_API_KEY`
- Matching: `DR_MATCHING_API_KEY`

## dr-app route groups

Main UI pages:

- `/dashboard`
- `/dataspace`
- `/dataspace/[id]`
- `/meetings/new`
- `/meetings/[id]`
- `/flows`
- `/flows/new`
- `/flows/[id]`
- `/modular`
- `/templates/ai`
- `/texts/new`
- `/texts/[id]`
- `/admin`
- `/admin/analytics`
- `/admin/audio/deepgram`
- `/admin/audio/vosk`
- `/admin/matching`
- `/admin/thinking`
- `/admin/users`

## dr-app API route groups

Account/auth:

- `/api/account/change-password`
- `/api/account/email`
- `/api/account/profile`
- `/api/auth/[...nextauth]`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/register`

Admin:

- `/api/admin/analyses`
- `/api/admin/backups`
- `/api/admin/backups/[name]`
- `/api/admin/embed-auth`
- `/api/admin/feedback`
- `/api/admin/inbox`
- `/api/admin/registration/codes`
- `/api/admin/registration/settings`
- `/api/admin/site-settings`
- `/api/admin/transcriptions`
- `/api/admin/transcriptions/retry-failed`
- `/api/admin/users`
- `/api/admin/users/[id]`

Dataspaces:

- `/api/dataspaces`
- `/api/dataspaces/[id]`
- `/api/dataspaces/[id]/analysis`
- `/api/dataspaces/[id]/invite`
- `/api/dataspaces/[id]/join`
- `/api/dataspaces/[id]/leave`
- `/api/dataspaces/[id]/preferences`
- `/api/dataspaces/[id]/share`
- `/api/dataspaces/[id]/subscribe`
- `/api/dataspaces/[id]/telegram-link`
- `/api/dataspaces/[id]/unshare`
- `/api/dataspaces/[id]/unsubscribe`
- `/api/dataspaces/invitations`
- `/api/dataspaces/recent`

Meetings:

- `/api/meetings`
- `/api/meetings/[id]`
- `/api/meetings/[id]/deactivate`
- `/api/meetings/[id]/invite-guest`
- `/api/meetings/[id]/join`
- `/api/meetings/[id]/leave`
- `/api/meetings/[id]/live-transcript`
- `/api/meetings/[id]/members`
- `/api/meetings/[id]/transcription`
- `/api/meetings/[id]/users`

Templates and plans:

- `/api/plan-templates`
- `/api/plan-templates/[id]`
- `/api/templates/ai`
- `/api/flows`
- `/api/flows/[id]`
- `/api/flows/[id]/analysis`
- `/api/flows/[id]/current`
- `/api/flows/[id]/invite`
- `/api/flows/[id]/join`
- `/api/flows/[id]/leave`
- `/api/flows/[id]/meditation`
- `/api/flows/[id]/recap`
- `/api/flows/[id]/record`
- `/api/flows/[id]/skip`
- `/api/flows/[id]/start-now`

Workflow/integration:

- `/api/integrations/workflow/dataspaces`
- `/api/integrations/workflow/flows`
- `/api/integrations/workflow/meetings`
- `/api/integrations/workflow/users`

Other:

- `/api/feedback`
- `/api/invitations/[id]/accept`
- `/api/invitations/[id]/decline`
- `/api/logs`
- `/api/meditation/audio`
- `/api/meditation/audio/[file]`
- `/api/posters`
- `/api/telegram/webhook`
- `/api/texts`
- `/api/texts/[id]`
- `/api/uploads/[kind]`
- `/api/uploads/[kind]/[file]`
- `/api/users`

## Notes

- `dr-app` remains the main public product shell.
- `transcription-hub` is the canonical transcript store.
- `dr-event-hub` is best-effort centralized logging, not a full observability platform.
- The codebase still contains mixed historical terminology around `flows`, `plans`, and `templates`; user-facing work is progressively being normalized toward `templates`.
