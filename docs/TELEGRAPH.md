# Telegraph Protocol Integration

Governed consumption of Telegraph verified intelligence: agent miner calls
are confidence-gated, paid per-call in x402 USDC, and recorded as
`telegraph.signal` CRE artifacts linked to agent, mandate, and policy.

Submission history (Season I Track 3, concluded Sep 2026):
[`history/HACKATHON_SUBMISSION_TELEGRAPH.md`](./history/HACKATHON_SUBMISSION_TELEGRAPH.md)
and [`history/TELEGRAPH_TRACK3_PROPOSAL.md`](./history/TELEGRAPH_TRACK3_PROPOSAL.md).

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

| Component | Purpose | Location |
| --- | --- | --- |
| `TelegraphService` | Miner discovery, x402 payments, node/engine/daemon health | `src/backend/services/telegraph/` |
| `TelegraphGovernanceHelper` | Confidence routing + `telegraph.signal` artifacts | same |
| `TelegraphController` | `/api/telegraph/*` status + governed stats | `src/backend/modules/api/controllers/` |
| Signal digest agent | Scheduled governed consumption loop | `tooling/scripts/agents/telegraph-signal-digest.ts` |
| Demo script | End-to-end paid call | `tooling/scripts/demo/demo-telegraph.ts` (`pnpm demo:telegraph`) |

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
TELEGRAPH_REFRESH_INTERVAL_MS=300000
```

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
consumption counters the digest writes to `data/telegraph-stats.json`).

The in-product dashboard is `/telegraph` — categories, questions, and the
governed-consumption stats panel.

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

| Env | Default | Meaning |
| --- | --- | --- |
| `TELEGRAPH_SIGNAL_MIN_INTEREST` | `6` | Only consume signals at or above this interest |
| `TELEGRAPH_SIGNAL_LIMIT` | `5` | Max signals per run |
| `TELEGRAPH_LOOP_INTERVAL_MS` | unset | Continuous-mode cadence |

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

Every call records a `telegraph.signal` CRE artifact:

```ts
{
  type: "telegraph.signal",
  data: {
    agentId, workspaceId?, mandateId?, policyId?, description?,
    miner: { id, name, intent?, autoRouted? },
    signal: { data|answer, confidence: number|null, confidenceThreshold, confidenceMet },
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
  building, artifact creation).
