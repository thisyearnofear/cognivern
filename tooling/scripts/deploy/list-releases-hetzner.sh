#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"

ssh "$HOST" bash -s -- "$REMOTE_BASE" <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_BASE="$1"
RELEASES_DIR="$REMOTE_BASE/releases"
APP_LINK="$REMOTE_BASE/app"

printf '%s\n' '== current app'
if [ -L "$APP_LINK" ]; then
  readlink -f "$APP_LINK"
elif [ -d "$APP_LINK" ]; then
  echo "legacy in-place directory: $APP_LINK"
else
  echo "not present"
fi

printf '%s\n' '== releases (newest first)'
for candidate in $(ls -dt "$RELEASES_DIR"/* 2>/dev/null || true); do
  [ -d "$candidate" ] || continue
  case "$candidate" in
    "$RELEASES_DIR/".*) continue ;;
  esac
  if [ "$(readlink -f "$APP_LINK" 2>/dev/null || true)" = "$candidate" ]; then
    printf '* %s (active)\n' "$(basename "$candidate")"
  else
    printf '  %s\n' "$(basename "$candidate")"
  fi
done
REMOTE_SCRIPT
