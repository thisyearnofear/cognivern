#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/.artifacts}"
VERSION_TAG="${VERSION_TAG:-$(git rev-parse --short HEAD)}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="cognivern-backend-${TS}-${VERSION_TAG}"
OUT_TGZ="$ARTIFACT_DIR/${NAME}.tgz"

mkdir -p "$ARTIFACT_DIR"

echo "== building backend"
pnpm -s install
pnpm -s build:backend

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/app"

# Minimal runtime payload
cp -R dist "$TMP/app/dist"
cp package.json pnpm-lock.yaml pnpm-workspace.yaml "$TMP/app/" 2>/dev/null || true
cp tsconfig.json "$TMP/app/" 2>/dev/null || true

# runtime config directory (copied to allow existing config reads)
if [ -d config ]; then
  cp -R config "$TMP/app/config"
fi

# scripts not needed at runtime

# Create tarball
(
  cd "$TMP/app"
  # Avoid macOS extended attributes in archives (reduces noise on Linux untar)
  # --no-xattrs is GNU tar; bsdtar ignores unknown flags, so we feature-detect.
  if tar --help 2>/dev/null | grep -q -- "--no-xattrs"; then
    tar --no-xattrs -czf "$OUT_TGZ" .
  else
    tar -czf "$OUT_TGZ" .
  fi
)

echo "== artifact created: $OUT_TGZ"
