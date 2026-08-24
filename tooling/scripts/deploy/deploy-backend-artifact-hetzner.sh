#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/.artifacts}"
PM2_APP_NAME="${PM2_APP_NAME:-cognivern-backend}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-45}"
RETAIN_RELEASES="${RETAIN_RELEASES:-5}"

LATEST_TGZ="${ARTIFACT_TGZ:-$(ls -t "$ARTIFACT_DIR"/*.tgz | head -n 1)}"
if [ ! -f "$LATEST_TGZ" ]; then
  echo "artifact not found: $LATEST_TGZ" >&2
  exit 1
fi

RELEASE_ID="${RELEASE_ID:-$(basename "$LATEST_TGZ" .tgz)}"
if [[ ! "$RELEASE_ID" =~ ^[A-Za-z0-9_-][A-Za-z0-9._-]*$ ]]; then
  echo "invalid release id: $RELEASE_ID" >&2
  exit 1
fi

REMOTE_INCOMING="$REMOTE_BASE/incoming"
REMOTE_TARBALL="$REMOTE_INCOMING/$RELEASE_ID.tgz"

echo "== deploying release $RELEASE_ID to $HOST"

ssh "$HOST" "mkdir -p '$REMOTE_INCOMING' '$REMOTE_BASE/releases' '$REMOTE_BASE/shared/data' '$REMOTE_BASE/shared/logs'"
scp "$LATEST_TGZ" "$HOST:$REMOTE_TARBALL"

ssh "$HOST" bash -s -- "$REMOTE_BASE" "$RELEASE_ID" "$PM2_APP_NAME" "$HEALTH_TIMEOUT_SECONDS" "$RETAIN_RELEASES" <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_BASE="$1"
RELEASE_ID="$2"
PM2_APP_NAME="$3"
HEALTH_TIMEOUT_SECONDS="$4"
RETAIN_RELEASES="$5"
RELEASES_DIR="$REMOTE_BASE/releases"
APP_LINK="$REMOTE_BASE/app"
INCOMING_DIR="$REMOTE_BASE/incoming"
TARBALL="$INCOMING_DIR/$RELEASE_ID.tgz"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
TMP_DIR="$RELEASES_DIR/.$RELEASE_ID.tmp.$$"

if [ -e "$RELEASE_DIR" ]; then
  echo "release already exists: $RELEASE_DIR" >&2
  exit 1
fi

OLD_TARGET=""
LEGACY_DIR=""
if [ -L "$APP_LINK" ]; then
  OLD_TARGET="$(readlink -f "$APP_LINK" || true)"
elif [ -d "$APP_LINK" ]; then
  # The legacy directory is migrated only after candidate validation, so a
  # failed extraction/install never removes the currently running app.
  LEGACY_ID="legacy-$(date -u +%Y%m%dT%H%M%SZ)"
  LEGACY_DIR="$RELEASES_DIR/$LEGACY_ID"
  OLD_TARGET="$LEGACY_DIR"
elif [ -e "$APP_LINK" ]; then
  echo "unsupported app path (expected symlink or directory): $APP_LINK" >&2
  exit 1
fi

cleanup() {
  rm -rf "$TMP_DIR" "$TARBALL"
}
trap cleanup EXIT

mkdir -p "$TMP_DIR"
echo "== extracting release"
tar -xzf "$TARBALL" -C "$TMP_DIR"

# Shared state is never stored inside a release directory.
ln -sfn "$REMOTE_BASE/shared/data" "$TMP_DIR/data"
ln -sfn "$REMOTE_BASE/shared/logs" "$TMP_DIR/logs"
if [ -f "$REMOTE_BASE/shared/.env" ]; then
  ln -sfn "$REMOTE_BASE/shared/.env" "$TMP_DIR/.env"
elif [ -f "$REMOTE_BASE/.env" ]; then
  cp -n "$REMOTE_BASE/.env" "$REMOTE_BASE/shared/.env" || true
  ln -sfn "$REMOTE_BASE/shared/.env" "$TMP_DIR/.env"
fi

cd "$TMP_DIR"
export CI=true
echo "== installing production dependencies"
if [ -f pnpm-lock.yaml ]; then
  # Frozen install: exact reproduction of the resolved tree committed via
  # tooling/scripts/deploy/regen-backend-lockfile.sh. Fails loudly if the
  # manifest drifted from the lockfile instead of silently re-resolving.
  pnpm install --prod --frozen-lockfile --config.confirmModulesPurge=false
else
  echo "  (no pnpm-lock.yaml shipped — resolving fresh; regenerate with tooling/scripts/deploy/regen-backend-lockfile.sh)"
  pnpm install --prod --config.confirmModulesPurge=false
fi
echo "== rebuilding native modules"
pnpm rebuild better-sqlite3

# Validate the immutable candidate before it can become current.
test -f "$TMP_DIR/dist/src/index.js"
test -f "$TMP_DIR/dist/config/mcp-config.json"
test -f "$TMP_DIR/config/esm-dir-loader.mjs"
node --check "$TMP_DIR/dist/src/index.js"
node --check "$TMP_DIR/config/esm-dir-loader.mjs"

if [ -n "$LEGACY_DIR" ]; then
  echo "== migrating legacy app directory to $LEGACY_DIR"
  mv "$APP_LINK" "$LEGACY_DIR"
fi

mv "$TMP_DIR" "$RELEASE_DIR"
trap - EXIT
rm -f "$TARBALL"

switch_to() {
  local target="$1"
  local next_link="$REMOTE_BASE/.app.next.$$"
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
      echo "== replacing stale PM2 entry ($CURRENT_SCRIPT)"
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

echo "== switching current app atomically"
switch_to "$RELEASE_DIR"
restart_pm2

if ! wait_for_health; then
  echo "== new release failed health checks; rolling back" >&2
  if [ -n "$OLD_TARGET" ] && [ -d "$OLD_TARGET" ]; then
    switch_to "$OLD_TARGET"
    restart_pm2
    if ! wait_for_health; then
      echo "rollback health check also failed" >&2
    fi
    pm2 save
  else
    echo "no previous release available for rollback" >&2
  fi
  exit 1
fi

pm2 save

# Keep the current release, rollback target, and a bounded history. Release
# directories are immutable; only old, unreferenced releases are removed.
CURRENT_TARGET="$(readlink -f "$APP_LINK")"
kept=0
for candidate in $(ls -dt "$RELEASES_DIR"/* 2>/dev/null || true); do
  [ -d "$candidate" ] || continue
  case "$candidate" in
    "$RELEASES_DIR/".*) continue ;;
  esac
  if [ "$candidate" = "$CURRENT_TARGET" ] || [ "$candidate" = "$OLD_TARGET" ]; then
    continue
  fi
  if [ "$kept" -lt "$RETAIN_RELEASES" ]; then
    kept=$((kept + 1))
  else
    rm -rf "$candidate"
  fi
done

echo "== release active: $RELEASE_ID"
echo "== current target: $CURRENT_TARGET"
echo "== previous target: ${OLD_TARGET:-none}"
curl -fsS http://127.0.0.1:3087/health | head -c 300
echo
REMOTE_SCRIPT

echo "== done"
