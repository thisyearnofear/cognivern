#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"

ssh "$HOST" "set -e; \
  echo '== current'; \
  ls -la '$REMOTE_BASE/current' || true; \
  echo; \
  echo '== releases (newest first)'; \
  ls -1dt '$REMOTE_BASE/releases'/* 2>/dev/null | head -n 20 || true"
