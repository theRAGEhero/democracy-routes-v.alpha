#!/usr/bin/env bash
set -euo pipefail
curl -fsS "http://127.0.0.1:${PROXY_HTTP_PORT:-8088}/" >/dev/null && echo "proxy: ok"
curl -fsS "http://127.0.0.1:${PROXY_HTTP_PORT:-8088}/video/api/health" && echo
