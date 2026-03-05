# Democracy Routes Platform

Unified platform workspace for:
- `dr-app` (renamed from legacy dr-app copy)
- `dr-video`
- `audio-api/deepgram` (from deepgram-modular)
- `audio-api/vosk` (from vosk-modular)

## Structure
- `services/dr-app` - main app
- `services/dr-video` - video/transcription service
- `audio-api/deepgram` - Deepgram transcription app/API
- `audio-api/vosk` - Vosk transcription app/API
- `infra/nginx` - reverse proxy for single-domain routing
- `scripts` - operational helpers
- `contracts` - API/event contracts
- `docs` - runbooks

## Single-domain integration
The proxy routes:
- `/` -> `dr-app`
- `/video/` -> `dr-video`
- `/audio-api/deepgram/api/*` -> `audio-deepgram` API
- `/audio-api/vosk/api/*` -> `audio-vosk` API

## Quick start
```bash
cp .env.example .env
docker compose up -d --build
```

Open:
- http://localhost:8088/
- http://localhost:8088/video/
- http://localhost:8088/audio-api/deepgram/api/rounds
- http://localhost:8088/audio-api/vosk/api/rounds

## dr-app API routes
```
/api/account/change-password
/api/account/email
/api/account/profile
/api/admin/feedback
/api/admin/inbox
/api/admin/registration/codes
/api/admin/registration/codes/[id]
/api/admin/registration/settings
/api/admin/transcriptions
/api/admin/transcriptions/[id]/retry
/api/admin/transcriptions/retry-failed
/api/admin/users
/api/admin/users/[id]
/api/admin/users/[id]/resend
/api/admin/users/[id]/reset-password
/api/auth/[...nextauth]
/api/auth/forgot-password
/api/auth/reset-password
/api/dataspaces
/api/dataspaces/[id]
/api/dataspaces/[id]/analysis
/api/dataspaces/[id]/invite
/api/dataspaces/[id]/join
/api/dataspaces/[id]/leave
/api/dataspaces/[id]/share
/api/dataspaces/[id]/subscribe
/api/dataspaces/[id]/unshare
/api/dataspaces/[id]/unsubscribe
/api/dataspaces/invitations
/api/dataspaces/invitations/[id]/accept
/api/dataspaces/recent
/api/feedback
/api/flows
/api/flows/[id]
/api/flows/[id]/analysis
/api/flows/[id]/blocks/[blockId]/text
/api/flows/[id]/current
/api/flows/[id]/forms/[blockId]/response
/api/flows/[id]/invite
/api/flows/[id]/join
/api/flows/[id]/leave
/api/flows/[id]/meditation
/api/flows/[id]/meditation/transcribe
/api/flows/[id]/participants/[participantId]/approve
/api/flows/[id]/participants/[participantId]/decline
/api/flows/[id]/recap
/api/flows/[id]/record
/api/flows/[id]/record/transcribe
/api/flows/[id]/skip
/api/flows/[id]/start-now
/api/integrations/analyze/flows/[id]/analysis
/api/integrations/workflow/dataspaces
/api/integrations/workflow/flows
/api/integrations/workflow/flows/[id]
/api/integrations/workflow/flows/[id]/recap
/api/integrations/workflow/meditation/audio
/api/integrations/workflow/meetings
/api/integrations/workflow/meetings/[id]
/api/integrations/workflow/meetings/[id]/transcription/contributions
/api/integrations/workflow/meetings/[id]/transcription/meta
/api/integrations/workflow/meetings/[id]/transcription/participants
/api/integrations/workflow/meetings/[id]/transcription/words
/api/integrations/workflow/users
/api/invitations/[id]/accept
/api/invitations/[id]/decline
/api/logs
/api/meditation/audio
/api/meditation/audio/[file]
/api/meetings
/api/meetings/[id]
/api/meetings/[id]/deactivate
/api/meetings/[id]/invite-guest
/api/meetings/[id]/join
/api/meetings/[id]/leave
/api/meetings/[id]/live-transcript
/api/meetings/[id]/members
/api/meetings/[id]/requests/[inviteId]/approve
/api/meetings/[id]/requests/[inviteId]/decline
/api/meetings/[id]/transcription
/api/meetings/[id]/transcription/link
/api/meetings/[id]/users
/api/plan-templates
/api/plan-templates/[id]
/api/posters
/api/register
/api/telegram/webhook
/api/texts
/api/texts/[id]
/api/uploads/[kind]
/api/uploads/[kind]/[file]
/api/users
```
