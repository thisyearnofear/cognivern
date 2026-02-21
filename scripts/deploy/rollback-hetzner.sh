#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"
RELEASE="${1:-}"

if [ -z "$RELEASE" ]; then
  echo "Usage: $0 <release-dir-name>"
  echo "Example: $0 cognivern-backend-20260221T212606Z-1a441b5"
  exit 1
fi

ssh "$HOST" "set -e; \
  TARGET='$REMOTE_BASE/releases/$RELEASE'; \
  if [ ! -d \"\$TARGET\" ]; then echo \"Release not found: \$TARGET\" >&2; exit 2; fi; \
  ln -sfn \"\$TARGET\" '$REMOTE_BASE/current'; \
  pm2 restart cognivern-api --update-env || true; \
  pm2 save || true; \
  sleep 2; \
  curl -sf http://127.0.0.1:10000/health | head -c 200; echo; \
  echo \"== rolled back to $RELEASE\""
