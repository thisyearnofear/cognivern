#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

# New: Build/Pack dependencies locally
echo "== bundling production dependencies"
TMP_BUNDLE="$(mktemp -d)"
# Use a cleaner way to handle temporary cleanup
trap 'rm -rf "$TMP_BUNDLE"' EXIT
cp deploy/package.backend.json "$TMP_BUNDLE/package.json"
cp deploy/.npmrc.backend "$TMP_BUNDLE/.npmrc"
(cd "$TMP_BUNDLE" && npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps)

# Create artifact
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$TMP_BUNDLE"' EXIT

mkdir -p "$TMP/app"

cp -R dist "$TMP/app/dist"
cp deploy/package.backend.json "$TMP/app/package.json"
cp deploy/.npmrc.backend "$TMP_BUNDLE/.npmrc"

# Include local node_modules
cp -R "$TMP_BUNDLE/node_modules" "$TMP/app/node_modules"

if [ -d config ]; then
  cp -R config "$TMP/app/config"
fi

if [ -d src/policies ]; then
  mkdir -p "$TMP/app/src"
  cp -R src/policies "$TMP/app/src/policies"
fi

(
  cd "$TMP/app"
  tar -czf "$OUT_TGZ" .
)

echo "== artifact created: $OUT_TGZ"
