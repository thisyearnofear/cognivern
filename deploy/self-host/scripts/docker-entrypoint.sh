#!/bin/sh
set -eu

mkdir -p "$(dirname "${DB_PATH:-/app/data/cognivern.db}")"

# Start the API in the background so we can optionally seed once it is ready.
node server.mjs &
pid=$!

cleanup() {
  kill "$pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

i=0
until curl -fsS "http://127.0.0.1:${PORT:-3001}/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "backend health check timed out" >&2
    exit 1
  fi
  sleep 1
done

if [ "${SEED_DEMO:-true}" = "true" ]; then
  echo "seeding self-host demo mandate…"
  node seed-demo.mjs || echo "seed skipped or failed (non-fatal)" >&2
fi

trap - EXIT INT TERM
wait "$pid"
