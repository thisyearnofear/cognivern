#!/usr/bin/env bash
# Local-validator proof for the supplier payment rail. Everything is
# loopback-only and disposable: fresh ledger, ephemeral keys, local SPL mint.
# Writes a public-only proof to .artifacts/supplier-local-validator-proof.json
# and tears down only the validator process it spawned. The temp dir is
# removed only on success — on failure it is left for inspection.
set -euo pipefail
cd "$(dirname "$0")/../.."

GOVERNED=0
for a in "$@"; do [ "$a" = "--governed" ] && GOVERNED=1; done

RPC_PORT=18899          # RPC ws is auto-bound at rpc+1 (18900)
FAUCET_PORT=18901       # must NOT collide with the RPC ws port
GOSSIP_RANGE="18910-18940"
ENDPOINT="http://127.0.0.1:${RPC_PORT}"
if [ "${GOVERNED}" = "1" ]; then
  OUT=".artifacts/supplier-worker-local-proof.json"
else
  OUT=".artifacts/supplier-local-validator-proof.json"
fi
TMP="$(mktemp -d /tmp/supplier-local-proof.XXXXXX)"
VALIDATOR_PID=""

cleanup() {
  if [ -n "${VALIDATOR_PID}" ] && kill -0 "${VALIDATOR_PID}" 2>/dev/null; then
    kill "${VALIDATOR_PID}" 2>/dev/null || true
    wait "${VALIDATOR_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir -p .artifacts "${TMP}/keys"
chmod 700 "${TMP}" "${TMP}/keys"

rpc() {
  curl -s -X POST -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "${ENDPOINT}"
}

# USDC-style base units of a token account; prints "absent" if the account
# does not exist. Optional second arg overrides the commitment — the
# pre-dispatch wait requires finalized so the ledger is past the flaky
# startup window before we broadcast. Fails loudly on unreadable input.
token_amount() {
  rpc getAccountInfo "[\"$1\",{\"encoding\":\"jsonParsed\",\"commitment\":\"${2:-confirmed}\"}]" | python3 -c '
import json,sys
r=json.load(sys.stdin)["result"]["value"]
if r is None: print("absent")
else: print(r["data"]["parsed"]["info"]["tokenAmount"]["amount"])'
}

sig_count() {
  rpc getSignaturesForAddress "[\"$1\"]" | python3 -c '
import json,sys
print(len(json.load(sys.stdin)["result"]))'
}

echo ">> generating ephemeral local keys"
for name in payer payee; do
  solana-keygen new --no-bip39-passphrase --silent --outfile "${TMP}/keys/${name}.json" >/dev/null
  chmod 600 "${TMP}/keys/${name}.json"
done
PAYER_PUB="$(solana-keygen pubkey "${TMP}/keys/payer.json")"
PAYEE_PUB="$(solana-keygen pubkey "${TMP}/keys/payee.json")"
echo "   payer=${PAYER_PUB}"
echo "   payee=${PAYEE_PUB}"

# Isolated Solana CLI configuration — never reads or writes the operator's
# default ~/.config/solana identity.
CLI_CONFIG="${TMP}/cli-config.yml"
solana config set -C "${CLI_CONFIG}" --url "${ENDPOINT}" \
  --keypair "${TMP}/keys/payer.json" >/dev/null

echo ">> starting solana-test-validator $(solana-test-validator --version | awk '{print $2}')"
solana-test-validator \
  --ledger "${TMP}/ledger" \
  --bind-address 127.0.0.1 \
  --rpc-port "${RPC_PORT}" \
  --faucet-port "${FAUCET_PORT}" \
  --dynamic-port-range "${GOSSIP_RANGE}" \
  --mint "${PAYER_PUB}" \
  --reset >"${TMP}/validator.log" 2>&1 &
VALIDATOR_PID=$!

echo ">> waiting for typed health on ${ENDPOINT}"
for _ in $(seq 1 60); do
  HEALTH="$(rpc getHealth '[]')" || true
  if echo "${HEALTH}" | grep -q '"result":"ok"'; then break; fi
  sleep 1
done
echo "${HEALTH}" | grep -q '"result":"ok"' || {
  echo "validator never became healthy"; tail -30 "${TMP}/validator.log"; exit 1; }

# The RPC we talk to must be the validator we spawned: the child pid is
# alive AND the chain genesis matches the genesis in our spawned log.
kill -0 "${VALIDATOR_PID}" || { echo "spawned validator died"; exit 1; }
for _ in $(seq 1 30); do
  LOG_GENESIS="$(grep -o 'genesis hash: [A-Za-z0-9]*' "${TMP}/ledger/validator.log" | head -1 | awk '{print $3}' || true)"
  [ -n "${LOG_GENESIS}" ] && break
  sleep 1
done
RPC_GENESIS="$(rpc getGenesisHash '[]' | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"])')"
if [ -z "${LOG_GENESIS}" ] || [ "${LOG_GENESIS}" != "${RPC_GENESIS}" ]; then
  echo "FAIL: RPC genesis ${RPC_GENESIS} is not the spawned validator genesis ${LOG_GENESIS}"
  exit 1
fi
echo "   genesis=${RPC_GENESIS} (verified owned by spawned validator)"

echo ">> creating local SPL mint (6 decimals) and funding the payer ATA"
# A fresh validator briefly reports programs "not deployed" during warmup —
# create-token fails at preflight so nothing is broadcast and a bounded
# retry is safe (a retry only happens on CLI failure).
MINT=""
for _ in $(seq 1 30); do
  CREATE_OUT="$(spl-token -C "${CLI_CONFIG}" create-token --decimals 6 \
    --mint-authority "${TMP}/keys/payer.json" --output json 2>>"${TMP}/spl.log")" && {
    MINT="$(echo "${CREATE_OUT}" | python3 -c \
      'import json,sys; print(json.load(sys.stdin)["commandOutput"]["address"])')"
    break
  }
  sleep 1
done
[ -n "${MINT}" ] || { echo "FAIL: could not create SPL mint"; exit 1; }
PAYER_ATA="$(pnpm exec tsx tooling/supplier-payment/ata-of.ts --mint "${MINT}" --owner "${PAYER_PUB}")"
PAYEE_ATA="$(pnpm exec tsx tooling/supplier-payment/ata-of.ts --mint "${MINT}" --owner "${PAYEE_PUB}")"
for _ in $(seq 1 15); do
  spl-token -C "${CLI_CONFIG}" create-account "${MINT}" --owner "${PAYER_PUB}" \
    --fee-payer "${TMP}/keys/payer.json" >>"${TMP}/spl.log" 2>&1 && break
  sleep 1
done
# Mint exactly once — an ambiguous retry could double-mint. On failure the
# balance check decides: exactly 10000 base units or nothing.
spl-token -C "${CLI_CONFIG}" mint "${MINT}" 0.01 "${PAYER_ATA}" \
  --fee-payer "${TMP}/keys/payer.json" --owner "${TMP}/keys/payer.json" \
  >>"${TMP}/spl.log" 2>&1 || true
for _ in $(seq 1 30); do
  PAYER_PRE="$(token_amount "${PAYER_ATA}")"
  [ "${PAYER_PRE}" = "10000" ] && break
  sleep 1
done
[ "${PAYER_PRE}" = "10000" ] || { echo "FAIL: payer ATA has ${PAYER_PRE}, expected 10000"; exit 1; }
PAYEE_PRE="$(token_amount "${PAYEE_ATA}")"
[ "${PAYEE_PRE}" = "absent" ] || { echo "FAIL: payee ATA unexpectedly present (${PAYEE_PRE})"; exit 1; }
# Broadcast only once the funding transactions are FINALIZED — a fresh
# validator can silently drop transactions sent during its warmup window.
for _ in $(seq 1 60); do
  [ "$(token_amount "${PAYER_ATA}" finalized)" = "10000" ] && break
  sleep 1
done
[ "$(token_amount "${PAYER_ATA}" finalized)" = "10000" ] \
  || { echo "FAIL: payer ATA funding never finalized"; exit 1; }
echo "   mint=${MINT} payerAta=${PAYER_PRE} payeeAta=absent (funding finalized)"

if [ "${GOVERNED}" = "1" ]; then
  # ------------------------------------------------------------------
  # Governed local-worker proof: same validator + mint, but the transfer is
  # dispatched through local-worker.ts → createLocalSupplierExecutor → the
  # real rail adapter, with a real worker-private SQLite DB and a read-only
  # CRE JSONL snapshot. Held must never dispatch; a crash between send and
  # finalize must stay pending with no debit; reconcile confirms exactly
  # once.
  # ------------------------------------------------------------------
  echo ">> governed worker proof: seeding temp DB, CRE snapshot, reports, issuer"
  mkdir -p "${TMP}/worker-journal"
  chmod 700 "${TMP}/worker-journal"
  pnpm exec tsx tooling/supplier-payment/governed-seed.ts \
    --db-dir "${TMP}/worker-db" --cre-dir "${TMP}/cre" \
    --reports-dir "${TMP}/reports" --envelopes-dir "${TMP}/envelopes" \
    --config-path "${TMP}/worker-config.json" --issuer-pub "${TMP}/issuer-pub.pem" \
    --mint "${MINT}" --payee "${PAYEE_PUB}" --genesis "${RPC_GENESIS}" \
    --endpoint "${ENDPOINT}" --journal "${TMP}/worker-journal/journal.db" \
    --signer-key "${TMP}/keys/payer.json" --payer "${PAYER_PUB}" \
    --worker-uid "$(id -u)" > "${TMP}/seed.json"
  CFG="${TMP}/worker-config.json"
  DBP="${TMP}/worker-db/claims.db"
  ENV_PROCEED="${TMP}/envelopes/proceed.json"
  ENV_HELD="${TMP}/envelopes/held.json"
  LW="pnpm exec tsx tooling/supplier-payment/local-worker.ts"

  claim_state() {
    python3 -c "import sqlite3;d=sqlite3.connect('$DBP');r=d.execute('select state,signature from supplier_payment_claims').fetchall();print(r)"
  }
  consumed() {
    python3 -c "import sqlite3,json;d=sqlite3.connect('$DBP');b=d.execute('select budget_by_asset from funded_mandates').fetchone()[0];print(json.loads(b)['USDC']['consumedAmount'])"
  }

  # Warmup probe: a fresh validator can silently drop its first real
  # transaction. Prove the TPU path lands a trivial SOL transfer before the
  # governed dispatch — the probe goes through the same isolated CLI config
  # and temp keys, never the operator's wallet.
  for _ in $(seq 1 30); do
    solana -C "${CLI_CONFIG}" transfer --allow-unfunded-recipient \
      "${PAYEE_PUB}" 0.001 >>"${TMP}/spl.log" 2>&1 && break
    sleep 1
  done
  for _ in $(seq 1 30); do
    PAYEE_SOL="$(rpc getBalance "[\"${PAYEE_PUB}\",{\"commitment\":\"confirmed\"}]" \
      | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["value"])')"
    [ "${PAYEE_SOL}" = "1000000" ] && break
    sleep 1
  done
  [ "${PAYEE_SOL}" = "1000000" ] || { echo "FAIL: warmup transfer never landed"; exit 1; }

  echo ">> held envelope must deny before any dispatch"
  set +e
  HELD_OUT="$(${LW} execute --config "${CFG}" --envelope "${ENV_HELD}" 2>/dev/null)"
  HELD_RC=$?
  set -e
  [ "${HELD_RC}" = "3" ] || { echo "FAIL: held execute rc=${HELD_RC}"; exit 1; }
  echo "${HELD_OUT}" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; assert r["status"]=="denied", r'
  [ "$(claim_state)" = "[]" ] || { echo "FAIL: held left a claim row"; exit 1; }
  [ "$(consumed)" = "0" ] || { echo "FAIL: held debited"; exit 1; }
  [ "$(token_amount "${PAYEE_ATA}")" = "absent" ] || { echo "FAIL: held moved the payee ATA"; exit 1; }

  echo ">> proceed execute, crash after rail returns (before finalize)"
  set +e
  ${LW} execute --config "${CFG}" --envelope "${ENV_PROCEED}" --simulate-crash-after-send >/dev/null 2>&1
  CRASH_RC=$?
  set -e
  [ "${CRASH_RC}" = "42" ] || { echo "FAIL: crash exit code ${CRASH_RC}, expected 42"; exit 1; }
  [ "$(claim_state)" = "[('pending', None)]" ] || { echo "FAIL: claim not pending: $(claim_state)"; exit 1; }
  [ "$(consumed)" = "0" ] || { echo "FAIL: crash debited the mandate"; exit 1; }
  for _ in $(seq 1 30); do
    [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] && break; sleep 1
  done
  [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] || { echo "FAIL: chain transfer missing"; exit 1; }
  [ "$(token_amount "${PAYER_ATA}")" = "0" ] || { echo "FAIL: payer ATA not drained"; exit 1; }

  echo ">> fresh worker process: reconcile must finalize the pending claim"
  REC_OUT="$(${LW} reconcile --config "${CFG}" --envelope "${ENV_PROCEED}")"
  SIGNATURE="$(echo "${REC_OUT}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["signature"])')"
  [ "$(consumed)" = "10000" ] || { echo "FAIL: reconcile did not debit exactly once"; exit 1; }
  [ "$(claim_state)" = "[('confirmed', '${SIGNATURE}')]" ] || { echo "FAIL: claim not confirmed"; exit 1; }

  echo ">> replay the identical envelope — same signature, no second send or debit"
  REPLAY_OUT="$(${LW} execute --config "${CFG}" --envelope "${ENV_PROCEED}")"
  REPLAYED="$(echo "${REPLAY_OUT}" | python3 -c 'import json,sys;r=json.load(sys.stdin)["result"];assert r["status"]=="replayed",r;print(r["signature"])')"
  [ "${REPLAYED}" = "${SIGNATURE}" ] || { echo "FAIL: replay signature differs"; exit 1; }
  [ "$(consumed)" = "10000" ] || { echo "FAIL: replay double-debited"; exit 1; }
  [ "$(token_amount "${PAYER_ATA}")" = "0" ] || { echo "FAIL: replay moved payer ATA"; exit 1; }
  [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] || { echo "FAIL: replay moved payee ATA"; exit 1; }
  for _ in $(seq 1 30); do
    SIGS_POST="$(sig_count "${PAYEE_ATA}")"
    [ "${SIGS_POST}" -ge 1 ] 2>/dev/null && break; sleep 1
  done
  [ "${SIGS_POST}" = "1" ] || { echo "FAIL: payee ATA history ${SIGS_POST}, expected 1"; exit 1; }

  python3 - "${OUT}" <<PY
import json,sys,datetime
proof = {
  "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "generatedBy": "tooling/supplier-payment/local-proof.sh --governed",
  "validatorVersion": "$(solana-test-validator --version | awk '{print $2}')",
  "localGenesisHash": "${RPC_GENESIS}",
  "endpoint": "${ENDPOINT}",
  "cluster": "localnet",
  "payer": "${PAYER_PUB}",
  "payee": "${PAYEE_PUB}",
  "mint": "${MINT}",
  "payerAta": "${PAYER_ATA}",
  "payeeAta": "${PAYEE_ATA}",
  "held": {"status": "denied", "dispatched": False, "debit": "0"},
  "crashAfterSend": {"exitCode": 42, "claimState": "pending", "debit": "0", "chainTransfer": True},
  "reconcile": {"status": "confirmed", "signature": "${SIGNATURE}", "debit": "10000"},
  "replay": {"status": "replayed", "signature": "${REPLAYED}", "sends": 1},
  "payeeAtaSignatures": ${SIGS_POST},
  "note": "LOCAL governed-worker proof only — cluster localnet, local mint, synthetic report/CRE/issuer fixtures. Not devnet evidence; no real funding. Public keys and signatures only."
}
open(sys.argv[1],"w").write(json.dumps(proof, indent=2))
PY
  rm -rf "${TMP}"
  echo ">> governed worker proof written to ${OUT} (temp dir removed)"
  exit 0
fi

EXPIRES="2030-01-01T00:00:00.000Z"
COMMON="--endpoint ${ENDPOINT} --payer-key ${TMP}/keys/payer.json --payer ${PAYER_PUB} --payee ${PAYEE_PUB} --mint ${MINT} --journal ${TMP}/journal.db --workspace ws-local --mandate mandate-local --case case-local --intent-id local-proof-1 --expires ${EXPIRES}"

echo ">> dispatching the supplier transfer through the real adapter"
SEND_OUT="$(pnpm exec tsx tooling/supplier-payment/local-transfer.ts send ${COMMON})"
SIGNATURE="$(echo "${SEND_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["send"]["signature"])')"
CONF_STATUS="$(echo "${SEND_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["send"]["confirmationStatus"])')"
echo "   signature=${SIGNATURE} (${CONF_STATUS})"

for _ in $(seq 1 30); do
  PAYER_POST="$(token_amount "${PAYER_ATA}")"
  PAYEE_POST="$(token_amount "${PAYEE_ATA}")"
  [ "${PAYER_POST}" = "0" ] && [ "${PAYEE_POST}" = "10000" ] && break
  sleep 1
done
[ "${PAYER_POST}" = "0" ] || { echo "FAIL: payer ATA ${PAYER_POST}, expected 0"; exit 1; }
[ "${PAYEE_POST}" = "10000" ] || { echo "FAIL: payee ATA ${PAYEE_POST}, expected 10000"; exit 1; }
# The payee ATA must have exactly one transaction in its history — the
# idempotent create+transfer. Wait for finalized indexing so the count is
# real, not a lagged zero.
for _ in $(seq 1 30); do
  SIGS_AFTER_SEND="$(sig_count "${PAYEE_ATA}")"
  [ "${SIGS_AFTER_SEND}" -ge 1 ] 2>/dev/null && break
  sleep 1
done
[ "${SIGS_AFTER_SEND}" = "1" ] \
  || { echo "FAIL: payee ATA history has ${SIGS_AFTER_SEND} signatures, expected 1"; exit 1; }

echo ">> fresh process: recover from journal + chain, then replay the identical send"
RECOVER_OUT="$(pnpm exec tsx tooling/supplier-payment/local-transfer.ts recover ${COMMON})"
RECOVERED_SIG="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recovered"]["signature"])')"
RECOVERED_STATUS="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recovered"]["confirmationStatus"])')"
REPLAYED_SIG="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["replayedSignature"])')"

if [ "${SIGNATURE}" != "${RECOVERED_SIG}" ] || [ "${SIGNATURE}" != "${REPLAYED_SIG}" ]; then
  echo "FAIL: signatures differ (${SIGNATURE} vs ${RECOVERED_SIG} vs ${REPLAYED_SIG})"
  exit 1
fi

# Replay must not move anything: balances identical, payee ATA history
# unchanged (same transaction count — no second transfer).
PAYER_REPLAY="$(token_amount "${PAYER_ATA}")"
PAYEE_REPLAY="$(token_amount "${PAYEE_ATA}")"
SIGS_POST="$(sig_count "${PAYEE_ATA}")"
[ "${PAYER_REPLAY}" = "${PAYER_POST}" ] || { echo "FAIL: replay moved payer ATA"; exit 1; }
[ "${PAYEE_REPLAY}" = "${PAYEE_POST}" ] || { echo "FAIL: replay moved payee ATA"; exit 1; }
[ "${SIGS_POST}" = "${SIGS_AFTER_SEND}" ] || { echo "FAIL: payee ATA history grew ${SIGS_AFTER_SEND}->${SIGS_POST} on replay"; exit 1; }

python3 - "${OUT}" <<PY
import json,sys,datetime
proof = {
  "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "generatedBy": "tooling/supplier-payment/local-proof.sh",
  "validatorVersion": "$(solana-test-validator --version | awk '{print $2}')",
  "localGenesisHash": "${RPC_GENESIS}",
  "endpoint": "${ENDPOINT}",
  "cluster": "localnet",
  "payer": "${PAYER_PUB}",
  "payee": "${PAYEE_PUB}",
  "mint": "${MINT}",
  "payerAta": "${PAYER_ATA}",
  "payeeAta": "${PAYEE_ATA}",
  "signature": "${SIGNATURE}",
  "confirmationStatus": "${CONF_STATUS}",
  "recoveredSignature": "${RECOVERED_SIG}",
  "recoveredConfirmationStatus": "${RECOVERED_STATUS}",
  "replayedSignature": "${REPLAYED_SIG}",
  "sends": 1,
  "payeeAtaSignatures": ${SIGS_POST},
  "balances": {
    "payerBefore": "${PAYER_PRE}",
    "payerAfter": "${PAYER_POST}",
    "payerAfterReplay": "${PAYER_REPLAY}",
    "payeeBefore": "${PAYEE_PRE}",
    "payeeAfter": "${PAYEE_POST}",
    "payeeAfterReplay": "${PAYEE_REPLAY}"
  },
  "note": "LOCAL validator proof only — cluster localnet, local mint. Not devnet evidence. Public keys and signatures only; no secret material."
}
open(sys.argv[1],"w").write(json.dumps(proof, indent=2))
PY

rm -rf "${TMP}"
echo ">> proof written to ${OUT} (temp dir removed)"
