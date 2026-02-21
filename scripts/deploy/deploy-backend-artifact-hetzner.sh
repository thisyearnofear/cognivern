#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.artifacts}"

LATEST_TGZ="${ARTIFACT_TGZ:-$(ls -t "$ARTIFACT_DIR"/*.tgz | head -n 1)}"
RELEASE_NAME="$(basename "$LATEST_TGZ" .tgz)"

echo "== deploying $LATEST_TGZ to $HOST"

ssh "$HOST" "mkdir -p '$REMOTE_BASE/releases' '$REMOTE_BASE/shared/data' '$REMOTE_BASE/shared/logs'"

# Upload artifact
scp "$LATEST_TGZ" "$HOST:$REMOTE_BASE/releases/$RELEASE_NAME.tgz"

# Unpack release and wire shared dirs
ssh "$HOST" "set -e; \
  cd '$REMOTE_BASE/releases'; \
  mkdir -p '$RELEASE_NAME'; \
  tar -xzf '$RELEASE_NAME.tgz' -C '$RELEASE_NAME'; \
  ln -sfn '$REMOTE_BASE/shared/data' '$REMOTE_BASE/releases/$RELEASE_NAME/data'; \
  ln -sfn '$REMOTE_BASE/shared/logs' '$REMOTE_BASE/releases/$RELEASE_NAME/logs'; \
  if [ -f '$REMOTE_BASE/shared/.env' ]; then \
    ln -sfn '$REMOTE_BASE/shared/.env' '$REMOTE_BASE/releases/$RELEASE_NAME/.env'; \
  else \
    if [ -f '$REMOTE_BASE/.env' ]; then \
      cp -n '$REMOTE_BASE/.env' '$REMOTE_BASE/shared/.env' || true; \
      ln -sfn '$REMOTE_BASE/shared/.env' '$REMOTE_BASE/releases/$RELEASE_NAME/.env'; \
    fi; \
  fi; \
  cd '$REMOTE_BASE/releases/$RELEASE_NAME'; \
  export CI=true; \
  pnpm install --prod --frozen-lockfile=false; \
  ln -sfn '$REMOTE_BASE/releases/$RELEASE_NAME' '$REMOTE_BASE/current'; \
  pm2 restart cognivern-api --update-env || pm2 start '$REMOTE_BASE/config/ecosystem.config.cjs'; \
  pm2 save; \
  sleep 2; \
  curl -sf http://127.0.0.1:10000/health | head -c 200; echo; \
  echo '== release deployed: $RELEASE_NAME'"

# Retain last N releases
RETAIN="${RETAIN:-5}"
ssh "$HOST" "bash -lc 'cd "$REMOTE_BASE/releases" && ls -1dt cognivern-backend-* 2>/dev/null | tail -n +$((RETAIN+1)) | xargs -r rm -rf'"

echo "== done"
