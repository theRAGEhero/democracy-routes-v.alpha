#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

docker run --rm \
  -v dr_app_data:/data \
  -v "$WORK_DIR":/backup \
  alpine sh -c "tar czf /backup/dr-app-data.tar.gz -C /data ."

if [ -n "${TRANSCRIPTION_DB_NAME:-}" ] && [ -n "${TRANSCRIPTION_DB_USER:-}" ]; then
  export PGPASSWORD="${TRANSCRIPTION_DB_PASSWORD:-}"
  docker exec transcription-db pg_dump -U "$TRANSCRIPTION_DB_USER" "$TRANSCRIPTION_DB_NAME" \
    | gzip > "$WORK_DIR/transcription-db.sql.gz"
  unset PGPASSWORD
fi

for volume in dr_video_recordings dr_video_logs; do
  docker run --rm \
    -v "$volume":/data \
    -v "$WORK_DIR":/backup \
    alpine sh -c "tar czf /backup/${volume}.tar.gz -C /data ."
done

for volume in audio_deepgram_data audio_deepgram_public_audio audio_vosk_data audio_vosk_public_audio; do
  docker run --rm \
    -v "$volume":/data \
    -v "$WORK_DIR":/backup \
    alpine sh -c "tar czf /backup/${volume}.tar.gz -C /data ." || true
done

ARCHIVE_PATH="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"
CHECKSUM_PATH="$ARCHIVE_PATH.sha256"

tar czf "$ARCHIVE_PATH" -C "$WORK_DIR" .
sha256sum "$ARCHIVE_PATH" > "$CHECKSUM_PATH"

echo "Backup created: $ARCHIVE_PATH"
