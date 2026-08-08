#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"

ssh "$HOST" "set -e; \
  echo '== app'; \
  ls -la '$REMOTE_BASE/app' || true; \
  echo; \
  echo '== root'; \
  ls -la '$REMOTE_BASE'"
