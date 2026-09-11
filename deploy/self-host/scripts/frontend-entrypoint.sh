#!/bin/sh
set -eu
cd /app
for candidate in \
  ./server.js \
  ./src/frontend/server.js \
  ./frontend/server.js
do
  if [ -f "$candidate" ]; then
    exec node "$candidate"
  fi
done
echo "Could not find Next standalone server.js under /app" >&2
find /app -maxdepth 4 -name 'server.js' 2>/dev/null | head >&2 || true
exit 1
