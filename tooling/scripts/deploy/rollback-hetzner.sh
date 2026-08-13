#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"
PM2_APP_NAME="${PM2_APP_NAME:-cognivern-backend}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-45}"
TARGET_RELEASE="${1:-}"

ssh "$HOST" bash -s -- "$REMOTE_BASE" "$PM2_APP_NAME" "$HEALTH_TIMEOUT_SECONDS" "$TARGET_RELEASE" <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_BASE="$1"
PM2_APP_NAME="$2"
HEALTH_TIMEOUT_SECONDS="$3"
TARGET_RELEASE="$4"
RELEASES_DIR="$REMOTE_BASE/releases"
APP_LINK="$REMOTE_BASE/app"

CURRENT_TARGET="$(readlink -f "$APP_LINK" || true)"
if [ -z "$TARGET_RELEASE" ]; then
  for candidate in $(ls -dt "$RELEASES_DIR"/* 2>/dev/null || true); do
    [ -d "$candidate" ] || continue
    if [ "$candidate" != "$CURRENT_TARGET" ]; then
      TARGET_RELEASE="$candidate"
      break
    fi
  done
else
  if [[ ! "$TARGET_RELEASE" =~ ^[A-Za-z0-9_-][A-Za-z0-9._-]*$ ]]; then
    echo "invalid release id: $TARGET_RELEASE" >&2
    exit 1
  fi
  TARGET_RELEASE="$RELEASES_DIR/$TARGET_RELEASE"
fi

case "$TARGET_RELEASE" in
  "$RELEASES_DIR"/*) ;;
  *) echo "refusing rollback outside $RELEASES_DIR" >&2; exit 1 ;;
esac

if [ ! -d "$TARGET_RELEASE" ]; then
  echo "release not found: $TARGET_RELEASE" >&2
  exit 1
fi

switch_to() {
  local target="$1"
  local next_link="$REMOTE_BASE/.app.rollback.$$"
  rm -f "$next_link"
  ln -s "$target" "$next_link"
  mv -Tf "$next_link" "$APP_LINK"
}

restart_pm2() {
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    CURRENT_SCRIPT="$(pm2 describe "$PM2_APP_NAME" | awk -F '│' '/script path/ {gsub(/^ +| +$/, "", $3); print $3; exit}')"
    EXPECTED_SCRIPT="$APP_LINK/dist/src/index.js"
    if [ "$CURRENT_SCRIPT" = "$EXPECTED_SCRIPT" ]; then
      pm2 restart "$PM2_APP_NAME" --update-env
    else
      pm2 delete "$PM2_APP_NAME"
      pm2 start "$APP_LINK/config/ecosystem.config.cjs"
    fi
  else
    pm2 start "$APP_LINK/config/ecosystem.config.cjs"
  fi
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 "$HEALTH_TIMEOUT_SECONDS"); do
    if curl -fsS --max-time 2 http://127.0.0.1:3087/health >/dev/null \
      && curl -fsS --max-time 2 http://127.0.0.1:3087/health/ready >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "== rolling back from ${CURRENT_TARGET:-none} to $TARGET_RELEASE"
switch_to "$TARGET_RELEASE"
restart_pm2
if ! wait_for_health; then
  echo "rollback health check failed; current app remains $TARGET_RELEASE" >&2
  exit 1
fi
pm2 save
curl -fsS http://127.0.0.1:3087/health | head -c 300
echo
REMOTE_SCRIPT
