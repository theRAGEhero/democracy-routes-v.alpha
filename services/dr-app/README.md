# dr-app

Main Democracy Routes application.

## Responsibilities

- authentication and account management
- dashboard, dataspaces, meetings, templates, texts
- admin UI
- embedded integration shell for `dr-video`, `dr-thinker`, `dr-matching`, and audio admin tools
- template AI generation
- workflow APIs for internal services
- backup/admin controls

## Local setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

Default local URL:

- `http://localhost:3015`

## Important env vars

- `DATABASE_URL`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DEMOCRACYROUTES_CALL_BASE_URL`
- `DEEPGRAM_BASE_URL`
- `VOSK_BASE_URL`
- `TRANSCRIPTION_HUB_BASE_URL`
- `TRANSCRIPTION_HUB_API_KEY`
- `EVENT_HUB_BASE_URL`
- `EVENT_HUB_API_KEY`
- `WORKFLOW_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Main UI routes

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
- `/tutorial`
- `/admin`

## Main API groups

Auth and account:

- `/api/account/*`
- `/api/auth/*`
- `/api/register`

Admin:

- `/api/admin/analyses`
- `/api/admin/backups`
- `/api/admin/embed-auth`
- `/api/admin/feedback`
- `/api/admin/inbox`
- `/api/admin/registration/*`
- `/api/admin/site-settings`
- `/api/admin/transcriptions*`
- `/api/admin/users*`

Core product:

- `/api/dataspaces*`
- `/api/meetings*`
- `/api/flows*`
- `/api/plan-templates*`
- `/api/templates/ai`
- `/api/texts*`
- `/api/posters`
- `/api/uploads*`

Internal integration:

- `/api/integrations/workflow/*`
- `/api/telegram/webhook`
- `/api/logs`

## Current architecture notes

- `dr-app` is the system of record for users, meetings, templates/plans, dataspaces, and texts.
- Meeting transcript truth is moving to `transcription-hub`; `dr-app` fetches from it and also keeps convenience copies where needed.
- Centralized stack events are posted to `dr-event-hub`.
- User-facing language is progressively shifting toward `templates`, but internal APIs still contain `flows` and `plans`.
