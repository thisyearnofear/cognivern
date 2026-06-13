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

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/app"

cp -R dist "$TMP/app/dist"
cp deploy/package.backend.json "$TMP/app/package.json"
if [ -f deploy/package-lock.backend.json ]; then
  cp deploy/package-lock.backend.json "$TMP/app/package-lock.json"
else
  echo "  (no lock file — server will resolve on first install)"
fi
cp deploy/.npmrc.backend "$TMP/app/.npmrc"

if [ -d config ]; then
  cp -R config "$TMP/app/config"
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
