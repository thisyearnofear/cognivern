#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ ${1:-} != --isolated ]]; then
  : "${EVIDENCE_DIR:?set to a NEW absolute directory}" "${MODEL_DAR:?}" "${SCRIPT_DAR:?}"
  [[ $EVIDENCE_DIR = /* && ! -e $EVIDENCE_DIR ]]
  mkdir -m 700 "$EVIDENCE_DIR"
  exec unshare --net --pid --fork --kill-child --mount-proc env -i PATH="$PATH" HOME="$HOME" EVIDENCE_DIR="$EVIDENCE_DIR" MODEL_DAR="$(realpath "$MODEL_DAR")" SCRIPT_DAR="$(realpath "$SCRIPT_DAR")" bash "$(realpath "$0")" --isolated
fi
[[ $$ == 1 && $(ip -o link show | wc -l) -eq 1 && -n "$(ip link show lo)" ]] || { echo 'Requires a loopback-only PID/network namespace' >&2; exit 1; }
ip link set lo up
repo=$(cd "$(dirname "$0")/../../.." && pwd)
[[ ! -e "$repo/.env" ]]
work=$(mktemp -d); cd "$work"
git -c safe.directory="$repo" -C "$repo" rev-parse HEAD > "$EVIDENCE_DIR/revision.txt"
sha256sum "$MODEL_DAR" "$SCRIPT_DAR" | awk '{print $1}' > "$EVIDENCE_DIR/dar-hashes.txt"
sha256sum "$0" | cut -d' ' -f1 > "$EVIDENCE_DIR/launcher-sha256.txt"
printf '%s\n' 'Starting isolated Canton sandbox'
dpm sandbox --dar "$MODEL_DAR" --ledger-api-port 6865 --json-api-port 7575 --canton-port-file "$work/ready.json" >sandbox.log 2>&1 &
sandbox=$!
# Wait for the SDK readiness file before allocating fixture parties.
for ((i=0;i<120;i++)); do kill -0 "$sandbox"; if jq -e 'type=="object" and length>0' ready.json >/dev/null 2>&1; then break; fi; sleep 1; done
jq -e 'type=="object" and length>0' ready.json >/dev/null
printf '%s\n' 'Allocating sandbox fixture parties'
dpm script --dar "$SCRIPT_DAR" --script-name StagingParties:stagingParties --ledger-host 127.0.0.1 --ledger-port 6865 --output-file parties.json >party-init.log 2>&1
jq -e 'map(split("::")[0]) == ["Auctioneer","Alice","Bob","Charlie"] and (unique|length)==4' parties.json >/dev/null
export CANTON_DEMO_PARTY_IDS=$(jq -r 'map((split("::")[0])+"="+.)|join(",")' parties.json)
export CANTON_JSON_API_URL=http://127.0.0.1:7575 CANTON_LEDGER_USER_ID=participant_admin CANTON_BEARER_TOKEN=staging CANTON_TEMPLATE_AUCTION='#daml:Main:SealedBidAuction' CANTON_TEMPLATE_BID='#daml:Main:Bid' CANTON_TEMPLATE_RESULT='#daml:Main:AuctionResult' CANTON_TEMPLATE_DEPOSIT='#daml:Main:PaymentDeposit' CANTON_TEMPLATE_CANCELLED='#daml:Main:AuctionCancelled'
export PORT=3101 DB_PATH="$work/stage.sqlite" JWT_SECRET=$(openssl rand -hex 32) OWS_VAULT_SECRET=$(openssl rand -hex 32) OWS_VAULT_DIR="$work/vault" AGENTS_ENABLED=false FILECOIN_ENABLED=false HYDRADB_ENABLED=false MCP_ENABLED=false
# tsx resolves tsconfig paths relative to its cwd, so spawn from the repo root.
printf '%s\n' 'Starting isolated backend'
(cd "$repo" && node_modules/.bin/tsx src/index.ts) >backend.log 2>&1 &
backend=$!
export ENDPOINT_URL=http://127.0.0.1:3101
for ((i=0;i<90;i++)); do kill -0 "$backend"; if curl -fsS "$ENDPOINT_URL/health" >/dev/null 2>&1; then break; fi; sleep 1; done
curl -fsS "$ENDPOINT_URL/health" >/dev/null
curl -fsS "$ENDPOINT_URL/api/vendor/sealed-bid/rounds" | jq -e '.success == true and (.data|type=="array" and length==0)' >/dev/null
printf '%s\n' 'four unique fixture roles initialized before API boot; zero initial rounds' > "$EVIDENCE_DIR/boot.txt"
python3 -m pytest -p no:cacheprovider -q "$repo/.testsprite/tests/sealed_bid_canton_backend.py" --junitxml="$EVIDENCE_DIR/results.xml"
