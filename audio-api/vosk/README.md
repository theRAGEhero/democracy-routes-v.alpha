# audio-api/vosk

Vosk-backed audio transcription/admin service.

## Current role in the stack

- provider-specific transcription service
- audio streaming WebSocket endpoint
- admin surface mounted under `/audio-admin/vosk`
- event emission to `dr-event-hub`

## Runtime

This service is normally started from the root compose stack.

Key env vars:

- `PORT`
- `VOSK_PYTHON`
- `VOSK_MODEL_EN`
- `VOSK_MODEL_IT`
- `NEXT_PUBLIC_BASE_PATH=/audio-admin/vosk`
- `EVENT_HUB_BASE_URL`
- `EVENT_HUB_API_KEY`

## Important note

Like the Deepgram service, this app remains operational but reflects an older provider-specific layer. The main product shell is `dr-app`, while transcript persistence and retrieval are increasingly centered on `transcription-hub`.
