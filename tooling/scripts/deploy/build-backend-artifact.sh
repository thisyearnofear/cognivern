#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/.artifacts}"
VERSION_TAG="${VERSION_TAG:-$(git rev-parse --short HEAD)}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="cognivern-backend-${TS}-${VERSION_TAG}"
OUT_TGZ="$ARTIFACT_DIR/${NAME}.tgz"

export COPYFILE_DISABLE=1

mkdir -p "$ARTIFACT_DIR"

echo "== building backend"
pnpm -s install
pnpm -s build:backend

# Copy the OpenAPI spec into dist/ so /api/docs/openapi.json works in production
# (the examples/copilot/ source directory is not included in the deployment artifact).
if [ -f examples/copilot/cognivern-openapi.json ]; then
  cp examples/copilot/cognivern-openapi.json dist/openapi.json
  echo "  (copied openapi spec to dist/openapi.json)"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/app"

cp -R dist "$TMP/app/dist"
cp ops/deploy/package.backend.json "$TMP/app/package.json"
if [ -f ops/deploy/pnpm-lock.backend.yaml ]; then
  cp ops/deploy/pnpm-lock.backend.yaml "$TMP/app/pnpm-lock.yaml"
else
  echo "  (no lock file — server will resolve on first install; run tooling/scripts/deploy/regen-backend-lockfile.sh to generate one)"
fi
cp ops/deploy/.npmrc.backend "$TMP/app/.npmrc"

if [ -d config ]; then
  cp -R config "$TMP/app/config"
  # src/config.ts resolves runtime configuration relative to dist/src, so
  # include the MCP config alongside compiled modules as well as the root
  # loader/ecosystem config used by PM2.
  if [ -f config/mcp-config.json ]; then
    mkdir -p "$TMP/app/dist/config"
    cp config/mcp-config.json "$TMP/app/dist/config/mcp-config.json"
  fi
fi

if [ -d src/policies ]; then
  mkdir -p "$TMP/app/src"
  cp -R src/policies "$TMP/app/src/policies"
fi

(
  cd "$TMP/app"
  if tar --help 2>/dev/null | grep -q -- "--no-xattrs"; then
    tar --no-xattrs -czf "$OUT_TGZ" .
  elif tar --help 2>/dev/null | grep -q -- "--disable-copyfile"; then
    tar --disable-copyfile -czf "$OUT_TGZ" .
  else
    tar -czf "$OUT_TGZ" .
  fi
)

echo "== artifact created: $OUT_TGZ"
