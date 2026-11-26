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
5. `initSupplierPaymentClaims` migrated onto the deployment database (today
   it only runs in tests).
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
