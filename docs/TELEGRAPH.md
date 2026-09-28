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
