#!/usr/bin/env bash
set -euo pipefail
: "${EVIDENCE_DIR:?}" "${GITHUB_SHA:?}"
mkdir -p "$EVIDENCE_DIR"
cg="/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)"
[[ "$cg" != /sys/fs/cgroup/ && -r "$cg/memory.peak" ]]
start=$SECONDS
snap() {
  printf '%s\t%s\t%s\t%s\n' "$1" "$((SECONDS-start))" "$(cat "$cg/memory.current")" "$(cat "$cg/memory.peak")" >> "$EVIDENCE_DIR/memory.tsv"
  cat "$cg/memory.events" > "$EVIDENCE_DIR/memory.events"
}
printf 'phase\telapsed_seconds\tcurrent_bytes\tcumulative_peak_bytes\n' > "$EVIDENCE_DIR/memory.tsv"
snap before-build
trap 'snap exit' EXIT
printf '%s\n' "$GITHUB_SHA" > "$EVIDENCE_DIR/revision.txt"
{ dpm version; java -version; uname -srmo; nproc; grep MemTotal /proc/meminfo; } > "$EVIDENCE_DIR/toolchain.txt" 2>&1
dpm build
(cd scripts && dpm build)
model=.daml/dist/daml-0.0.3.dar
scripts=scripts/.daml/dist/daml-scripts-0.0.3.dar
sha256sum "$model" "$scripts" > "$EVIDENCE_DIR/dar-sha256.txt"
snap built
args=(--dar "$scripts" --script-name VisibilityProof:visibilityProof)
dpm script "${args[@]}" --ide-ledger --output-file "$EVIDENCE_DIR/ide.json"
snap ide-finished
ready=$(mktemp -d)
dpm sandbox --dar "$model" --port-file "$ready/port" > "$ready/sandbox.log" 2>&1 &
child=$!
trap 'rc=$?; kill "$child" 2>/dev/null || true; if ((rc)); then tail -50 "$ready/sandbox.log" >&2; fi; snap exit' EXIT
# Watch the SDK readiness event; check once after subscribing to avoid a race.
port=$(node - "$ready" <<'JS'
const fs = require('node:fs');
const dir = process.argv[2];
const timer = setTimeout(() => {console.error('No ready ledger port within 120s');process.exit(1)},120000);
const watcher = fs.watch(dir, (event, file) => { if (file === 'port') check(); });
function check() {
  let value; try {value = fs.readFileSync(`${dir}/port`, 'utf8').trim()} catch (err) {if (err.code === 'ENOENT') return; throw err}
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) return;
  clearTimeout(timer); watcher.close(); console.log(value);
}
check();
JS
)
snap sandbox-ready
dpm script "${args[@]}" --ledger-host 127.0.0.1 --ledger-port "$port" --output-file "$EVIDENCE_DIR/sandbox.json"
jq -e 'type == "array" and length == 4' "$EVIDENCE_DIR/sandbox.json" >/dev/null
jq -e -s '.[0] == .[1]' "$EVIDENCE_DIR/ide.json" "$EVIDENCE_DIR/sandbox.json" >/dev/null
snap sandbox-finished
