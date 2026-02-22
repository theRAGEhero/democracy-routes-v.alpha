# Democracy Routes

Minimal full-stack app to manage access and links for Democracy Routes call rooms (link + optional embed).

## Local setup

```bash
npm install
cp .env.example .env
# edit .env and set DEMOCRACYROUTES_CALL_BASE_URL + NEXTAUTH_SECRET + DEEPGRAM_BASE_URL
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3015

### Admin seed

- Email: `admin@example.com`
- Password: `admin1234`

## SMTP (optional)

Email is sent via SMTP using `.env` values. If SMTP is not configured, the app will skip sending email and show a warning, but it will not crash.

## Main routes

- `/login`
- `/register`
- `/dashboard`
- `/dataspace`
- `/meetings/new`
- `/meetings/[id]`
- `/admin/users` (ADMIN only)
- `/account/change-password`

## Notes

- The “Join call” button opens a new tab with `${DEMOCRACYROUTES_CALL_BASE_URL}/meet/{roomId}?name={email}&autojoin=1`.
- The meeting page can embed the call in an iframe using the same URL.
- Transcription is fetched from `DEEPGRAM_BASE_URL` or `VOSK_BASE_URL` based on the meeting setting, and shown under the embed. If the meeting is not linked, it auto-detects by matching the meeting `roomId` in the round name.
- Invites require the user to already exist; no auto-signup in this version.
- Plan analysis calls analyze-tables-modular using `ANALYZE_TABLES_API_URL` and `ANALYZE_TABLES_API_KEY`.

## Workflow API (service-to-service)

These endpoints use `x-api-key: <WORKFLOW_API_KEY>` and are read-only:

- `GET /api/integrations/workflow/meetings`
- `GET /api/integrations/workflow/meetings/{id}`
- `GET /api/integrations/workflow/meetings/{id}/transcription/meta`
- `GET /api/integrations/workflow/meetings/{id}/transcription/participants`
- `GET /api/integrations/workflow/meetings/{id}/transcription/contributions`
- `GET /api/integrations/workflow/meetings/{id}/transcription/words` (optional)
- `GET /api/integrations/workflow/plans`
- `GET /api/integrations/workflow/plans/{id}`
- `GET /api/integrations/workflow/plans/{id}/recap`
