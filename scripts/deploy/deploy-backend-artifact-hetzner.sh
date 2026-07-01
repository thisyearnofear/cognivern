#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-snel-bot}"
REMOTE_BASE="${REMOTE_BASE:-/opt/cognivern}"
REMOTE_APP_DIR="$REMOTE_BASE/app"
ARTIFACT_DIR="${ARTIFACT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.artifacts}"
PM2_APP_NAME="${PM2_APP_NAME:-cognivern-backend}"

LATEST_TGZ="${ARTIFACT_TGZ:-$(ls -t "$ARTIFACT_DIR"/*.tgz | head -n 1)}"

echo "== deploying $LATEST_TGZ to $HOST"

ssh "$HOST" "mkdir -p '$REMOTE_APP_DIR' '$REMOTE_BASE/shared/data' '$REMOTE_BASE/shared/logs'"
scp "$LATEST_TGZ" "$HOST:$REMOTE_BASE/app.tgz"

ssh "$HOST" "set -e; \
  rm -rf '$REMOTE_APP_DIR'; \
  mkdir -p '$REMOTE_APP_DIR'; \
  tar -xzf '$REMOTE_BASE/app.tgz' -C '$REMOTE_APP_DIR'; \
  rm -f '$REMOTE_BASE/app.tgz'; \
  ln -sfn '$REMOTE_BASE/shared/data' '$REMOTE_APP_DIR/data'; \
  ln -sfn '$REMOTE_BASE/shared/logs' '$REMOTE_APP_DIR/logs'; \
  if [ -f '$REMOTE_BASE/shared/.env' ]; then \
    ln -sfn '$REMOTE_BASE/shared/.env' '$REMOTE_APP_DIR/.env'; \
  elif [ -f '$REMOTE_BASE/.env' ]; then \
    cp -n '$REMOTE_BASE/.env' '$REMOTE_BASE/shared/.env' || true; \
    ln -sfn '$REMOTE_BASE/shared/.env' '$REMOTE_APP_DIR/.env'; \
  fi; \
  cd '$REMOTE_APP_DIR'; \
  export CI=true; \
  echo '== installing production dependencies'; \
  pnpm install --prod --config.confirmModulesPurge=false; \
  if pm2 describe '$PM2_APP_NAME' >/dev/null 2>&1; then \
    pm2 restart '$PM2_APP_NAME' --update-env; \
  else \
    pm2 start '$REMOTE_APP_DIR/config/ecosystem.config.cjs'; \
  fi; \
  pm2 save; \
  sleep 2; \
  curl -sf http://127.0.0.1:3087/health | head -c 200; echo; \
  echo '== app deployed in place'"

echo "== done"
