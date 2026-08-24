#!/usr/bin/env bash
set -euo pipefail

# Regenerates the committed pnpm lockfile for the production backend artifact
# (ops/deploy/package.backend.json) as ops/deploy/pnpm-lock.backend.yaml.
# build-backend-artifact.sh ships it into the artifact as pnpm-lock.yaml and
# the server installs with --frozen-lockfile, making prod installs
# reproducible. Re-run this after ANY edit to package.backend.json.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

LOCK_TMP="$(mktemp -d)"
trap 'rm -rf "$LOCK_TMP"' EXIT

cp ops/deploy/package.backend.json "$LOCK_TMP/package.json"
cp ops/deploy/.npmrc.backend "$LOCK_TMP/.npmrc"

echo "== resolving prod dependency tree for the backend artifact"
(
  cd "$LOCK_TMP"
  pnpm install --prod --lockfile-only
)

cp "$LOCK_TMP/pnpm-lock.yaml" ops/deploy/pnpm-lock.backend.yaml
echo "== wrote ops/deploy/pnpm-lock.backend.yaml"
