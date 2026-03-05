#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/backup-YYYYmmddTHHMMSSZ.tar.gz"
  exit 1
fi

ARCHIVE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESTORE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$RESTORE_DIR"
}
trap cleanup EXIT

tar xzf "$ARCHIVE" -C "$RESTORE_DIR"

echo "Restore staged in: $RESTORE_DIR"
echo "Suggested steps:"
echo "1) Restore dr-app data volume:"
echo "   docker run --rm -v dr_app_data:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/dr-app-data.tar.gz -C /data'"
echo "2) Restore transcription-hub database:"
echo "   gunzip -c $RESTORE_DIR/transcription-db.sql.gz | docker exec -i transcription-db psql -U \$TRANSCRIPTION_DB_USER \$TRANSCRIPTION_DB_NAME"
echo "3) Restore dr-video recordings/logs:"
echo "   docker run --rm -v dr_video_recordings:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/dr_video_recordings.tar.gz -C /data'"
echo "   docker run --rm -v dr_video_logs:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/dr_video_logs.tar.gz -C /data'"
echo "4) Restore audio data volumes (optional):"
echo "   docker run --rm -v audio_deepgram_data:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/audio_deepgram_data.tar.gz -C /data'"
echo "   docker run --rm -v audio_deepgram_public_audio:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/audio_deepgram_public_audio.tar.gz -C /data'"
echo "   docker run --rm -v audio_vosk_data:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/audio_vosk_data.tar.gz -C /data'"
echo "   docker run --rm -v audio_vosk_public_audio:/data -v $RESTORE_DIR:/backup alpine sh -c 'rm -rf /data/* && tar xzf /backup/audio_vosk_public_audio.tar.gz -C /data'"
