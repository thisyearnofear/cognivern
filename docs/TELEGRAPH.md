# Telegraph Protocol Integration

Governed consumption of Telegraph verified intelligence: agent miner calls
are confidence-gated, paid per-call in x402 USDC, and recorded as
`telegraph.signal` CRE artifacts linked to agent, mandate, and policy.

Submission history (Season I Track 3, concluded Sep 2026):
[`history/HACKATHON_SUBMISSION_TELEGRAPH.md`](./history/HACKATHON_SUBMISSION_TELEGRAPH.md)
and [`history/TELEGRAPH_TRACK3_PROPOSAL.md`](./history/TELEGRAPH_TRACK3_PROPOSAL.md).
Season I did not place — see the [retrospective](#season-i-retrospective) and
[Season II direction](#season-ii-direction) below before extending this rail.

```text
Telegraph Verified Intelligence
  → Confidence threshold check (per-miner declared confidence_field; fail-safe hold)
  → Governance pipeline (GovernanceClient.previewSpend / executeSpend)
  → Wallet execution (OwsWalletService)
  → Attribution & evidence (SpendAttributionService + CRE)
  → Mandate statement
```

Additive-only: everything lives in `src/backend/services/telegraph/` +
`TelegraphController` + one CRE type. Disabled ⇒ zero behavior change.

## Components

| Component                   | Purpose                                                                                  | Location                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `TelegraphService`          | Miner discovery, x402 payments, node/engine/daemon health                                | `src/backend/services/telegraph/`                                |
| `TelegraphGovernanceHelper` | Confidence routing + `telegraph.signal` artifacts                                        | same                                                             |
| `AnjomanService`            | Delegated multi-specialist tasks via API key (`/agent/chat`, async jobs, escrow balance) | `src/backend/services/anjoman/`                                  |
| `VendorScreeningService`    | Per-bidder Anjoman screening → `sealed_bid.vendor_screened` events + reveal gate         | `src/backend/services/blockchain/sealed-bid/VendorScreening.ts`  |
| `TelegraphController`       | `/api/telegraph/*` status + governed stats                                               | `src/backend/modules/api/controllers/`                           |
| Signal digest agent         | Scheduled governed consumption loop                                                      | `tooling/scripts/agents/telegraph-signal-digest.ts`              |
| Demo script                 | End-to-end paid call                                                                     | `tooling/scripts/demo/demo-telegraph.ts` (`pnpm demo:telegraph`) |

## Environment

```bash
TELEGRAPH_ENABLED=true
TELEGRAPH_NODE_URL=http://13.237.89.59:7044
TELEGRAPH_ENGINE_URL=http://13.237.89.59:7044/engine
TELEGRAPH_DAEMON_URL=http://13.237.89.59:7044/daemon
TELEGRAPH_EVM_PRIVATE_KEY=0x...        # BURNER wallet, testnet USDC only
TELEGRAPH_CONFIDENCE_THRESHOLD=0.7     # default
TELEGRAPH_EVM_NETWORK=eip155:*         # payments settle on Base Sepolia
TELEGRAPH_SVM_NETWORK=solana:*
TELEGRAPH_SOLANA_PRIVATE_KEY=<base58>   # registers ExactSvmScheme alongside EVM (x402 pays on Solana too)
TELEGRAPH_REFRESH_INTERVAL_MS=300000
TELEGRAPH_CRE_PROJECT_ID=<workspace-id>   # digest: persist calls as CRE runs (unset = stats-only)
TELEGRAPH_DIGEST_MANDATE_ID=...           # mandate tag on digest artifacts (default: telegraph-governed-consumption)
TELEGRAPH_MAX_SPEND_USD=1                 # hard per-run paid-call ceiling for the digest
```

```bash
# Authorized settlement on Solana (optional — compliant-call "settlement" leg)
SOLANA_SETTLEMENT_ENABLED=true
SOLANA_SETTLEMENT_PRIVATE_KEY=<base58>  # 64-byte ed25519 secret (seed || pubkey)
SOLANA_CLUSTER=devnet                   # devnet (default) | mainnet-beta | testnet
SOLANA_ALLOW_MAINNET=false              # must be true to arm mainnet-beta
SOLANA_RPC_URL=                         # unset = default RPC for the cluster
SOLANA_USDC_MINT=                       # unset = canonical USDC for the cluster
SOLANA_SETTLEMENT_MAX_USD=0.05          # per-transfer cap
SOLANA_SETTLEMENT_RUNWAY_USD=0.25       # cumulative cap per workspace+mandate (in-process)
SOLANA_SETTLEMENT_PAYEE_ALLOWLIST=      # csv base58 payees; empty = no transfers
SOLANA_SETTLEMENT_INTENT_FILE=          # unset = data/solana-settlement-intents.json
```

Empty env values are treated as unset (so `SOLANA_RPC_URL=` falls back to the
cluster default). Malformed numbers (`NaN`, `0`, negatives), a per-transfer cap
above the runway, or `mainnet-beta` without `SOLANA_ALLOW_MAINNET=true` are
startup config errors — the rail fails closed rather than silently disabling a
guard.

`paymentReady` in `/api/telegraph/status` is the honest readiness gate: true
only when a real x402 signer was constructed from the key. x402 handling is
automatic via `@x402/fetch` (`wrapFetchWithPayment`) — on a 402 the client
signs an EIP-3009 `TransferWithAuthorization` (gasless, ~$0.01/call read from
the miner's `min_price_usdc`) and retries with the `PAYMENT` header.

## API

All under `/api/telegraph/` (workspace auth): `status` (health, miner count,
threshold, `paymentReady`, daemon health) · `miners` + `miners/:id`
(registry, intents, `signal_mapping`, scores, price) · `intents` (grouped,
real `requestCount` aggregates) · `daemon/categories` + `daemon/questions`
(free signal feed with per-question routing hints) · `stats` (governed
consumption counters the digest writes to `data/telegraph-stats.json`) ·
`ledger` (expense-ledger projection over persisted `telegraph.signal` CRE
runs for the caller's workspace — settlement count, spend, burn by
intent/miner/mandate, and per-call dispositions including held-signal
resolution) · `compliant-call` (screen first, then buy the requested call
only when the screen is `clear` and the declared spend guard passes) ·
`settlement/reconcile` (verify an uncertain settlement intent against the
chain; see the settlement section) · `evidence/:runId`
(workspace-authenticated retrieval of the evidence bundle
attached to a compliant-call gate or settlement artifact).

The in-product dashboard is `/telegraph` — categories, questions, the
governed-consumption stats panel, and the intelligence ledger (settlements,
burn by intent, recent calls with dispositions).

**Inspect the decision** opens the recorded testnet case at `/verify?report=supplier-diligence&case=2&model=groq&view=governed`. For Northwind, a fictional supplier, the model recommended proceeding; low-confidence evidence triggered a human-review hold. Inspecting this example makes no paid call. It is not a current supplier assessment.

### Glossary: the two kinds of "settlement"

The word appears twice in this rail with different meanings. Keeping them
straight is the single biggest readability win when reading evidence:

| Term | Meaning | Money |
| --- | --- | --- |
| `settlement` | The *paid intelligence call* the compliant-call endpoint executes (the parent x402 purchase). | screening + call cost |
| `settlementTransfer` | The *downstream USDC transfer* on Solana that an approved intelligence call authorizes. | the transfer amount |

In an evidence bundle, `settlement` is always about the intelligence
purchase; `settlementTransfer` is always about the Solana leg. A request with
no `settlement` field performs no transfer at all.

### Replay rules for `settlementTransfer` (what happens on retry)

Retrying a compliant-call with the same `intentId` is always safe, but the
outcome depends on the journalled state of that intent:

| Journalled state | What a retry does |
| --- | --- |
| `confirmed` | Returns the recorded signature. No broadcast, no second debit. |
| `sent` / `pending` / `uncertain` | Refuses to broadcast (`uncertain` outcome with the recorded signature). Reconcile first. |
| `failed` (retryable) | A new attempt is made under the same intentId; prior attempts stay in the record's `attempts[]`. |
| `failed` (non-retryable) | Refuses (`already_failed`). |
| no record | A fresh attempt: journalled `pending` before broadcast. |

If the request omits `intentId`, one is derived from the request payload
(`auto-<hash>`), so an identical retry replays rather than double-paying —
but *changing any part of the request* (payee, amount, body) derives a
different id and is a new intent. To retry after a failure with different
parameters, supply a fresh `intentId` explicitly.

## Anjoman delegated tasks (API-key rail)

Anjoman (`backend.telegraphprotocol.com`) is the delegation surface on top of
Telegraph: `POST /agent/chat` takes a whole task, plans it across ranked
specialists (parallel or serial), retries failures, and returns one combined
answer with `sources` and total `costUsd`. Calls settle from the account's
funded balance via a Bearer API key — no per-call x402 signature — which
removes facilitator round-trips on multi-step work.

```bash
ANJOMAN_API_KEY=anjoman_...           # setting a key enables the rail
# ANJOMAN_ENABLED=false               # force-disable even with a key set
# ANJOMAN_MAX_SPEND_USD=0.25          # per-task cap → maxSpendUsd
# ANJOMAN_TASK_TIMEOUT_MS=180000      # answers past ~80s arrive as async jobs
# ANJOMAN_POLL_INTERVAL_MS=2000
```

`POST /api/telegraph/anjoman-task` (workspace auth) runs a governed task:
`{message | intent + params, maxSpendUsd?, conversationId?, mandateId?, …}`.
Answers past ~80s arrive as `202 {jobId}`; the service polls
`GET /agent/jobs/:id` on the job's typed status (never a bare timer) and
POSTs `/agent/jobs/:id/cancel` on timeout — closing a connection does not
stop spend.

Same governed persistence as miner calls: a `telegraph.signal` CRE artifact
with `cost.paymentMethod: "anjoman_api_key"` (vs `"x402"` on direct calls) and
`signal.sources` preserving which ranked specialists were paid — so the
ledger and inbox treat it like every other call. Anjoman answers carry no
per-miner confidence, so completed tasks deterministically **hold** for
operator review — the same fail-safe contract as miners without a declared
`confidence_field`.

`/api/telegraph/status` reports an `anjoman` block (`enabled`, `ready`,
`reachable`, `escrowBalanceUsd` — a best-effort live balance read proving the
key works) regardless of whether the direct-miner rail is enabled.

Production validation on November 23: the workspace key is configured and
`anjoman.ready`/`reachable` are true; two governed smoke tasks reached Anjoman
and persisted fail-safe `held_pending` runs at zero cost; two `$0.50`-capped
paid tasks reached the provider but returned Cloudflare 504s, while the
provider balance endpoint reported `$0.03` cumulative unbilled spend. Do not
describe paid specialist delegation as proven until a task returns funded
specialist sources.

### Vendor screening → sealed-bid award gate

`POST /api/vendor/sealed-bid/rounds/:roundId/screen-bidders` delegates vendor
due-diligence to Anjoman — one governed task per bidder (capped at
`ANJOMAN_SCREEN_MAX_BIDDERS`, default 10, each with its own `maxSpendUsd`):

```json
{ "bidders": ["alice"], "vendorDetails": { "alice": "acme.eth" }, "maxSpendUsd": 0.5 }
```

The brief asks Anjoman to end with a `VERDICT: CLEAR|HIT|REVIEW|UNKNOWN`
line; `evaluateVendorVerdict` reads that marker first, then the structured
answer through the same compliance scanner as miner calls, then a guarded
text scan — anything ambiguous is `unknown`, never silently `clear`. Every
screen appends
a `sealed_bid.vendor_screened` event (bidder, verdict, screening run id, cost)
to the round's governance timeline, so the verdicts are part of the same
hash-signed record a verifier fetches via `/verify`.

`POST …/reveal` accepts `requireScreened: true` to gate the award on that
state: `selectionMethod: "specific"` requires the target's latest verdict to
be `clear`; `lowest-bid`/`highest-bid` compute the winner on-ledger from
sealed amounts, so they require every bidder screened and none `hit` or
inconclusive — a tainted pool forces the manager to pick a cleared vendor via
`"specific"` (or cancel) instead of awarding blind. The winning verdict rides
the reveal response as `winnerScreen`.

### Re-running the evidence (judge CLI)

`tooling/scripts/agents/telegraph-demo.ts` is a dependency-free CLI over the
live API so reviewers can reproduce the ledger, run a compliant call, and
trigger verification sampling themselves:

```bash
export COGNIVERN_TOKEN=<workspace JWT>   # COGNIVERN_API defaults to production
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts ledger
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts compliant-call '<json>'
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts evidence <gate-or-parent-runId>
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts verify-sample <programId> [limit] [evaluatorMinerId]
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts report <programId>
```

The CLI sends `COGNIVERN_TOKEN` as `Authorization: Bearer`; raw API clients may
instead send a workspace API key as `x-api-key`. Every Telegraph API route is
workspace-authenticated, including `status`, `miners`, and `intents`. For a
zero-cost evidence retrieval check, submit a `compliant-call` whose
`spendGuard.subjectDenylist` exactly matches a `compliance.params` value: the
pre-screen guard denies it before any x402 payment, persists a gate-decision
artifact, embeds an `evidenceBundle`, and returns the `runId` needed by
`telegraph-demo.ts evidence <runId>`.

The endpoint was first deployed to production with backend commit `5b9cdc24` on
November 23; a follow-on deploy at `32e7c831` activated the provider-review /
disputed-hit approval path. Deployment, health checks, route/artifact
registration, and authenticated retrieval are verified. A zero-cost
spend-guard denial produced blocked gate run
`f7d012d6-ae46-4f9e-8c14-6cbc60fdf908`; authenticated retrieval returned schema
`cognivern.telegraph.compliant-call-evidence.v1` and evidence hash
`7058b798e116579a9ddf1790f777228102f2c1bd113be4787204d83f511bf41e`.

`tooling/scripts/agents/telegraph-benchmark.ts` is the independent benchmark
harness. It loads fixed public cases from `telegraph-benchmark-cases.json`,
scores each provider response against declared ground truth (not an evaluator
miner's opinion), records run ids/evidence hashes, cost, latency, review and
unknown rates, and hit precision/recall with false positives and false
negatives. `--dry-run` validates the suite and emits a planned report without
paid calls; a live run requires the same workspace credential. `--baseline`
also runs the marked cases through an OpenAI-compatible frontier model using
`BENCHMARK_BASE_URL`, `BENCHMARK_API_KEY`, and `BENCHMARK_MODEL` for comparison:

```bash
pnpm exec tsx tooling/scripts/agents/telegraph-benchmark.ts --dry-run
pnpm exec tsx tooling/scripts/agents/telegraph-benchmark.ts \
  --out /tmp/telegraph-benchmark.json \
  --markdown /tmp/telegraph-benchmark.md
```

Paid production run, November 23: all three fixture cases passed with `$0.03`
measured spend, two paid calls, 5,083ms average latency, no review/unknown
responses, and 100% hit precision/recall on the fixture. Evidence retrieval
returned `cognivern.telegraph.compliant-call-evidence.v1` for all three gate
runs; hashes were `d2150c41…`, `21ea2b05…`, and `860fbf81…`.

The Anjoman vendor-screening loop is reproducible end to end:

```bash
# one governed task per bidder; verdicts sign the round's governance timeline
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts screen-round <roundId> \
  '{"vendorDetails":{"Alice":"acme.eth"}}'

# gated reveal — refuses to award an unscreened or hit vendor
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts reveal <roundId> \
  '{"selectionMethod":"specific","specificBidder":"Alice","requireScreened":true}'
```

`anjoman-task '<json>'` exercises the raw governed delegation endpoint.
Every command prints the raw API response — run IDs, dispositions, verdicts,
and leaderboard rows are the evidence, not a summary of it.

## Signal digest (production consumption pattern)

The digest is the real consumer: it pulls the daemon's organic high-interest
signals (`sort=interest&min_interest=6`, `source != "user"`), follows each
signal's own daemon routing (`subnet_id` / `miner_slug`), pays and calls the
miner **directly** via `/miner-dispatcher/v1/:id/:path`, and governs on the
miner's declared `signal_mapping.confidence_field`.

Why direct calls, not the engine: the engine-ask path strips the confidence
field, so every decision would hold. Direct calls return the miner's own
confidence, which is what makes real approve/hold decisions possible.

```bash
pnpm telegraph:digest                                          # one-off
TELEGRAPH_LOOP_INTERVAL_MS=21600000 pnpm telegraph:digest      # 6h loop (VPS pm2: cognivern-telegraph-digest)
```

| Env                             | Default | Meaning                                        |
| ------------------------------- | ------- | ---------------------------------------------- |
| `TELEGRAPH_SIGNAL_MIN_INTEREST` | `6`     | Only consume signals at or above this interest |
| `TELEGRAPH_SIGNAL_LIMIT`        | `5`     | Max signals per run                            |
| `TELEGRAPH_LOOP_INTERVAL_MS`    | unset   | Continuous-mode cadence                        |

Cadence is deliberately modest (6h on the VPS) — demand-driven consumption,
not metric farming. Note: miners without a declared confidence field (e.g.
`telegraph-chatbot`) deterministically hold; that is the fail-safe contract,
not an error.

## Confidence routing & CRE artifact

Decision per call: `confidence >= threshold` → **approved**;
`< threshold` → **held**; `null` (miner declares no confidence field) →
**held** fail-safe. No fabricated confidence — an absent signal is "unknown",
never auto-approved. Threshold: `TELEGRAPH_CONFIDENCE_THRESHOLD` globally or
`confidenceThreshold` per call (0.7 balanced; 0.8–0.9 conservative; 0.5–0.6
permissive).

Every call is persisted as a CRE run (`workflow: "governance"`, `mode: "cre"`)
carrying a `telegraph.signal` artifact — via `recordTelegraphGovernedCall`
(`services/telegraph/TelegraphRunRecorder.ts`). Approved and failed calls
complete immediately; **held calls pause for operator approval** and surface
in the escalation inbox (`POST /api/cre/runs/:runId/approval` resolves them —
approve releases the signal, reject quarantines it). In-product calls go
through `POST /api/telegraph/call` (direct miner) and
`POST /api/telegraph/engine-ask` (engine-routed); both require workspace auth
and return `runId`/`runStatus`.

`POST /api/telegraph/compliant-call` adds compliance-on-payment: it first buys
a screening verdict from a compliance miner (default intent
`SANCTIONS_SCREENING_MATCH`; override via `compliance.intent`/`minerId`,
subject via `compliance.params`), persists that screen as its own governed
run, and only proceeds to the paid call on an explicit `clear` verdict. A
`hit`, provider `review`, malformed `unknown`, or non-approved screening call
blocks the purchase before settlement. `hit`, `unknown`, and failed screens
record a failed gate-decision run by default; a provider `review` verdict — or
an explicit `compliance.disputeHit: true` on a `hit` — records the blocked
attempt as a paused gate-decision run in the existing operator approval inbox.
Approving that run releases the review case and rejecting it quarantines it;
the endpoint does not silently clear the provider verdict or resume the denied
parent payment, so the caller must retry after review. Cleared payments carry
a `compliance` block and an `evidenceBundle` inside their `telegraph.signal`
artifact; the ledger exposes the bundle hash, `/api/telegraph/evidence/:runId`
path, verdict source, and policy violations on the matching record.

#### Canonical screening verdicts

`evaluateComplianceVerdict` normalizes provider output to `clear`, `hit`,
`review`, or `unknown`. Known provider adapters run first: Counterproof's
native `CLEAR`, `REVIEW`, and `BLOCK` map to `clear`, `review`, and `hit`
respectively. For other miners, explicit fields such as `label`, `verdict`,
`decision`, `recommendation`, `result`, `status`, or `outcome` are checked
before the recursive boolean/risk-score fallback. `review` is therefore a
real provider state, not a synonym for malformed output; `unknown` means the
screen returned nothing recognizable. Only `clear` plus an approved governed
screen permits the parent call.

A provider `review` verdict automatically enters the human-review path when
the screening call itself was approved. A provider `hit` remains blocked unless
the request explicitly sets `compliance.disputeHit: true`; callers can attach a
500-character operator note with `compliance.reviewNote` (hashed in the
shareable compliance evidence). Reviewable blocked attempts return
`status: "held"`, `reviewRequired: true`, a `pendingAction`, and a CRE
`runId`; resolving them uses `POST /api/cre/runs/:runId/approval` with
`{"approve": true|false, "reason": "operator note"}`.

#### Evidence bundle and retrieval

Every compliant-call attempt now creates a
`cognivern.telegraph.compliant-call-evidence.v1` bundle before the CRE
artifact is signed. It links the request/body and parameter hashes, the
screening run and artifact, the gate decision, the parent run when present,
artifact ids and hashes, miner identity, provider verdict/source/list version
when available, costs, latency, payment network, declared spend guard, policy
evaluation, and replay metadata. It deliberately stores field names and
canonical SHA-256 parameter hashes, not the screened subject itself.
`GET /api/telegraph/evidence/:runId` requires the same workspace auth, checks
run ownership, and returns `runId`, `artifactId`, `artifactHash`,
`artifactEvidenceHash`, and `evidenceBundle`. `artifactHash` is the stable
SHA-256 hash of artifact data excluding the embedded bundle;
`artifactEvidenceHash` is the CRE artifact's signed evidence hash.

#### Spend guard

`compliant-call` accepts an optional `spendGuard` object:

```json
{
  "maxScreeningCostUsd": 0.02,
  "maxTotalCostUsd": 0.05,
  "allowedMiners": ["9002", "txlens"],
  "allowedIntents": ["GAS_PRICE"],
  "allowedScreenMiners": ["731002", "counterproof"],
  "allowedScreenIntents": ["SANCTIONS_SCREENING_MATCH"],
  "subjectAllowlist": ["acme corp"],
  "subjectDenylist": ["isil khorasan"],
  "consensusScreens": 1,
  "budgetId": "treasury-q4"
}
```

The guard is fail-closed and checked twice: before any payment and again
between the paid screen and the parent call using the screen's actual cost.
`allowedMiners`/`allowedIntents` constrain the parent call; the `allowedScreen*`
fields constrain the screening call. Subject lists compare normalized exact
terms against primitive `compliance.params` values — they are policy terms,
not fuzzy entity resolution — and the shareable bundle stores their SHA-256
hashes rather than the raw terms. `consensusScreens` values above `1` currently
block because this endpoint performs one screen; `budgetId` is recorded for
mandate/budget linkage but does not yet debit a budget ledger. If a required
price or miner lookup cannot be proven, the call blocks instead of guessing.

#### Authorized settlement on Solana

`compliant-call` accepts an optional `settlement` object — the downstream
stablecoin transfer the screened intelligence authorizes:

```json
{
  "settlement": { "rail": "solana", "payee": "<base58>", "amountUsd": 0.01, "intentId": "case-1" }
}
```

The `SolanaSettlementService`
(`src/backend/services/blockchain/solana/`) sends SPL USDC
`transferChecked` instructions to the canonical Token program — no custom
on-chain program is deployed. SOL pays fees only; USDC is what moves. A first
transfer to a *new* payee also creates its associated token account, which
costs ~0.00204 SOL of rent that is **not** recovered and is not part of the
USDC caps — keep at least ~0.01 SOL in the payer for fees + rent.

**Pre-screen guard.** Everything that could make settlement fail later runs
before the paid screen: mandate policy (active mandate, USDC budget line,
`settlement.allowedAssets`, `chainIds`, Cleanverse requirements), env caps,
payee allowlist, and rail readiness (enabled flag, key, payer SOL/USDC
balance). A blocked intent never buys intelligence it could not settle, and
is recorded in the evidence bundle as `settlementTransfer`
(`status: "blocked"`) with the violation list. `settlementTransfer` is
deliberately distinct from `settlement`, which describes the *parent* paid
intelligence call.

**Idempotency.** `intentId` is optional; when omitted the server derives it
from the request (`workspace + payee + amount + bodyHash`), so an identical
retry replays instead of paying twice. The durable journal
(`data/solana-settlement-intents.json`, override with
`SOLANA_SETTLEMENT_INTENT_FILE`) records an intent *before* broadcast and is
the source of truth across process restarts and concurrent requests:

| state       | meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `pending`   | reserved, not yet broadcast                                    |
| `sent`      | broadcast, signature known, not yet confirmed                  |
| `confirmed` | confirmed on-chain; replays return the recorded signature      |
| `failed`    | provably did not move; `retryable` decides whether a retry may reuse the id |
| `uncertain` | broadcast outcome unknown; replay refuses to send again        |

An `intentId` is bound to its exact payload (`workspace`, cluster, mint,
payee, amount); reusing it for a different transfer is rejected as
`intent_conflict`. The per-transfer cap and cumulative runway are reserved
synchronously before any await, so concurrent requests cannot both pass the
runway check.

**Runway survives restarts.** The cumulative counter is rehydrated from the
intent journal at first use after a process restart: confirmed records count
as spent, and unfinished (`pending`/`sent`/`uncertain`) records keep their
reservation held. The hard cumulative backstop remains the USDC balance of
the settlement wallet: fund it with exactly the runway you are willing to
spend, and no counter failure can increase exposure.

**Statuses.** Broadcast errors map to honest outcomes — `uncertain` when the
signature may have landed (the caller must reconcile on Solscan, never blind
retry), `failed` when preflight/on-chain execution provably moved nothing,
`unavailable` when the rail is not armed or misconfigured. Settlement never
runs unless `SOLANA_SETTLEMENT_ENABLED=true`.

**Reconciling an uncertain intent.** `POST /api/telegraph/settlement/reconcile`
with `{ "intentId": "..." }` (requires the `spend:execute` scope) verifies the
recorded signature on-chain via `getSignatureStatuses` and flips the journal
state only on chain truth: confirmed → replayable and debitable, failed →
retryable, not-yet-visible → left untouched. The endpoint never broadcasts and
never trusts an operator's claim — if the cluster has not resolved the
signature, the intent stays `uncertain`.

**Payee risk.** The rail does not screen the payee address itself (no
address-risk provider is wired). The compliance screen covers the *subject*
passed to `compliance.params`; if the payee is the counterparty, include it
in the screened subject. The allowlist is the only payee control.

**Evidence.** Settled results carry `cluster`, `signature`, and a convenience
`explorerUrl` in the authenticated, hash-sealed bundle. The published
`/verify` report keeps only `cluster` + `signature` and derives the Solscan
link itself, so the shareable report never leaks a raw URL.
`/api/telegraph/status` reports `solanaSettlement` readiness
(enabled/configured/cluster/caps/allowlist size/config errors) alongside the
x402 payment rails.

The `telegraph:diligence` eval collects evidence only — it no longer
constructs a supplier `settlement` on the compliant-call, and the legacy
`--settlement-payee` / `--settlement-amount-usd` flags are rejected before
any network call. Transfer records embedded in historical responses are
still read and reported, and `/verify` renders them as a terminal node on
the evidence chain.

The first gate on paying a cleared supplier is an offline rehearsal review,
`tooling/scripts/agents/supplier-payment-rehearsal.ts`:

```sh
pnpm exec tsx tooling/scripts/agents/supplier-payment-rehearsal.ts \
  --report internal-diligence.json --approval approval.json \
  --trusted-public-key operator-pinned.pem
```

It verifies an Ed25519-signed `cognivern.supplier-payment-rehearsal.v1`
envelope — the sole transaction request — against an operator-pinned public
key and the internal report's canonical-JSON digest: report hash, mandate id, a
non-dry-run execution, two approved clear screens from distinct configured
screen miners with purchased parents and no transfer, escalation, or review
flag, and every configured model reaching `proceed` without a gate hold.
Terms are fixed at 0.01 USDC on devnet. A blocked result exits nonzero and
records nothing; an eligible result returns one bound `proposedTransfer`
tuple to a caller-supplied recording callback — the tool ships no signer,
no executor, and no live adapter.

Envelope conventions: the signed `body` carries exactly `schema`,
`workspaceId`, `mandateId`, `caseId`, `subjectHash`, `reportHash`,
`cluster`, `mint`, `payee`, `amountBaseUnits`, `intentId`, and `expiresAt`
(strict ISO timestamp). The signature is a standard-base64 Ed25519
signature over the UTF-8 bytes of `canonicalJson(body)` — digests compare
canonicalized JSON, not exact file bytes — and the trusted key file must be
a PEM that begins with `-----BEGIN PUBLIC KEY-----`; a private key is never
accepted.

Gate 2 adds a backend-only executor —
`src/backend/services/telegraph/SupplierPaymentExecutor.ts` — that composes
those checks with real server-side loaders: a `devnet`-domain envelope
(`cognivern.supplier-payment-devnet.v1`) verified against a deployment-pinned
key, a content-addressed internal report, durable SQLite single-use claims,
full CRE lineage recomputation for both evidence steps, a live devnet genesis
check against the canonical hash
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, and an atomic finalize that
debits the funded mandate once. There is no HTTP endpoint; the rail is
injected, and a real adapter now lives in `tooling/supplier-payment/` —
devnet-pinned (`createSupplierDevnetRail`) and local-only
(`createLocalSupplierRail`) factories with a dedicated-signer loader, a
single-intent SQLite journal committed before broadcast, and chain-only
receipt verification. A governed worker composition
(`tooling/supplier-payment/worker.ts`, devnet-only) runs the same review
under a dedicated OS identity with every trusted input config-pinned;
`local-worker.ts` is the local-harness twin over a separate
`cognivern.supplier-payment-local.v1` domain and
`createLocalSupplierExecutor` — production can never accept local
envelopes, rails, or signatures. Both are exercised end to end only against
`solana-test-validator` (`tooling/supplier-payment/local-proof.sh` — proof
at `.artifacts/supplier-local-validator-proof.json`, and `--governed` →
`.artifacts/supplier-worker-local-proof.json` covering held-denial,
crash-mid-flight pending recovery, and replay idempotence) plus a
read-only devnet preflight (`devnet-preflight.ts` →
`.artifacts/supplier-devnet-preflight.json`, currently `ready:false` —
unfunded keys). A dedicated CI job
(`.github/workflows/supplier-worker-isolation.yml`) proves two-UID signer
isolation on an ephemeral runner — a mechanism check, not deployment
evidence. It remains unwired from the API:
no route can reach it, signer isolation is not OS-enforced yet, and a real
funded devnet rehearsal remains the gate before any live claim. See
`internals/supplier-payment-executor.md` for the activation gates, recovery
model, and what is synthetic versus actual. The offline verifier is not a
payment authorization API and offers no way around those gates.

### Registry intent matching

Miners register suffixed intents (`SANCTIONS_SCREENING_MATCH_GENERAL`,
`LLM_OUTPUT_EVALUATION_GENERAL`) while callers and missions use the base
name. `getMiners(intent)` and endpoint routing both compare on the base form
(trailing `_GENERAL` stripped), so `SANCTIONS_SCREENING_MATCH` matches every
active sanctions miner. On multi-endpoint miners (e.g. TxLens), the endpoint
is picked by the intent token leading each endpoint description; GET
endpoints receive params as a query string — a JSON body on GET is rejected
before it reaches the miner.

Live Mission 02 sequence (2026-11-22, real x402 payments on Base Sepolia):
a `clear` screen (`9961cba1-130a-43cd-8968-7088e4fa1a16`, Sanctions Name
Evidence, $0.01) allowed a TxLens `GAS_PRICE` purchase
(`3dd5beff-f9ad-4d89-9648-53d3804c36c2`, $0.01) to settle with the
compliance proof attached to its `telegraph.signal` artifact. A Counterproof
sanctions hit on `ISIL KHORASAN` (`e916cddf-2032-4e8f-bfce-e9be80f83a0c`,
$0.01) blocked gate run `2f509267-f0c2-466d-9b70-5ca37f658221` before the
parent payment. A paid screen with no recognizable verdict
(`9e349959-82a8-4d89-9980-4794000c55d4`, $0.01) produced `unknown` and also
blocked before settlement (`f4300716-fa82-4f1f-9073-fbb70a40a3bf`). The full
validation sequence, including exploratory probes, cost exactly $0.10.
Those November 22 run ids predate the evidence-bundle slice; newly recorded
`compliant-call` attempts carry the bundle and are retrievable through
`/api/telegraph/evidence/:runId`.

Live loop verified end-to-end (2026-11-14, production workspace
`e7c4a84b-…`): held digest calls were approved and rejected through
`POST /api/cre/runs/:runId/approval` — released/quarantined dispositions
appear in the ledger — and a fresh `compliant-call` plus an engine-ask at a
0.99 confidence threshold produced approved, held, and (via UI click)
released records. **`TELEGRAPH_CRE_PROJECT_ID` must be a real live-tier
workspace id** — it was briefly pointed at a phantom demo-tier workspace
(`968e717a-…`, ownerless), which made `/api/cre/runs` serve demo data and hid
every telegraph run from the operator's actual login.

The digest persists runs only when `TELEGRAPH_CRE_PROJECT_ID` is set; without
it the script still consumes signals and accumulates `telegraph-stats.json`
but writes no runs.

```ts
{
  type: "telegraph.signal",
  data: {
    agentId, workspaceId?, mandateId?, policyId?, description?,
    miner: { id, name, intent?, autoRouted? },
    signal: { data|answer, confidence: number|null, confidenceThreshold, confidenceMet },
    compliance?: { verdict, verdictSource, screeningRunId, rawResponseHash, subjectHash, … },
    evidenceBundle?: { schema, evidenceHash, screening, gate, settlement, spendGuard, policyEvaluation, costs, replay },
    cost: { usd, paymentMethod: "x402", paid, paymentNetwork? },
    latencyMs, timestamp,
  },
}
```

`createSpendIntentFromSignal(artifact, …)` converts a signal into a governed
spend intent, so downstream actions carry the intelligence cost + evidence
through `SpendAttributionService` into the mandate statement.

## Operational notes

- x402 payments run on **Base Sepolia** (`eip155:84532`); the payer wallet is
  a burner — keep only the USDC runway needed. No ETH required (EIP-3009).
- Digest health check on the VPS: `pm2 logs cognivern-telegraph-digest` —
  each run prints `N calls, $X | approved/held/failed` + all-time totals.
- Unit tests: `tests/unit/TelegraphService.test.ts` (threshold routing, URL
  building, artifact creation), plus focused compliance/evidence coverage in
  `TelegraphCompliance`, `TelegraphSpendGuard`, `TelegraphEvidence`,
  `TelegraphRunRecorder`, and `TelegraphLedger` tests.

## Product roadmap after Mission 02 validation

The Season II guidance asks for specialist intelligence that businesses and
agents would pay for when a frontier model cannot establish an answer. The
validated rail already proves one commercial primitive — an agent can buy a
screen and make the payment decision auditable — but the product should now
move from call governance to repeatable transaction assurance.

| Priority         | Build                                                                  | Why it matters                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0 — implemented | Provider verdict adapters + canonical `clear / hit / review / unknown` | Explicit provider labels now run before recursive field guessing. Counterproof `CLEAR / REVIEW / BLOCK` maps to `clear / review / hit`; the raw response, provider verdict, and verdict source are hashed/linked into compliance evidence.                                                                   |
| P0 — implemented | Shareable evidence bundle per payment attempt                          | Each compliant-call artifact now carries a signed `evidenceBundle` linking screen, gate, settlement, artifact hashes, miner/source/list metadata, costs, policy evaluation, payment network, and replay metadata. `GET /api/telegraph/evidence/:runId` and `telegraph-demo.ts evidence <runId>` retrieve it. |
| P0 — implemented | Spend-guard policy on `compliant-call`                                 | `spendGuard` now supports max screening/total cost, permitted parent and screening miners/intents, subject allow/deny terms, consensus count, and budget id. Checks run before any payment and again before the parent purchase; violations block and are recorded.                                          |
| P1 — implemented | Stablecoin payment-guard workflow (Solana)                              | `compliant-call` now carries `settlement: {rail:"solana", payee, amountUsd, intentId}` — payee wallet + amount + rail → sanctions screen → gate → governed SPL USDC transfer via `SolanaSettlementService`. Mandate guards run before the paid screen; the transfer executes once per `intentId` only on gate approval; outcomes land as `settlementTransfer` in the evidence bundle and as a terminal node in `/verify`. See "Authorized settlement on Solana". |
| P1 — implemented | Human review path for compliance screens                              | A provider `review` verdict creates a paused gate-decision run in the existing approval inbox; `compliance.disputeHit: true` does the same for an explicitly disputed `hit`. Approval releases and rejection quarantines the review case, with `held_pending → released/quarantined` ledger states; it never silently clears the provider verdict or resumes the denied parent call. |
| P1 — implemented | Verification harness and benchmarks                                    | `telegraph-benchmark.ts` re-runs fixed public cases from `telegraph-benchmark-cases.json` against independent ground truth, emits JSON/Markdown reports with run ids, response/evidence hashes, cost, latency, review/unknown/error rates, and hit precision/recall including false positives/negatives. Optional `--baseline` compares an OpenAI-compatible frontier model; live execution still requires workspace auth and paid calls are explicit. |
| P2               | Quality/cost-aware miner router                                        | Selection today favors score then price. Add measured verifier agreement, historical error/review rates, latency, endpoint health, source freshness, and explicit source coverage; support fallback miners and dry-run quotes.                                                                               |
| P2               | Agent SDK/MCP surface                                                  | Expose `screenBeforeSpend`, `buyIntel`, `getEvidence`, `budgetStatus`, and `approveReview` as a small tool set with a per-request budget cap. This turns the API into something other agents can adopt without learning CRE internals.                                                                       |
| P3               | Workflow templates                                                     | Package verticals only after the primitives above: stablecoin treasury compliance; procurement/vendor due diligence (existing Canton + Anjoman rail); pre-trade settlement/liquidity checks; contract/filings/document authenticity; logistics and physical-world checks.                                    |

The first build slice — verdict adapters, evidence bundle, and spend-guard
policy — is implemented and covered by focused unit tests, as are the
compliance review path and fixed-case benchmark harness. The next product
slice is the stablecoin payment-intent workflow, because it turns independent
screening into a governed settlement decision. Do not expand first into
generic model routing or a broad miner marketplace; neither produces a
governed paid action with independently checkable evidence.

## Season I retrospective

Season I Track 3 podium: Scam Shield (0.69/1), Truvian Shield (0.59/1),
ProofPact (0.45/1). We did not place. Analysis written 2026-09-28 after the
official results post and a full review of the Track 1 winner's public repo
([PugarHuda/amanat](https://github.com/PugarHuda/amanat) — entered all three
tracks from one codebase: signed weather miner, no_std WASM scorer, ERC-8183
parametric-cover contract).

### What the winners did that we didn't

1. **They closed a loop with a visible consequence.** Scam Shield flags a real
   Gmail email or SMS; Truvian Shield returns SAFE/CAUTION/BLOCK before a
   transaction is signed; ProofPact settles a payment; amanat's contract pays
   out a claim by itself when a reading crosses its trigger. Our digest's
   terminal state is a counter in `data/telegraph-stats.json` and a "held for
   review" status nothing can ever act on — the one-way door our own repo
   rules call a bug. Judging rewards "ranked intelligence changed something",
   not "ranked intelligence was logged".
2. **They did not trust the unverifiable number.** Our gate is the miner's
   self-declared `confidence_field`. Amanat's sharpest finding: the network's
   own `verified: true` cannot be re-derived from outside, so they Ed25519-sign
   every answer over the settle fields and let anyone re-verify with one
   `node -e` line. A governance layer whose only input is a self-reported
   confidence is the very thing we claim to protect against — it needs
   cross-miner agreement or signature attestation to be self-consistent.
3. **They measured the network first; the measurement became the product.**
   Amanat's repo leads with reproducible findings: prose-comparing scorers
   rank deterministic-intent miners at 0.02; 341 miner registrations vs 14
   on-chain jobs; only 29/125 miners can receive a job at all. Each gap was
   itself a track entry. We wrote a criteria-alignment proposal instead of a
   network audit.
4. **They engineered distribution and "users acquired".** `amanat-mcp`
   published to npm and listed in the official MCP registry, a `storm` CLI, a
   shipping-lane board refreshed by GitHub Actions every 6h, an 84s film cut
   from live Playwright sessions. Our surfaces were one dashboard page + one
   demo script, and the required demo video never shipped (the checklist item
   stayed "in progress" through the deadline; our Remotion renders postdate
   it).
5. **They played all three sides of the flywheel.** The official recap frames
   Season I's result as the interaction between tracks
   (Intelligence → Evaluation → Ranking → Demand → Better Intelligence). We
   deliberately entered Track 3 only; the supply and evaluation sides stayed
   empty for us.

### What we did well — keep it

- Real x402 payments with an honest `paymentReady` gate; no mocked calls.
- Fail-safe holds: absent confidence is "unknown", never auto-approved,
  never fabricated.
- Demand-driven consumption from the daemon's organic signal feed instead of
  canned-query metric farming. The organizers later disqualified scripted
  call inflation (amanat had to stop its paid board runs for this); our
  modest 6h cadence was the right instinct.
- Real cost discipline through the existing governance pipeline — Truvian
  Shield's prize-winning idea is nearly identical to ours, executed with
  sharper evidence presentation.

### Network facts worth knowing before Season II (from amanat's bug report)

- The engine-ask path strips the confidence field (we worked around it with
  direct miner-dispatcher calls); this is by-design fragile.
- Deterministic intents are scored by text-overlap modules; numeric answers
  rank ~0 unless the scoring module grades measurements. Relevant to any
  Evaluator-track entry we build.
- ERC-8183 job params did not reach miners as documented (`lat=0, lon=0`
  bug); the on-chain job rail is real but thin. Verify before building on it.
- `verified: true` is not externally checkable — treat as an untrusted
  upstream claim, same as any miner output.

## Season II direction

> **Status (2026-11-14):** Season II is live (Nov 1 – Dec 1 2026, $10K, 3
> tracks). We entered Track 03 Apps & Agents on missions 02 (agent expense
> ledger + compliance-on-payment) and 10 (model economy). Items 1–3 below
> shipped; see the [S2 submission doc](./HACKATHON_SUBMISSION_TELEGRAPH_S2.md)
> for live evidence. Submission form opens later via Anjoman
> (anjoman.ai → dashboard → Hackathon).

Season II: ~30 days, $10K pool, same three tracks (Miner, Evaluator,
Application/Agent across 15 commercial missions); rules and prize split
publish with the Season II page at telegraphprotocol.com. Registration opens
there before the event starts.

Ordered by leverage-to-effort, to start when Season II rules publish:

1. **Fix the hold path** (prerequisite for everything else). An approval
   inbox in the UI where held `telegraph.signal` artifacts can be reviewed,
   released, or rejected, with the decision written back to CRE. Turns our
   strongest feature (the fail-safe hold) from a dead end into a demoable
   loop.
2. **Close one loop inside a commercial mission.** Pick a mission where
   ranked intelligence triggers a governed action with a visible outcome —
   natural fit: Canton sealed-bid rounds where vendor-selection intelligence
   (price/reputation/risk from ranked miners) feeds reserve pricing or bid
   evaluation and settles on the ledger we already run live. That is
   "Telegraph inside a larger autonomous workflow", the phrasing they used
   for ProofPact.
3. **Make approval verifiable.** Cross-miner agreement (buy the same fact
   from 2+ miners, hold on disagreement) and/or require signed attestations
   where available. Then "governed" is something a judge can check, not just
   a threshold on a self-report.
4. **Enter the Evaluator track too.** Our confidence-threshold + policy
   machinery is an evaluation opinion we currently keep private; a scoring
   module that grades answers as measurements (amanat's approach) is the
   template. Week-1 deliverable: a network-audit script (like
   `audit-jobable.mjs`) whose reproducible findings double as X-post content
   and product direction.
5. **Ship distribution surfaces.** MCP server exposing governed Telegraph
   calls (`npx` one-liner, registry listing), a CLI, and the demo video cut
   from live sessions — we already have the recording pipeline
   (`tooling/scripts/demo/record-demo-video.ts`), Season I simply ran out of
   week.
6. **Surface spend ceilings in the artifact.** Per-call and per-run caps
   (amanat's `ASK_CEILING` pattern) so every receipt shows the budget that
   bounded it.

Budget note: scripted paid calls may be excluded from judging. Keep the
digest demand-driven (daemon signals only) and add per-run spend ceilings
before increasing any cadence.

## Enterprise extension: supplier diligence (model-agnostic)

Part of the Season II submission. Telegraph's team asked for a commercial
Qwen/Alibaba Cloud example; what was built is a **model-agnostic supplier
onboarding diligence** comparison — any OpenAI-compatible model works, Qwen
is simply the first config entry, not a backend class.

- **Model alone** evaluates the supplier and returns a
  `proceed`/`hold`/`reject` recommendation, with usage and USD cost recorded.
- **Model + Cognivern + Telegraph** runs the same task under a mandate and
  spend cap: a fixed compliance gate buys paid specialist evidence through
  Telegraph first, and only when the gate has not already decided does the
  same model synthesize a recommendation from that evidence.

**Named OpenAI-compatible providers.** `OPENAI_COMPAT_PROVIDERS` is a
comma-separated list of backend ids (`qwen`, `cerebras`, …); each id reads
`OPENAI_COMPAT_<ID>_BASE_URL` / `OPENAI_COMPAT_<ID>_API_KEY` and becomes a
selectable `backend` on sponsored-credit programs with the same
per-program-credential-with-env-fallback behaviour as the built-in provider.
A stored credential whose provider does not match the program's backend is
treated as absent, so a key is never sent to the wrong upstream. The
existing Groq `openai-compat` route is untouched. USD pricing comes from
the existing `GATEWAY_STATIC_PRICES` mechanism — no code change.

**Two-step compliant-call flow.** Per case, specialist evidence is bought
once and reused for every model: step 1 screens the supplier name with miner
`731002` (`SANCTIONS_SCREENING_MATCH`) gating a `CORPORATE_REGISTRY_LOOKUP`
purchase from miner `7393`; step 2 — only when step 1 is `clear` — screens
with miner `710637` (same intent) with `disputeHit: true` so a disagreeing
hit routes to the approval inbox, gating a `VENDOR_VERIFY` purchase from
miner `7396`.

**Gate-then-model policy.** An undisputed sanctions `hit` rejects; any
review/unknown verdict, held step, error, spend-guard block, missing second
screen, or unpaid parent purchase holds for human review; only a clean run
lets the model decide with the specialist payloads attached. A hold can also
come from the confidence gate holding a purchased specialist payload that
arrived with low or unknown confidence — those land in the same approval
inbox, and the gate's `reasons` record which path held each case. This is
the declared fixture policy, not legal advice.

**Runner.** `pnpm telegraph:diligence` (`tooling/scripts/agents/telegraph-diligence.ts`)
reads `telegraph-diligence-cases.json` (four fixed suppliers: an OFAC-listed
entity, a registered-and-clear entity, an unregistered entity, and an
individual name-match that screens to review), enforces a
`--max-spend-usd` cap on specialist calls (default $0.25), and emits a
`cognivern.telegraph.diligence-report.v1` JSON + Markdown report with run
ids, evidence hashes, per-model decisions, and costs. Models are configured
via `DILIGENCE_MODELS` plus per-label `DILIGENCE_<LABEL>_BASE_URL`,
`_API_KEY`, `_MODEL`, optional `_PROVIDER`, `_INPUT_USD_PER_MTOK`,
`_OUTPUT_USD_PER_MTOK`, and `_GATEWAY_KEY` (routes the governed synthesis
call through the Cognivern gateway at `/v1/chat/completions`). A model label
missing config is skipped, never an error; with zero usable models the
specialist evidence phase still runs and is reported.

`--public-out <path>` additionally writes a redacted public report
(`cognivern.telegraph.diligence-public-report.v1`) — a whitelist copy:
decisions, rationales, costs, evidence hashes and run ids, but no API hosts,
keys, error strings or raw specialist payloads. Published under
`src/frontend/public/evidence/diligence/<id>.json` (`--report-id` sets the
id), it is viewable by anyone at `/verify?report=<id>` — the diligence mode
of the public verification page.

**Honesty bounds.** Specialist payments are testnet x402 micropayments;
screening verdicts are paid miner assertions, not independent ground truth;
expected decisions follow the declared fixture policy; a hold can come from
the compliance review path or the confidence gate — both land in the
approval inbox; a handful of cases is
evidence of the mechanism, not broad coverage. This is
an enterprise example, not a claim of Alibaba partnership.

**Observed results (2026-11-24, qwen4-max via Alibaba Model Studio
Singapore + gemini-3.6-flash via Google AI Studio + openai/gpt-oss-20b
via Groq, all direct calls).**
All four cases ran live against production compliant-call; specialist
evidence was bought once per case and reused for all three models.
Governed changed five decisions vs model-alone across the three: Qwen
and Gemini alone **rejected** the OFAC individual name-match where
policy requires human review, Gemini and gpt-oss-20b alone
**proceeded** on the registered-clear supplier where the governed
model (with specialist payloads attached) still held, and gpt-oss-20b
alone **proceeded** on the unregistered supplier where governance
held on low-confidence evidence.
Governed 3/4 expected decisions for every model; alone 2/4 (qwen) and
3/4 (gemini, groq) — on disjoint cases. Specialist spend $0.10 of a
$0.25 cap across eight paid calls; model spend ≈$0.015 total; three
escalations and one rejection, all with run ids and evidence hashes in
the report. The public redacted report is
`src/frontend/public/evidence/diligence/supplier-diligence.json`, viewable
at `/verify?report=supplier-diligence`.
