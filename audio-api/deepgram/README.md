# audio-api/deepgram

Deepgram-backed audio transcription/admin service.

## Current role in the stack

- provider-specific transcription service
- audio streaming WebSocket endpoint
- admin surface mounted under `/audio-admin/deepgram`
- event emission to `dr-event-hub`

## Runtime

This service is normally started from the root compose stack.

Key env vars:

- `PORT`
- `DEEPGRAM_API_KEY`
- `NEXT_PUBLIC_BASE_PATH=/audio-admin/deepgram`
- `EVENT_HUB_BASE_URL`
- `EVENT_HUB_API_KEY`

## Important note

This service is still part of the current stack, but it reflects an older provider-specific architecture. The long-term platform direction is more centralized around `dr-app` plus `transcription-hub`, with provider services increasingly treated as internal edges rather than primary product surfaces.
