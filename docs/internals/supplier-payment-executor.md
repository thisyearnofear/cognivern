# Supplier payment executor (Gate 2)

Backend-only executor for a signed supplier-payment authorization, living in
`src/backend/services/telegraph/`:

- `SupplierPaymentAuthorization.ts` — shared strict-envelope schema, Ed25519
  signature verification over `canonicalJson(body)`, and the full evidence
  review. Two purposes, deliberately domain-separated:
  - `cognivern.supplier-payment-rehearsal.v1` (`reviewSupplierPayment`) can
    never move funds — it is the Gate 1 offline rehearsal schema only.
  - `cognivern.supplier-payment-devnet.v1` (`reviewSupplierDevnetPayment`) is
    the only schema the executor accepts; identical fixed devnet terms
    (cluster `devnet`, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`,
    `10000` base units = 0.01 USDC).
- `SupplierPaymentStore.ts` — durable `supplier_payment_claims` table in the
  same SQLite database as `FundedMandateService`. Schema is created only by
  `initSupplierPaymentClaims(db)` in tests/explicit construction — it is NOT
  wired into `src/backend/db/index.ts` migrations, so dev/prod databases are
  untouched. Single-use claims: `PRIMARY KEY (workspace_id, intent_id)` plus
  `UNIQUE (workspace_id, mandate_id, report_hash, case_id)` and
  `UNIQUE (signature)`; the mandate is dedicated — any prior claim
  exhausts the durable 0.01 ceiling, and mandate allocations above
  10000 base units are refused; `finalizeClaim` re-reads the identical pending
  binding and calls `FundedMandateService.consumeBudget` once inside one
  `.immediate()` transaction.
- `SupplierPaymentExecutor.ts` — `executeSupplierPayment(workspaceId,
  envelope, deps)` and `reconcileSupplierPayment(...)`.

## What is enabled / tested

- No HTTP endpoint, no API scope, no UI change. The module is exercised only
  through its exported functions.
- `SupplierPaymentRail` is an injected dependency. A real implementation now
  exists in `tooling/supplier-payment/` (see "Rail adapter" below): a
  devnet-pinned factory (`createSupplierDevnetRail`) and a local-validator
  factory (`createLocalSupplierRail`). It is a standalone tooling module —
  it is not imported by the API or the executor's server wiring, exposes no
  raw send CLI or route, and its signer loader requires an explicitly
  supplied dedicated key file. The backend never touches it by default.
- The legacy compliant-call path is untouched and cannot spend through this
  executor: the signer key is configured per-deployment for this executor
  only — the issuer's Ed25519 approval key (`config.trustedPublicKey`,
   signature verification only) is distinct from the dedicated on-chain
   payer signer, which the rail loads from its own permission-checked key
   file — and no singleton key is shared.
- Tested: happy path (execute once → confirmed → single mandate debit),
  completed replay of an identical envelope returning the stored signature
  with exhausted budget, conflicting same-intent/new-intent claims, pending
  claims surviving "re-instantiation" and never redispatching, receipt
  mismatch staying pending, reconciliation via `fetchReceipt`, and denial
  paths (rehearsal schema, wrong workspace/mandate, disabled deployment,
  unpinned payee, altered report bytes, approval-released run, unpaid
  parent) — all with zero broadcasts and zero debits.

## Rail adapter (`tooling/supplier-payment/`)

A real `SupplierPaymentRail` implementation, isolated from the API and from
`SolanaSettlementService` (which it only follows as a build pattern — no
import, no shared signer).

- `rail.ts` — `createSupplierDevnetRail` pins the official devnet endpoint,
  full genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, devnet USDC
  mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, and a canonical
  workspace/mandate/case/payee scope. `createLocalSupplierRail` is the
  local-only twin: it requires a loopback-IP endpoint and a non-public-chain
  genesis, so a local validator receipt can never be substituted for devnet
  evidence. Both re-check genesis on the same RPC before every send and
  every recovery, and both reject any request that does not match the
  pinned scope, mint, amount `10000`, and expiry.
- `signer.ts` — loads a dedicated key file only: explicit path, mandatory
  expected-pubkey match (no default wallet), `lstat` on the parent dir and
  file (symlinks refused at both levels), file and dir owned by the
  calling uid (`process.getuid`), file mode 0600, parent dir 0700, read
  through a single `O_RDONLY | O_NOFOLLOW` fd, 64-byte JSON array with
  every byte 0–255. OS-level isolation (separate Unix user) is still a
  deployment requirement — file ACLs alone do not stop the backend user
  on a shared host.
- `journal.ts` — single-intent SQLite journal (`synchronous=FULL`) in a
  dedicated private on-disk path (no `:memory:`/anonymous temp for the
  devnet rail). Records an immutable deployment-binding hash in
  `journal_meta` (cluster/genesis/workspace/mandate/case/pins/payer/
  payee/mint/amount) — journals opened under a different deployment fail
  closed, as do legacy records written before the binding existed. Durable
  claim row before any signing, signature + source/dest ATAs recorded
  before broadcast, no TTL/purge, no re-sign or re-send on duplicate or
  ambiguous outcomes. Recovery only replays an *identical* binding —
  changed terms conflict. `fetchReceipt(intentId)` re-verifies genesis on
  the same RPC, checks the journal record against the immutable binding,
  recomputes the expected ATAs, then verifies the chain only.
- `receipt.ts` — `verifyTransferOnChain` builds a receipt exclusively from
  chain state: `getSignatureStatuses` confirmed/finalized (null = not
  confirmed), `getTransaction` jsonParsed `meta.err === null`,
  `signatures[0]` equals the pinned signature, the first account is the
  signer and exactly one account signed, exactly the ATA
  `createIdempotent` + `transferChecked` pair for the derived
  ATAs/mint/amount/authority on the canonical token program, source
  pre+post balance rows and a dest post row are required, no duplicate
  `accountIndex`, non-negative raw amounts, and exact −10000/+10000
  deltas. Partial or ambiguous transactions fail closed — a receipt is
  never reconstructed from the journal.
- `local-transfer.ts` — scoped `send`/`recover` entry points used by the
  proof script; every argument is the pinned deployment scope, not a
  general-purpose transfer CLI.
- `local-proof.sh` — spins up a disposable `solana-test-validator` on
  loopback (fresh temp ledger, unique ports, isolated CLI config, kills
  only its own pid after verifying the RPC genesis matches the spawned
  ledger log), creates a local 6-decimal mint, waits until the funding
  is finalized before broadcasting (fresh validators silently drop early
  transactions), dispatches a real 10000-base-unit transfer through the
  adapter, then in a fresh process recovers the receipt from the journal
  + chain and replays the identical send — asserting the same signature,
  exact balance deltas before/after/replay, and exactly one entry in the
  payee ATA signature history. Public-only proof:
  `.artifacts/supplier-local-validator-proof.json`.

  Strict flags: `--governed`, `--allow-macos`, `--scratch-dir <path>`,
  `--keep-failed-ledger`, `--help`; anything else refuses. Disk policy:
  Linux uses `--scratch-dir` / `$RUNNER_TEMP` / `/tmp` with ≥2GiB free.
  **macOS is denied by default** — an explicit opt-in requires both
  `--allow-macos` and a `--scratch-dir` that is an already-mounted,
  capacity-limited separate scratch filesystem (its own mountpoint,
  2–8GiB total, ≥2GiB free, a different device than `/` and
  `/private/tmp`, no symlinks; a shared APFS Data volume reports
  container capacity so it is refused rather than guessed). The script
  never creates, mounts, or deletes volumes — provisioning a scratch
  image is a manual, operator-only step and not documented as an
  automated path. Host `/private/tmp` and the repo filesystem must also
  have ≥12GiB free on macOS. All temp state lives in one
  `mktemp -d …/supplier-local-proof.XXXXXX` workspace under the scratch
  dir (`umask 077`, `TMPDIR` exported there); an EXIT/INT/TERM/HUP trap
  stops only the captured validator pid (bounded TERM wait, KILL if it
  refuses), then removes only that workspace — on failure with
  `--keep-failed-ledger` it keeps ONLY the ledger dir (which holds its
  own temp credentials: private, never upload) and still removes keys,
  DBs, envelopes, and CLI config. Every run writes a fixed-field
  ≤4KiB diagnostic to `.artifacts/supplier-proof-diagnostic.txt`
  (phase + exit code only — never raw logs).
- `devnet-preflight.ts` — read-only devnet check. Takes only public
  addresses; verifies genesis, then takes a single confirmed
  `getMultipleAccounts([mint, payer, payee, payerAta, payeeAta])` snapshot
  at one slot — system-owned non-executable payer/payee, parsed token
  accounts checked for owner/mint/type/state initialized/decimals/not
  frozen, absent accounts reported as known-zero vs unreadable-unknown,
  exact 10000 payer units required (over-cap is not ready). Writes
  public-only `.artifacts/supplier-devnet-preflight.json`. Latest run:
  genesis matched, mint present (Tokenkeg, 6 decimals), keys unfunded —
  `ready: false`, the manual funding gate. `ready` is a chain preflight
  only; OS signer isolation is not proven by it.
- `generate-devnet-keys.ts` — generates the durable devnet-only payer/payee
  keypairs under `~/.config/cognivern-supplier-devnet/` (dir 0700, files
  0600, atomic no-clobber, symlink refused). Public keys are recorded for
  the preflight; no seed material is ever printed, logged, or committed.

## Governed worker (`tooling/supplier-payment/`)

The worker is the non-HTTP composition of the executor — a CLI that runs
the full Gate 2 evidence review plus the rail, for deployments where the
payment actor must not be the API process.

- `worker-common.ts` — parses a fixed, service-owned JSON config file into
  `DevnetWorkerConfig` or `LocalWorkerConfig`. All trusted inputs are
  config-pinned (workspace/mandate/case, payee + subject→payee pins,
  issuer public key, report root, signer key + expected payer pubkey,
  journal path, DB path, CRE snapshot path); the request only supplies the
  signed envelope. Unknown keys are refused and network-affecting keys
  (`cluster`, `rpcUrl`, `keypair`, `env`…) are forbidden outright — pins
  live in code. Gating order is fail-closed *before* any signer, DB, or
  RPC touch: `enabled` must be explicitly `true`; the process uid must
  equal the pinned `workerUid`, must differ from `distinctBackendUid`, and
  must not be root (both pins must be positive non-root integers); the
  config file must be a real 0600 file owned by the worker or root inside
  a non-symlink 0700 parent; `reportRoot` itself must be a 0700
  worker/root-owned directory (not merely under one); every trusted file
  is a regular 0600 file; existing journal/DB paths may never be symlinks;
  and on devnet the claims/mandate DB must already exist 0600-owned.
  Parse/read/DB/RPC errors are never printed verbatim — adapter and
  storage messages can carry endpoints or secrets, so only this module's
  own `supplier worker rejected:` text reaches stderr.
- `worker.ts` — devnet-only CLI: `execute`/`reconcile`, envelope from
  `--envelope <file>` or stdin. Argument parsing is strict: unknown flags
  (including `--simulate-crash-after-send`, `--endpoint`), duplicate
  flags, missing or relative path values, and stray positionals all
  refuse. It builds the public
  `executeSupplierPayment`/`reconcileSupplierPayment` orchestration over
  `createSupplierDevnetRail` — local envelopes, local rails, and local
  signatures can never reach it. The `supplier_payment_claims` table is
  never provisioned implicitly on devnet: it must exist from an explicit
  migration before the worker runs, and the run fails closed if it does
  not. The issuer file must be a `PUBLIC KEY` PEM — a private key in that
  slot refuses before any parse.
- `local-worker.ts` — the local-harness twin over `createLocalSupplierRail`
  and `createLocalSupplierExecutor`. Same CLI shape and config gates, plus
  `--simulate-crash-after-send` (exit code 42 immediately after the rail
  returns but before finalize) — a proof hook that exists only in the
  local worker, never in `worker.ts`.
- `governed-seed.ts` — seeds a disposable SQLite DB (real
  `SupplierPaymentStore`/`FundedMandateService` schema + `funded_mandates`
  row), a CRE JSONL snapshot via `JsonlCreRunPersistence`, a report tree,
  an ephemeral Ed25519 issuer, and the `worker-config.json` used by the
  proof. Test/proof fixture only.
- `signer-check.ts` — thin CLI over `loadDedicatedSigner` for the
  uid-isolation CI job; prints only the derived address.

### CRE inputs are snapshots, not live stores

The worker reads the governance run/artifact evidence through
`CreRunStore` over a `JsonlCreRunPersistence` file that is an approved,
private server snapshot copied into the worker's private directory — never
the live CRE backing store or a remote Mongo. Same for the diligence
report root and the mandate/claims database: explicit private paths,
refused if missing or wrongly permissioned.

### Signed domains

`executeSupplierPayment` accepts only `cognivern.supplier-payment-devnet.v1`
envelopes with literal devnet terms. `createLocalSupplierExecutor` (tested
in `tests/unit/SupplierLocalExecutor.test.ts`) accepts only
`cognivern.supplier-payment-local.v1` — cluster `localnet`, a pinned local
mint, and the spawned validator's genesis, which must differ from every
public-chain genesis including devnet. No code path infers the expected
chain from the envelope body; each direction is covered by negative tests.

### Governed local proof (`local-proof.sh --governed`)

The canonical way to run it is the hosted job
`.github/workflows/supplier-validator-proof.yml` (Ubuntu 24.04 runner,
pinned Agave v2.3.0 tarball verified by SHA256, `pnpm --frozen-lockfile`,
loopback-only transfers, proof JSON + bounded diagnostic uploaded with a
3-day retention, machine discarded). It runs automatically on PRs that
touch the worker/rail/executor/proof paths and can also be dispatched
manually — routine local work never needs a validator. Running it on a
Mac requires the explicit `--allow-macos` + mounted scratch disk path
described above (SIGKILL is the only escalation the cleanup trap uses,
and only on its own captured pid).

Extends the adapter-only proof: after the mint/funding setup it warms the
validator with a trivial SOL transfer (fresh validators can silently drop
their first transaction), seeds the temp DB/CRE/reports/issuer, then runs
the real worker code path:

1. A held envelope denies with no claim row, no debit, no chain movement.
2. A proceed envelope executes with `--simulate-crash-after-send` — the
   worker exits rc 42 after the rail broadcast but before finalize,
   leaving the claim `pending`, budget consumed 0, and exactly one
   on-chain transfer.
3. A *fresh* worker process reconciles: identical pending claim →
   `confirmed`, exactly one 10000-base-unit debit.
4. Replaying the identical envelope returns the same signature — no
   second broadcast, no second debit, payee ATA signature history stays
   at exactly 1.

Public-only artifact: `.artifacts/supplier-worker-local-proof.json`
(cluster/mint labels, held result, pending/confirmed/debit values,
original and recovered signatures). The artifact labels the run `localnet`
everywhere — a local receipt is never devnet evidence.

## Signer isolation proof (CI)

`.github/workflows/supplier-worker-isolation.yml` runs on PRs touching
`tooling/supplier-payment/**` or the executor sources, on an ephemeral
Ubuntu runner with `contents: read` only. It creates two disposable Unix
users (`supplier-worker`, `supplier-api`), generates a synthetic key under
a worker-owned 0700 dir with a 0600 file, then proves through the real
`signer.ts` code path:

- the worker uid loads its own signer (pubkey checked),
- the API uid is refused (the loader's uid-ownership check fires before
  `open` reaches the filesystem — a permission denial, not a missing file
  or a crashed tool),
- the API uid can still read the public worker config file,
- the private signer dir is untraversable for the API uid,
- a disabled worker config refuses before any signer/DB/RPC I/O.

The job stages an `rsync` copy of the repo under a traversable `/tmp` path
(the checkout dir is not traversable by other uids), generates the
synthetic key *inside* the worker-owned private dir with `umask 077`, and
checks the API uid's denial with a raw `os.open` — the failure must be
EACCES, not a missing file or a crashed tool. Users, keys, and configs are
deleted at job end; nothing is retained. This exercises the *mechanism* on
a clean host — it is not proof of any specific deployment.

### Deployment recipe (admin, before any funding)

1. Create a dedicated OS user for the worker (e.g. `supplier-worker`) that
   is not the API/backend user; keep `distinctBackendUid` pinned to the
   backend user's uid in the config.
2. Install the signer key under a dir owned by the worker, mode 0700, file
   mode 0600 — e.g.
   `install -d -m 0700 -o supplier-worker /srv/supplier-worker/signer` and
   `install -m 0600 -o supplier-worker payer.json …/signer/`.
3. Same treatment for the worker config, journal, DB, issuer pubkey, and
   the approved CRE snapshot directory — worker-owned, private parents.
4. Provision the DB explicitly: create `supplier_payment_claims` via
   `initSupplierPaymentClaims` in a one-off migration step as the worker
   user — the devnet worker refuses to create it and fails closed if it
   is missing.
5. Run the worker under a service manager as that user (`User=` in a
   systemd unit, or equivalent); never run project code as root.
6. Only then fund the payer on devnet — funding while the backend user can
   still read the key defeats the isolation.

## Manual funding and activation gates

The executor checks above are verified against synthetic fixtures and an
in-memory fake rail; the adapter itself has been exercised end to end only
on a local validator (localnet cluster + local mint, not devnet). No real
devnet broadcast, funded wallet, or devnet chain receipt has ever been
exercised. Before a real devnet rehearsal all of the following must hold:

1. `config.enabled` — hard gate, defaults to refusal.
2. A wired `SupplierPaymentRail` for the deployment — the adapter exists in
   `tooling/supplier-payment/` and is proven against `solana-test-validator`
   (see "Rail adapter" above), but it is still unwired: no executor config
   constructs it, signer isolation is not OS-enforced on the dev machine
   (a dedicated Unix user + file ACLs is required before real funding —
   today the backend process could read the key file), and no funded devnet
   rehearsal has ever run. The devnet factory pins the canonical genesis
   (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, re-verified live on every
   send and recovery), the devnet USDC mint, and a single dedicated
   payer/payee scope — no `allowMainnet` exists anywhere in this path.
3. The operator-pinned Ed25519 public key (`config.trustedPublicKey`) for the
   issuing authority, distributed out of band.
4. `config.subjectPayeePins` — subjectHash → payee pinned per reviewed
   subject; an unlisted payee denies before any lineage lookup.
5. `initSupplierPaymentClaims` migrated onto the deployment database before
   the worker is enabled (the devnet worker refuses to provision it; today
   the schema is created only by tests and the local harness).
6. An active funded mandate with a USDC budget line covering the 0.01 amount;
   env limits never substitute for the mandate (`policySource` must be
   `funded_mandate`).
7. The internal diligence report staged under `config.reportRoot` as
   `<reportHash>.json` — content-addressed, produced by the private collector
   against the deployed stack.

## Recovery model

- Any thrown, ambiguous, or mismatched outcome after the claim row is
  inserted leaves the claim `pending`. Pending claims are never
  redispatched — `executeSupplierPayment` on the same intent returns
  `pending`, not a second send.
- `reconcileSupplierPayment` is the only way forward: it re-verifies the
  signed envelope is the identical binding, asks the trusted adapter for the
  issued receipt via `fetchReceipt(intentId)` (an operator-pasted receipt is
  never accepted), validates every field against the proposal, and finalizes
  atomically (confirmed + single budget debit). A missing or altered receipt
  leaves the claim pending.
- Claim rows are never deleted. A permanently unresolved pending claim —
  including one whose dispatch produced no chain transaction at all —
  blocks further claims for the mandate until an operator resolves it.
