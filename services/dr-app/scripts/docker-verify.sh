#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/docker-verify-$(date +%Y%m%d-%H%M%S).log"

CONTAINER_NAME="${CONTAINER_NAME:-democracyroutes-democracyroutes-1}"

PASS_COUNT=0
FAIL_COUNT=0

log() {
  printf '%s\n' "$1" | tee -a "${LOG_FILE}"
}

run_check() {
  local label="$1"
  shift
  log ""
  log "== ${label} =="
  if "$@" >>"${LOG_FILE}" 2>&1; then
    log "PASS: ${label}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log "FAIL: ${label}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

log "Docker verify started at $(date)"
log "Log: ${LOG_FILE}"

run_check "Docker available" docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

run_check "Container running" bash -lc "docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null | grep -q true"

run_check "Container logs (last 200 lines)" docker logs --tail=200 "${CONTAINER_NAME}"

run_check "Database file present" bash -lc "docker exec -i ${CONTAINER_NAME} sh -lc 'test -f /data/dev.db'"

run_check "Public meditation assets" bash -lc "docker exec -i ${CONTAINER_NAME} sh -lc 'ls -1 /app/public/meditation/*.html >/dev/null 2>&1'"

run_check "Node can query Prisma (users)" bash -lc "cat <<'EOF' | docker exec -i ${CONTAINER_NAME} node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.count();
  console.log({ users });
  await prisma.\$disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
EOF"

run_check "Node can query Prisma (dataspaces)" bash -lc "cat <<'EOF' | docker exec -i ${CONTAINER_NAME} node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const dataspaces = await prisma.dataspace.count();
  console.log({ dataspaces });
  await prisma.\$disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
EOF"

run_check "Auth endpoint reachable" bash -lc "curl -fsS http://localhost:3015/api/auth/session >/dev/null"

run_check "Login page reachable" bash -lc "curl -fsS http://localhost:3015/login >/dev/null"

run_check "Live bridge health (if set)" bash -lc "LB=\$(docker exec -i ${CONTAINER_NAME} printenv LIVE_BRIDGE_BASE_URL 2>/dev/null | tr -d '\r'); if [ -z \"\$LB\" ]; then exit 0; fi; HEALTH=\${LB%/recSyncBridge}; curl -fsS \"\${HEALTH}/health\" >/dev/null"

run_check "Deepgram/Vosk reachability (if set)" bash -lc "DG=\$(docker exec -i ${CONTAINER_NAME} printenv DEEPGRAM_BASE_URL 2>/dev/null | tr -d '\r'); VK=\$(docker exec -i ${CONTAINER_NAME} printenv VOSK_BASE_URL 2>/dev/null | tr -d '\r'); OK=0; if [ -n \"\$DG\" ]; then curl -fsS \"\${DG%/}/api/rounds\" >/dev/null || OK=1; fi; if [ -n \"\$VK\" ]; then curl -fsS \"\${VK%/}/api/rounds\" >/dev/null || OK=1; fi; exit \$OK"

log ""
log "Docker verify finished at $(date)"
log "PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
log "Log saved to ${LOG_FILE}"

exit 0
