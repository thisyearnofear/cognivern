#!/usr/bin/env bash
# Local-validator proof for the supplier payment rail. Everything is
# loopback-only and disposable: fresh ledger, ephemeral keys, local SPL
# mint. Writes a public-only proof to .artifacts/ plus a bounded text
# diagnostic, and tears down only what this run created.
#
#   bash tooling/supplier-payment/local-proof.sh \
#     [--governed] [--scratch-dir <path>] [--keep-failed-ledger]
#
# Platform policy: Linux runs anywhere with >=2GiB free on the scratch
# filesystem. macOS is denied by default — a real validator needs a
# capacity-limited disk; explicit opt-in requires BOTH --allow-macos and
# --scratch-dir pointing at an already-mounted, capacity-limited separate
# scratch filesystem (e.g. /Volumes/SupplierProof, total 2-8GiB, on a
# different device than / and /private/tmp). The script never creates,
# mounts, or deletes volumes, and never runs anything but its own
# disposable validator on loopback.

# Resolved for main() — sourcing this file for its helpers must be free of
# side effects (no cd, no umask change in the caller's shell).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

GOVERNED=0
ALLOW_MACOS=0
KEEP_FAILED_LEDGER=0
SCRATCH_DIR=""
TMP=""
VALIDATOR_PID=""
PROOF_PHASE="init"
OUT=".artifacts/supplier-local-validator-proof.json"
DIAG=".artifacts/supplier-proof-diagnostic.txt"

die() { echo "FAIL: $*" >&2; exit 1; }
phase() { PROOF_PHASE="$1"; echo ">> $1"; }

usage() {
  cat <<'EOF'
usage: local-proof.sh [--governed] [--allow-macos] [--scratch-dir <path>]
                      [--keep-failed-ledger] [--help]

  --governed            run the governed local-worker proof as well
  --allow-macos         permit running on macOS — REQUIRES --scratch-dir
                        pointing at an already-mounted, capacity-limited
                        separate scratch filesystem (never the root or
                        shared Data volume)
  --scratch-dir <path>  scratch filesystem/dir for all temp state
                        (Linux: defaults to $RUNNER_TEMP or /tmp)
  --keep-failed-ledger  on FAILURE only, retain the validator ledger for
                        diagnosis (contains its own temp credentials —
                        private, never upload)
  --help                this message
EOF
}

# ------------------------------------------------------------------ guards

min_free_ok() { # <path> <required GiB>
  python3 - "$1" "$2" <<'PY'
import os,sys
v = os.statvfs(sys.argv[1])
sys.exit(0 if v.f_frsize * v.f_bavail >= int(sys.argv[2]) * 1024**3 else 1)
PY
}

# Darwin scratch must be an already-mounted separate filesystem: its own
# mountpoint, a different device than BOTH / and /private/tmp (a shared
# APFS Data volume reports container capacity — refuse rather than guess),
# capacity-limited to 2..8GiB total with >=2GiB free, and the given path
# must canonicalize to itself (no symlink, no unnormalized input).
macos_scratch_ok() {
  python3 - "$1" <<'PY'
import os,sys
p = sys.argv[1]
if os.path.islink(p): sys.exit(1)
real = os.path.realpath(p)
if real != os.path.abspath(p): sys.exit(1)
if not os.path.isdir(real) or not os.path.ismount(real): sys.exit(1)
dev = os.stat(real).st_dev
for ref in ('/', '/private/tmp', os.path.expanduser('~')):
    if dev == os.stat(ref).st_dev: sys.exit(1)
v = os.statvfs(real)
gib = 1024**3
total, free = v.f_frsize * v.f_blocks, v.f_frsize * v.f_bavail
sys.exit(0 if 2*gib <= total <= 8*gib and free >= 2*gib else 1)
PY
}

# ------------------------------------------------------------------ cleanup

# Bounded public diagnostic: fixed fields only (phase + exit code + mode),
# capped at 4KiB — never raw logs, which could carry key material.
write_diagnostic() {
  local rc="$1"
  mkdir -p .artifacts 2>/dev/null || true
  {
    echo "generatedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "script=local-proof.sh"
    echo "mode=$( [ "${GOVERNED}" = "1" ] && echo governed || echo plain )"
    echo "phase=${PROOF_PHASE}"
    echo "exit=${rc}"
    echo "os=$(uname -s) $(uname -m)"
    echo "out=${OUT}"
  } | head -c 4096 >"${DIAG}" 2>/dev/null || true
}

# Owns teardown for this run only: the captured validator PID (bounded TERM
# wait, KILL only that PID if it refuses), then removal of ONLY this run's
# mktemp workspace. With --keep-failed-ledger and a nonzero exit, removes
# everything except the ledger dir and keeps that (private — its own temp
# credentials live inside; never upload). Sibling temp dirs of other runs
# are never touched.
cleanup() {
  local rc="${PROOF_RC:-$?}"
  # Teardown is uninterruptible: repeated INT/TERM/HUP during cleanup are
  # ignored so a second signal cannot mask the original exit code or
  # abandon the kill/rm sequence mid-flight.
  trap '' INT TERM HUP
  set +e
  write_diagnostic "${rc}"
  if [ -n "${VALIDATOR_PID}" ] && kill -0 "${VALIDATOR_PID}" 2>/dev/null; then
    kill "${VALIDATOR_PID}" 2>/dev/null
    for _ in $(seq 1 50); do
      kill -0 "${VALIDATOR_PID}" 2>/dev/null || break
      sleep 0.2
    done
    if kill -0 "${VALIDATOR_PID}" 2>/dev/null; then
      kill -9 "${VALIDATOR_PID}" 2>/dev/null
    fi
    wait "${VALIDATOR_PID}" 2>/dev/null
  fi
  if [ -n "${TMP}" ] && [ -d "${TMP}" ]; then
    if [ "${rc}" != "0" ] && [ "${KEEP_FAILED_LEDGER}" = "1" ] && [ -d "${TMP}/ledger" ]; then
      find "${TMP}" -mindepth 1 -maxdepth 1 ! -name ledger -exec rm -rf {} +
      echo ">> failure: retained ONLY ${TMP}/ledger for diagnosis" \
        "(contains its own temp credentials — private, never upload)" >&2
    else
      rm -rf "${TMP}"
    fi
  fi
  return "${rc:-0}" 2>/dev/null || true
}

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

# -------------------------------------------------------------------- main

main() {
  set -euo pipefail
  umask 077
  cd "${REPO_ROOT}"
  while [ $# -gt 0 ]; do
    case "$1" in
      --governed) GOVERNED=1 ;;
      --allow-macos) ALLOW_MACOS=1 ;;
      --scratch-dir)
        shift
        [ $# -gt 0 ] || die "--scratch-dir requires a path argument"
        case "$1" in -*) die "--scratch-dir value must be a path, not a flag";; esac
        SCRATCH_DIR="$1" ;;
      --keep-failed-ledger) KEEP_FAILED_LEDGER=1 ;;
      --help|-h) usage; exit 0 ;;
      *) die "unknown flag: $1" ;;
    esac
    shift
  done

  if [ "${GOVERNED}" = "1" ]; then
    OUT=".artifacts/supplier-worker-local-proof.json"
  fi

  # Platform + disk guards run before ANY temp dir, key, or dependency is
  # touched. macOS is denied without an explicit opt-in AND a verified
  # capacity-limited mounted scratch filesystem.
  OS_NAME="$(uname -s)"
  if [ "${OS_NAME}" = "Darwin" ]; then
    [ "${ALLOW_MACOS}" = "1" ] || die \
      "macOS is not permitted without --allow-macos and a mounted, capacity-limited --scratch-dir (run the hosted proof in CI instead)"
    [ -n "${SCRATCH_DIR}" ] || die "--allow-macos requires --scratch-dir at a mounted scratch filesystem"
    macos_scratch_ok "${SCRATCH_DIR}" || die \
      "--scratch-dir is not an approved scratch mount (needs its own mounted filesystem, 2-8GiB total, >=2GiB free, different device than / and /private/tmp)"
    min_free_ok /private/tmp 12 || die "host /private/tmp has under 12GiB free"
    min_free_ok "${REPO_ROOT}" 12 || die "repo filesystem has under 12GiB free"
  else
    SCRATCH_DIR="${SCRATCH_DIR:-${RUNNER_TEMP:-/tmp}}"
    case "${SCRATCH_DIR}" in /*) ;; *) die "scratch dir ${SCRATCH_DIR} must be an absolute path";; esac
    [ -d "${SCRATCH_DIR}" ] || die "scratch dir ${SCRATCH_DIR} must already exist as a directory"
    [ ! -L "${SCRATCH_DIR}" ] || die "scratch dir ${SCRATCH_DIR} is a symlink"
    min_free_ok "${SCRATCH_DIR}" 2 || die "scratch dir ${SCRATCH_DIR} has under 2GiB free"
  fi

  for dep in solana-test-validator solana solana-keygen spl-token python3 curl pnpm; do
    command -v "${dep}" >/dev/null 2>&1 || die "missing dependency: ${dep}"
  done

  TMP="$(TMPDIR="${SCRATCH_DIR}" mktemp -d "${SCRATCH_DIR}/supplier-local-proof.XXXXXX")" \
    || die "could not create temp workspace under ${SCRATCH_DIR}"
  export TMPDIR="${TMP}"
  trap 'PROOF_RC=$?; cleanup; exit ${PROOF_RC}' EXIT
  trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP

  RPC_PORT=18899          # RPC ws is auto-bound at rpc+1 (18900)
  FAUCET_PORT=18901       # must NOT collide with the RPC ws port
  GOSSIP_RANGE="18910-18940"
  ENDPOINT="http://127.0.0.1:${RPC_PORT}"

  mkdir -p .artifacts "${TMP}/keys"
  chmod 700 "${TMP}" "${TMP}/keys"

  phase "generating ephemeral local keys"
  for name in payer payee; do
    solana-keygen new --no-bip39-passphrase --silent --outfile "${TMP}/keys/${name}.json" >/dev/null
    chmod 600 "${TMP}/keys/${name}.json"
  done
  PAYER_PUB="$(solana-keygen pubkey "${TMP}/keys/payer.json")"
  PAYEE_PUB="$(solana-keygen pubkey "${TMP}/keys/payee.json")"
  echo "   payer=${PAYER_PUB}"
  echo "   payee=${PAYEE_PUB}"

  # Isolated Solana CLI configuration — never reads or writes the
  # operator's default ~/.config/solana identity.
  CLI_CONFIG="${TMP}/cli-config.yml"
  solana config set -C "${CLI_CONFIG}" --url "${ENDPOINT}" \
    --keypair "${TMP}/keys/payer.json" >/dev/null

  phase "starting solana-test-validator $(solana-test-validator --version | awk '{print $2}')"
  solana-test-validator \
    --ledger "${TMP}/ledger" \
    --bind-address 127.0.0.1 \
    --rpc-port "${RPC_PORT}" \
    --faucet-port "${FAUCET_PORT}" \
    --dynamic-port-range "${GOSSIP_RANGE}" \
    --mint "${PAYER_PUB}" \
    --reset >"${TMP}/validator.log" 2>&1 &
  VALIDATOR_PID=$!

  phase "waiting for typed health on ${ENDPOINT}"
  for _ in $(seq 1 60); do
    HEALTH="$(rpc getHealth '[]')" || true
    if echo "${HEALTH}" | grep -q '"result":"ok"'; then break; fi
    sleep 1
  done
  echo "${HEALTH}" | grep -q '"result":"ok"' || {
    echo "validator never became healthy"; tail -30 "${TMP}/validator.log"; exit 1; }

  # The RPC we talk to must be the validator we spawned: the child pid is
  # alive AND the chain genesis matches the genesis in our spawned log.
  kill -0 "${VALIDATOR_PID}" || die "spawned validator died"
  for _ in $(seq 1 30); do
    LOG_GENESIS="$(grep -o 'genesis hash: [A-Za-z0-9]*' "${TMP}/ledger/validator.log" | head -1 | awk '{print $3}' || true)"
    [ -n "${LOG_GENESIS}" ] && break
    sleep 1
  done
  RPC_GENESIS="$(rpc getGenesisHash '[]' | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"])')"
  if [ -z "${LOG_GENESIS}" ] || [ "${LOG_GENESIS}" != "${RPC_GENESIS}" ]; then
    die "RPC genesis ${RPC_GENESIS} is not the spawned validator genesis ${LOG_GENESIS}"
  fi
  echo "   genesis=${RPC_GENESIS} (verified owned by spawned validator)"

  phase "creating local SPL mint (6 decimals) and funding the payer ATA"
  # A fresh validator briefly reports programs "not deployed" during
  # warmup — create-token fails at preflight so nothing is broadcast and a
  # bounded retry is safe (a retry only happens on CLI failure).
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
  [ -n "${MINT}" ] || die "could not create SPL mint"
  PAYER_ATA="$(pnpm exec tsx tooling/supplier-payment/ata-of.ts --mint "${MINT}" --owner "${PAYER_PUB}")"
  PAYEE_ATA="$(pnpm exec tsx tooling/supplier-payment/ata-of.ts --mint "${MINT}" --owner "${PAYEE_PUB}")"
  for _ in $(seq 1 15); do
    spl-token -C "${CLI_CONFIG}" create-account "${MINT}" --owner "${PAYER_PUB}" \
      --fee-payer "${TMP}/keys/payer.json" >>"${TMP}/spl.log" 2>&1 && break
    sleep 1
  done
  # Mint exactly once — an ambiguous retry could double-mint. On failure
  # the balance check decides: exactly 10000 base units or nothing.
  spl-token -C "${CLI_CONFIG}" mint "${MINT}" 0.01 "${PAYER_ATA}" \
    --fee-payer "${TMP}/keys/payer.json" --owner "${TMP}/keys/payer.json" \
    >>"${TMP}/spl.log" 2>&1 || true
  for _ in $(seq 1 30); do
    PAYER_PRE="$(token_amount "${PAYER_ATA}")"
    [ "${PAYER_PRE}" = "10000" ] && break
    sleep 1
  done
  [ "${PAYER_PRE}" = "10000" ] || die "payer ATA has ${PAYER_PRE}, expected 10000"
  PAYEE_PRE="$(token_amount "${PAYEE_ATA}")"
  [ "${PAYEE_PRE}" = "absent" ] || die "payee ATA unexpectedly present (${PAYEE_PRE})"
  # Broadcast only once the funding transactions are FINALIZED — a fresh
  # validator can silently drop transactions sent during its warmup window.
  for _ in $(seq 1 60); do
    [ "$(token_amount "${PAYER_ATA}" finalized)" = "10000" ] && break
    sleep 1
  done
  [ "$(token_amount "${PAYER_ATA}" finalized)" = "10000" ] \
    || die "payer ATA funding never finalized"
  echo "   mint=${MINT} payerAta=${PAYER_PRE} payeeAta=absent (funding finalized)"

  if [ "${GOVERNED}" = "1" ]; then
    governed_proof
    exit 0
  fi
  plain_proof
  exit 0
}

# -------------------------------------------------------------- plain proof

plain_proof() {
  local EXPIRES="2030-01-01T00:00:00.000Z"
  local COMMON=(
    --endpoint "${ENDPOINT}" --payer-key "${TMP}/keys/payer.json"
    --payer "${PAYER_PUB}" --payee "${PAYEE_PUB}" --mint "${MINT}"
    --journal "${TMP}/journal.db" --workspace ws-local
    --mandate mandate-local --case case-local --intent-id local-proof-1
    --expires "${EXPIRES}"
  )

  phase "dispatching the supplier transfer through the real adapter"
  SEND_OUT="$(pnpm exec tsx tooling/supplier-payment/local-transfer.ts send "${COMMON[@]}")"
  SIGNATURE="$(echo "${SEND_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["send"]["signature"])')"
  CONF_STATUS="$(echo "${SEND_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["send"]["confirmationStatus"])')"
  echo "   signature=${SIGNATURE} (${CONF_STATUS})"

  for _ in $(seq 1 30); do
    PAYER_POST="$(token_amount "${PAYER_ATA}")"
    PAYEE_POST="$(token_amount "${PAYEE_ATA}")"
    [ "${PAYER_POST}" = "0" ] && [ "${PAYEE_POST}" = "10000" ] && break
    sleep 1
  done
  [ "${PAYER_POST}" = "0" ] || die "payer ATA ${PAYER_POST}, expected 0"
  [ "${PAYEE_POST}" = "10000" ] || die "payee ATA ${PAYEE_POST}, expected 10000"
  # The payee ATA must have exactly one transaction in its history — the
  # idempotent create+transfer. Wait for finalized indexing so the count
  # is real, not a lagged zero.
  for _ in $(seq 1 30); do
    SIGS_AFTER_SEND="$(sig_count "${PAYEE_ATA}")"
    [ "${SIGS_AFTER_SEND}" -ge 1 ] 2>/dev/null && break
    sleep 1
  done
  [ "${SIGS_AFTER_SEND}" = "1" ] \
    || die "payee ATA history has ${SIGS_AFTER_SEND} signatures, expected 1"

  phase "fresh process: recover from journal + chain, then replay the identical send"
  RECOVER_OUT="$(pnpm exec tsx tooling/supplier-payment/local-transfer.ts recover "${COMMON[@]}")"
  RECOVERED_SIG="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recovered"]["signature"])')"
  RECOVERED_STATUS="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recovered"]["confirmationStatus"])')"
  REPLAYED_SIG="$(echo "${RECOVER_OUT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["replayedSignature"])')"

  if [ "${SIGNATURE}" != "${RECOVERED_SIG}" ] || [ "${SIGNATURE}" != "${REPLAYED_SIG}" ]; then
    die "signatures differ (${SIGNATURE} vs ${RECOVERED_SIG} vs ${REPLAYED_SIG})"
  fi

  # Replay must not move anything: balances identical, payee ATA history
  # unchanged (same transaction count — no second transfer).
  PAYER_REPLAY="$(token_amount "${PAYER_ATA}")"
  PAYEE_REPLAY="$(token_amount "${PAYEE_ATA}")"
  SIGS_POST="$(sig_count "${PAYEE_ATA}")"
  [ "${PAYER_REPLAY}" = "${PAYER_POST}" ] || die "replay moved payer ATA"
  [ "${PAYEE_REPLAY}" = "${PAYEE_POST}" ] || die "replay moved payee ATA"
  [ "${SIGS_POST}" = "${SIGS_AFTER_SEND}" ] \
    || die "payee ATA history grew ${SIGS_AFTER_SEND}->${SIGS_POST} on replay"

  python3 - "${OUT}" "${SIGNATURE}" "${CONF_STATUS}" "${RECOVERED_SIG}" \
    "${RECOVERED_STATUS}" "${REPLAYED_SIG}" "${SIGS_POST}" \
    "${PAYER_PRE}" "${PAYER_POST}" "${PAYER_REPLAY}" \
    "${PAYEE_PRE}" "${PAYEE_POST}" "${PAYEE_REPLAY}" \
    "$(solana-test-validator --version | awk '{print $2}')" \
    "${RPC_GENESIS}" "${ENDPOINT}" "${PAYER_PUB}" "${PAYEE_PUB}" \
    "${MINT}" "${PAYER_ATA}" "${PAYEE_ATA}" <<'PY'
import json,sys,datetime
(a,sig,conf,rsig,rconf,replay,sigs,pb,pa,par,kb,ka,kar,
 ver,gen,ep,payer,payee,mint,pata,kata) = sys.argv[1:]
proof = {
  "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "generatedBy": "tooling/supplier-payment/local-proof.sh",
  "validatorVersion": ver, "localGenesisHash": gen, "endpoint": ep,
  "cluster": "localnet", "payer": payer, "payee": payee, "mint": mint,
  "payerAta": pata, "payeeAta": kata,
  "signature": sig, "confirmationStatus": conf,
  "recoveredSignature": rsig, "recoveredConfirmationStatus": rconf,
  "replayedSignature": replay, "sends": 1,
  "payeeAtaSignatures": int(sigs),
  "balances": {"payerBefore": pb, "payerAfter": pa, "payerAfterReplay": par,
               "payeeBefore": kb, "payeeAfter": ka, "payeeAfterReplay": kar},
  "note": "LOCAL validator proof only — cluster localnet, local mint. Not devnet evidence. Public keys and signatures only; no secret material."
}
open(a,"w").write(json.dumps(proof, indent=2))
PY
  phase "proof written to ${OUT} (temp workspace removed by trap)"
}

# ----------------------------------------------------------- governed proof

governed_proof() {
  # Same validator + mint, but the transfer is dispatched through
  # local-worker.ts → createLocalSupplierExecutor → the real rail adapter,
  # with a real worker-private SQLite DB and a read-only CRE JSONL
  # snapshot. Held must never dispatch; a crash between send and finalize
  # must stay pending with no debit; reconcile confirms exactly once.
  phase "governed worker proof: seeding temp DB, CRE snapshot, reports, issuer"
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

  claim_state() {
    python3 - "${DBP}" <<'PY'
import sqlite3,sys
d=sqlite3.connect(sys.argv[1])
print(d.execute('select state,signature from supplier_payment_claims').fetchall())
PY
  }
  consumed() {
    python3 - "${DBP}" <<'PY'
import sqlite3,sys,json
d=sqlite3.connect(sys.argv[1])
b=d.execute('select budget_by_asset from funded_mandates').fetchone()[0]
print(json.loads(b)['USDC']['consumedAmount'])
PY
  }

  # Warmup probe: a fresh validator can silently drop its first real
  # transaction. Prove the TPU path lands a trivial SOL transfer before the
  # governed dispatch — the probe goes through the same isolated CLI
  # config and temp keys, never the operator's wallet.
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
  [ "${PAYEE_SOL}" = "1000000" ] || die "warmup transfer never landed"

  phase "held envelope must deny before any dispatch"
  set +e
  HELD_OUT="$(pnpm exec tsx tooling/supplier-payment/local-worker.ts execute \
    --config "${CFG}" --envelope "${ENV_HELD}" 2>/dev/null)"
  HELD_RC=$?
  set -e
  [ "${HELD_RC}" = "3" ] || die "held execute rc=${HELD_RC}"
  echo "${HELD_OUT}" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; assert r["status"]=="denied", r'
  [ "$(claim_state)" = "[]" ] || die "held left a claim row"
  [ "$(consumed)" = "0" ] || die "held debited"
  [ "$(token_amount "${PAYEE_ATA}")" = "absent" ] || die "held moved the payee ATA"

  phase "proceed execute, crash after rail returns (before finalize)"
  set +e
  pnpm exec tsx tooling/supplier-payment/local-worker.ts execute \
    --config "${CFG}" --envelope "${ENV_PROCEED}" \
    --simulate-crash-after-send >/dev/null 2>&1
  CRASH_RC=$?
  set -e
  [ "${CRASH_RC}" = "42" ] || die "crash exit code ${CRASH_RC}, expected 42"
  [ "$(claim_state)" = "[('pending', None)]" ] || die "claim not pending: $(claim_state)"
  [ "$(consumed)" = "0" ] || die "crash debited the mandate"
  for _ in $(seq 1 30); do
    [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] && break; sleep 1
  done
  [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] || die "chain transfer missing"
  [ "$(token_amount "${PAYER_ATA}")" = "0" ] || die "payer ATA not drained"

  phase "fresh worker process: reconcile must finalize the pending claim"
  REC_OUT="$(pnpm exec tsx tooling/supplier-payment/local-worker.ts reconcile \
    --config "${CFG}" --envelope "${ENV_PROCEED}")"
  SIGNATURE="$(echo "${REC_OUT}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["signature"])')"
  [ "$(consumed)" = "10000" ] || die "reconcile did not debit exactly once"
  [ "$(claim_state)" = "[('confirmed', '${SIGNATURE}')]" ] || die "claim not confirmed"

  phase "replay the identical envelope — same signature, no second send or debit"
  REPLAY_OUT="$(pnpm exec tsx tooling/supplier-payment/local-worker.ts execute \
    --config "${CFG}" --envelope "${ENV_PROCEED}")"
  REPLAYED="$(echo "${REPLAY_OUT}" | python3 -c 'import json,sys;r=json.load(sys.stdin)["result"];assert r["status"]=="replayed",r;print(r["signature"])')"
  [ "${REPLAYED}" = "${SIGNATURE}" ] || die "replay signature differs"
  [ "$(consumed)" = "10000" ] || die "replay double-debited"
  [ "$(token_amount "${PAYER_ATA}")" = "0" ] || die "replay moved payer ATA"
  [ "$(token_amount "${PAYEE_ATA}")" = "10000" ] || die "replay moved payee ATA"
  for _ in $(seq 1 30); do
    SIGS_POST="$(sig_count "${PAYEE_ATA}")"
    [ "${SIGS_POST}" -ge 1 ] 2>/dev/null && break; sleep 1
  done
  [ "${SIGS_POST}" = "1" ] || die "payee ATA history ${SIGS_POST}, expected 1"

  python3 - "${OUT}" "${SIGNATURE}" "${REPLAYED}" "${SIGS_POST}" \
    "$(solana-test-validator --version | awk '{print $2}')" \
    "${RPC_GENESIS}" "${ENDPOINT}" "${PAYER_PUB}" "${PAYEE_PUB}" \
    "${MINT}" "${PAYER_ATA}" "${PAYEE_ATA}" <<'PY'
import json,sys,datetime
(a,sig,replay,sigs,ver,gen,ep,payer,payee,mint,pata,kata) = sys.argv[1:]
proof = {
  "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "generatedBy": "tooling/supplier-payment/local-proof.sh --governed",
  "validatorVersion": ver, "localGenesisHash": gen, "endpoint": ep,
  "cluster": "localnet", "payer": payer, "payee": payee, "mint": mint,
  "payerAta": pata, "payeeAta": kata,
  "held": {"status": "denied", "dispatched": False, "debit": "0"},
  "crashAfterSend": {"exitCode": 42, "claimState": "pending", "debit": "0", "chainTransfer": True},
  "reconcile": {"status": "confirmed", "signature": sig, "debit": "10000"},
  "replay": {"status": "replayed", "signature": replay, "sends": 1},
  "payeeAtaSignatures": int(sigs),
  "note": "LOCAL governed-worker proof only — cluster localnet, local mint, synthetic report/CRE/issuer fixtures. Not devnet evidence; no real funding. Public keys and signatures only."
}
open(a,"w").write(json.dumps(proof, indent=2))
PY
  phase "governed worker proof written to ${OUT} (temp workspace removed by trap)"
}

# Sourcing defines the helpers only — main() runs exclusively when the
# file itself is invoked, never on `source` or an env variable.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
