#!/bin/bash

# Cognivern Lean Deployment
# Builds locally with esbuild, deploys only the bundle + native deps.
# Reduces server footprint from ~600MB to ~20MB.

set -e

SSH_HOST="snel-bot"
DEPLOY_PATH="/opt/cognivern/app"
BUNDLE_DIR="deploy-bundle"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

cd "$(dirname "$0")/.."

# ──────────────────────────────────────────────────────────────
# 1. Build the bundle locally
# ──────────────────────────────────────────────────────────────
info "Building bundle..."
node deploy/build-bundle.mjs

BUNDLE_SIZE=$(du -sh "$BUNDLE_DIR" | cut -f1)
info "Bundle size: $BUNDLE_SIZE"

# ──────────────────────────────────────────────────────────────
# 2. Sync bundle to server (only changed files)
# ──────────────────────────────────────────────────────────────
info "Syncing to server..."
rsync -avz --delete \
  "$BUNDLE_DIR/" \
  "$SSH_HOST:$DEPLOY_PATH/bundle/" \
  --exclude node_modules

# ──────────────────────────────────────────────────────────────
# 3. Install native deps + restart on server
# ──────────────────────────────────────────────────────────────
info "Installing native deps and restarting..."
ssh "$SSH_HOST" << 'REMOTE_EOF'
  set -e
  export PATH="/tmp/node-v22.22.1-linux-x64/bin:$PATH"
  DEPLOY_PATH="/opt/cognivern/app"
  SHARED_PATH="/opt/cognivern/shared"
  cd "$DEPLOY_PATH/bundle"

  # Install only if package.json changed (native deps are stable)
  if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "  Installing native dependencies..."
    npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5
  else
    echo "  Native deps up to date, skipping install."
  fi

  # Ensure data directory exists (SQLite DB lives here)
  mkdir -p "$SHARED_PATH/data"
  ln -sfn "$SHARED_PATH/data" "$DEPLOY_PATH/bundle/data"

  # Restart pm2 — point at the new bundle entry
  pm2 delete cognivern-backend 2>/dev/null || true
  pm2 start server.mjs \
    --name cognivern-backend \
    --cwd "$DEPLOY_PATH/bundle" \
    --node-args="--env-file=$SHARED_PATH/.env" \
    --time
  pm2 save

  # Remove legacy fat deployment if it exists
  if [ -d "$DEPLOY_PATH/node_modules" ]; then
    echo "  Removing legacy node_modules (freeing ~586MB)..."
    rm -rf "$DEPLOY_PATH/node_modules" "$DEPLOY_PATH/dist" "$DEPLOY_PATH/package-lock.json"
  fi

  # Truncate logs
  if [ -d "$SHARED_PATH/logs" ]; then
    find "$SHARED_PATH/logs" -name "*.log" -size +10M -exec sh -c 'tail -1000 "$1" > "$1.tmp" && mv "$1.tmp" "$1"' _ {} \;
    echo "  Logs trimmed."
  fi

  echo ""
  echo "  Status:"
  pm2 show cognivern-backend | grep -E "(status|memory|uptime|script path)"
  echo ""
  echo "  Disk usage:"
  du -sh "$DEPLOY_PATH/bundle" "$DEPLOY_PATH/bundle/node_modules" "$SHARED_PATH/data" "$SHARED_PATH/logs" 2>/dev/null
  echo ""
  df -h / | tail -1
REMOTE_EOF

# ──────────────────────────────────────────────────────────────
# 4. Verify health
# ──────────────────────────────────────────────────────────────
info "Checking health..."
sleep 2
HEALTH=$(ssh "$SSH_HOST" "curl -sf http://localhost:3087/api/health 2>/dev/null" || echo "FAILED")
if echo "$HEALTH" | grep -q "ok\|healthy\|success"; then
  info "Deploy successful — server is healthy."
else
  warn "Health check response: $HEALTH"
  warn "Check logs with: ssh $SSH_HOST 'pm2 logs cognivern-backend --lines 30'"
fi
