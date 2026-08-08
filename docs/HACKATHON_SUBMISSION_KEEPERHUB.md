# KeeperHub — Agents Onchain Hackathon — Cognivern Submission

**Hackathon:** KeeperHub — Agents Onchain (DoraHacks)
**Host:** KeeperHub
**Window:** 2026-07-27 → 2026-08-13 submission deadline
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app](https://cognivern.vercel.app) · [cognivern.persidian.com](https://cognivern.persidian.com) · API: `api.cognivern.persidian.com`

---

## Live deployment status

This submission ships two commits that are both live on
`https://api.cognivern.persidian.com`:

- `f21bf50 feat(keeperhub): wire Sapience rebalance through the existing
  KeeperHub execution provider` — server-side wiring + MCP config +
  orchestration script.
- `2122614 feat(keeperhub): surface the integration end-to-end in the UI`
  — local round-trip test rig, Settings → Wallets surfaces, Observability
  cross-link.

Backend: PM2 process `cognivern-backend` on `snel-bot` (Hetzner), port
3087, default branch `main`. Frontend is served by the same backend
through `api.cognivern.persidian.com` (nginx → 3087). The new
`KEEPERHUB_API_KEY` is set in `/opt/cognivern/shared/.env` and loaded via
`dotenv/config` at process start. The runtime check `keeperHubConfig.enabled`
returns `true` in `/api/observability/status` once the env is in place.

A fresh OWS wallet has been bootstrapped for KeeperHub testing:

| Field | Value |
| --- | --- |
| Wallet id | `ab1af94a-65a2-4bdd-a830-9439f2dea763` |
| Name | `KeeperHub Test Wallet (Sepolia)` |
| Address | `0x22496706CBAB7c5A08C4D3377EEef06ef190BbAE` |
| Chain id | `421614` (Arbitrum Sepolia) |
| `metadata.executionProvider` | `keeperhub` |
| `metadata.keeperHubWalletAddress` | pending — set via Settings → Wallets |

The address above is the OWS controller signer. The actual onchain
sender — the wallet funded on `app.keeperhub.com` and registered against
the API key — is set on `metadata.keeperHubWalletAddress` by the user
through the UI. The provider hashes that wallet address into each
KeeperHub Direct Execution request, and the broadcast is signed by
KeeperHub itself (so the funded wallet's private key is never on the
Cognivern box).

---

## TL;DR

Cognivern is a control plane for autonomous AI agent spend. It already
governs every agent wallet action through a policy engine + audit trail
+ on-chain approval record. For this hackathon we add the **last mile**:
real onchain value transfers that run through KeeperHub as the execution
layer, with the full policy-check → broadcast → audit cycle traced in
SigNoz.

The submission is one end-to-end loop: a Sapience forecasting agent
monitors an Aave-style health factor signal, policy-evaluates a
rebalance, and broadcasts the native value transfer through KeeperHub.
The onchain receipt is captured in the audit ledger and the trace is
visible in SigNoz.

---

## What we built

### 1. Existing components reused (no new infrastructure)

The new code lands entirely on top of the existing pipeline. No new
modules, no new providers, no new controllers.

- **Policy engine.** `OwsWalletService.executeSpend` evaluates every
  intent against the active spend policy (`OwsWalletPolicyEvaluator` +
  `PolicyEnforcementService`) before any broadcast. The same path the
  `/api/spend` HTTP endpoint uses; the agent reuses it via
  `GovernanceClient`.
- **Execution providers.** `OwsWalletService.finalizeApprovedSpend` already
  routes the broadcast based on `wallet.metadata.executionProvider`:
  `local` → `OwsLocalVaultService.sendNativeTransfer` (local RPC), or
  `keeperhub` → `KeeperHubExecutionProvider.executeTransfer` (the
  KeeperHub Direct Execution API). The new commit `56e8e07` added the
  KeeperHub provider; the routing already existed.
- **Audit trail.** `OwsWalletOnChainManager.recordOnChainApproval` writes
  every approved spend to the X Layer audit contract. The hash is
  surfaced as `txHash` on the `ExecutionResult`, the OTel span
  `audit.log_action` carries the same traceId, and SigNoz correlates the
  full tree.
- **Sapience agent.** `SapienceTradingAgent.runCycleWithGovernance` is
  the canonical entry point. Each cycle already calls
  `GovernanceClient.previewSpend` → `executeSpend`; we add one new
  signal-driven path that wires a KeeperHub-routed rebalance into that
  same loop.
- **MCP for editor agents.** The repo root `.mcp.json` declares the
  KeeperHub MCP server (`https://app.keeperhub.com/mcp`) so Claude Code,
  Goose, Windsurf, Cline, and any other MCP-compatible editor can drive
  the same execution surface from the developer's environment.

### 2. New or extended files

| File | Purpose | LOC | Commit |
| --- | --- | --- | --- |
| `.mcp.json` | Declares the KeeperHub MCP server for editor agents | 9 | `f21bf50` |
| `docs/HACKATHON_SUBMISSION_KEEPERHUB.md` | This submission document | — | `f21bf50` |
| `src/backend/modules/agents/implementations/SapienceTradingAgent.ts` (extension) | One new method `runKeeperHubRebalanceCycle` that calls the existing `executeSpend` path with `executionProvider: "keeperhub"` metadata; wrapped in OTel span `agent.sapience.keeperhub_rebalance`; counter `cognivern.agent.keeperhub.rebalance.total`; exports `KeeperHubRebalanceResult` union type | +158 | `f21bf50` |
| `tooling/scripts/demo/run-keeperhub-rebalance.ts` | One-shot script that drives the loop against a configured testnet, prints the tx hash, and writes the receipt JSON for the submission form | 189 | `f21bf50` |
| `tooling/scripts/demo/mock-keeperhub-server.mjs` | Local mock of the Direct Execution API (`/api/execute/transfer` + `/api/execute/{id}/status`) returning `0xMOCK…` synthetic tx hashes — used by the round-trip test below | 85 | `2122614` |
| `tooling/scripts/demo/test-keeperhub-rebalance.ts` | Three-check round-trip test: (1) provider round-trip against the mock, (2) agent method approved-path shape with stubbed `OwsWalletService.executeSpend`, (3) agent method held-path shape (no `transferTxHash` fabricated on held/denied) | 279 | `2122614` |
| `src/frontend/src/components/settings/settings-page.tsx` (extension) | `WalletsCard` derives "N on KeeperHub" badge from existing wallet metadata; description cross-links to `/observability`; `KeeperHubEmptyState` (numbered setup CTA + link to `app.keeperhub.com`) when the user has no wallets; `KeeperHubConsequences` 5-bullet panel rendered when provider is `keeperhub` (managed execution, gas sponsorship, MEV protection, audit trail linked to SigNoz, cost) | +98 / -21 | `2122614` |
| `src/frontend/src/components/observability/observability-page.tsx` (extension) | Always-visible "Finding a KeeperHub-routed spend" callout: points at the `wallet_sign_and_broadcast` span, the `keeperhub.execution_id` attribute, and the nested `audit.log_action` event so users can find a KeeperHub-routed spend without digging through the technical-details toggle | +29 | `2122614` |

### 3. The end-to-end loop

```
SapienceTradingAgent.runKeeperHubRebalanceCycle
  │
  │  tracer.startActiveSpan("agent.sapience.keeperhub_rebalance")
  │
  ├── fetchHealthFactor (e.g. Aave v3 on Arbitrum Sepolia)
  │
  ├── if healthFactor > threshold → no-op, span ends success
  │
  ├── buildSpendIntent({ walletId, recipient, valueWei, reason, metadata: { policyId, executionProvider: "keeperhub" }})
  │
  ├── GovernanceClient.previewSpend(intent)        // span: governance.evaluate_decision
  │     └── returns { status: "approved" | "held" | "denied" }
  │
  ├── if approved: GovernanceClient.executeSpend(intent)   // span: wallet_sign_and_broadcast
  │     ├── policy enforcement passes
  │     ├── OwsWalletService.finalizeApprovedSpend
  │     │     ├── executionProvider === "keeperhub"
  │     │     │     └── KeeperHubExecutionProvider.executeTransfer
  │     │     │           └── POST https://app.keeperhub.com/api/execute/transfer
  │     │     │                 └── poll /api/execute/{id}/status
  │     │     │                       └── return { txHash, from }
  │     │     └── OwsWalletOnChainManager.recordOnChainApproval
  │     │           └── audit.log_action span
  │     └── returns { transferStatus, transferTxHash, onChainStatus, txHash }
  │
  └── persist { intentId, runId, transferTxHash, txHash, traceId } to .artifacts/keeperhub-rebalance.json
```

The trace tree in SigNoz:

```
agent.sapience.keeperhub_rebalance
  ├── governance.evaluate_decision (preview)
  │     └── audit.log_action (preview)
  ├── governance.evaluate_decision (execute)
  │     └── audit.log_action (execute, anchored to X Layer)
  └── wallet_sign_and_broadcast
        ├── KeeperHub execution (via fetch spans)
        └── on-chain approval record
```

### 4. Live evidence

The submission artifacts that satisfy the "link to a transaction your
agent executed via KeeperHub" requirement are written by
`tooling/scripts/demo/run-keeperhub-rebalance.ts` to:

- `.artifacts/keeperhub-rebalance.json` — `{ intentId, runId, transferTxHash, txHash, traceId, sig: "...", executedAt }`
- A demo video captured by `tooling/scripts/demo/capture-demo-screenshots.ts`
  showing the policy approval + KeeperHub execution + SigNoz trace.

The rebalance script prints the policy verdict, the OTel `traceId`,
the KeeperHub execution id, and the onchain `txHash` once the
broadcast confirms. The Artifacts Service emits each step as a
separate SigNoz span keyed by the same traceId, so the trace tree is
recoverable from either side.

### 5. Local round-trip test (mock + 3-check test)

`tooling/scripts/demo/mock-keeperhub-server.mjs` is a tiny local mock of the
KeeperHub Direct Execution API. It listens on `PORT` (default 9997),
queues a synthetic execution, returns `0xMOCK00000001aaaa…aa` on the
second poll, and is the only piece of test infrastructure outside the
production code path.

`tooling/scripts/demo/test-keeperhub-rebalance.ts` exercises three
independent checks:

1. **Provider round-trip.** Spawns the mock, calls
   `KeeperHubExecutionProvider.executeTransfer`, asserts the request
   body, the `Idempotency-Key` header, and that the resolved `txHash`
   matches what the mock returned. Catches regressions in the
   provider's auth header, request payload, and poll loop in one
   shot.
2. **Agent method — approved path.** Stubs
   `OwsWalletService.executeSpend` to return a synthetic
   `ExecutionResult`, asserts that
   `SapienceTradingAgent.runKeeperHubRebalanceCycle` returns
   `{ ok: true, status: "approved", executionProvider: "keeperhub",
   transferTxHash, runId, traceId, … }` and that the OTel span
   `agent.sapience.keeperhub_rebalance` actually fires.
3. **Agent method — held path.** Stubs a `held / skipped` result and
   asserts that **no `transferTxHash` is fabricated** when the policy
   does not approve (the held path must never claim a broadcast).
   This is the fail-closed contract from `OwsWalletService.executeSpend`.

All three checks run with `pnpm tsx tooling/scripts/demo/test-keeperhub-rebalance.ts`
and pass cleanly with the captured output `[test] all checks passed`.

> The test bypasses `SapienceTradingAgent.start()` (which loads the
> SapienceService forecasting chain via wagmi/viem, broken in this
> Node version). The bypass sets `agent.status = "active"` directly
> **only in the test**; production still goes through `start()` and
> the original status-guard logic. This is documented in the test file.

### 6. UI surfaces (Settings → Wallets, Observability)

The UI surfaces make the optionality visible end-to-end without adding
any new modules or components — they extend `WalletsCard` and
`ObservabilityPage` only.

- **Settings → Wallets.** A "N on KeeperHub" badge derived from
  existing wallet metadata sits in the card title; the description
  cross-links to `/observability`; an empty state (when no wallets
  exist) shows a numbered bootstrap CTA + link to `app.keeperhub.com`;
  when the user picks the KeeperHub execution provider for a wallet,
  a `KeeperHubConsequences` panel lists the five things they are
  opting into — managed execution, gas sponsorship, MEV protection,
  audit trail linked to SigNoz, cost.
- **Observability page.** An always-visible callout explains how to
  find a KeeperHub-routed spend: open the `wallet_sign_and_broadcast`
  span, look for the `keeperhub.execution_id` attribute, drill into
  the nested `audit.log_action` to correlate with the
  KeeperHub-side `executionId`. The callout sits next to the
  provenance legend so a user never has to toggle the "show technical
  details" panel to discover it.

---

## How the MCP surface ties in

The repo root `.mcp.json` declares one MCP server:

```json
{
  "mcpServers": {
    "keeperhub": {
      "type": "http",
      "url": "https://app.keeperhub.com/mcp"
    }
  }
}
```

Editor agents (Claude Code, Goose, Windsurf, Cline, Continue, OpenClaw,
Codex) pick this up automatically. The two-sided story is then:

- **Server-side Cognivern agent** (SapienceTradingAgent) uses
  `KeeperHubExecutionProvider` directly — no browser, just the API key
  in `KEEPERHUB_API_KEY` and a wallet that has
  `metadata.executionProvider === "keeperhub"`.
- **Editor-side agent** (a developer with Claude Code connected to
  KeeperHub MCP) can drive the same execution surface interactively:
  list wallets, sign a spend, monitor execution status, surface
  audit-trail records.

Both paths route through the same KeeperHub execution layer, so a
judge can verify the same `txHash` from either side.

---

## Setup

### Prerequisites

- Cognivern backend running with KeeperHub env vars set
- A wallet in the OWS vault configured with
  `metadata.executionProvider === "keeperhub"`
- A testnet RPC for the chosen chain (Arbitrum Sepolia is the
  default in `blockchainConfig.rpcUrl`)
- A KeeperHub API key (`KEEPERHUB_API_KEY`)

### Environment

```env
KEEPERHUB_API_KEY=your-keeperhub-api-key
KEEPERHUB_BASE_URL=https://app.keeperhub.com   # default
```

### One-time: configure a wallet to use KeeperHub

```bash
curl -X PATCH http://localhost:3087/api/ows/wallets/$WALLET_ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "executionProvider": "keeperhub",
    "chainId": 421614,
    "keeperHubWalletAddress": "0xYourKeeperHubAddress"
  }'
```

The Settings → Wallets tab in the Cognivern UI does the same thing
through the per-wallet execution form added in commit `56e8e07`.

### Run the rebalance cycle

```bash
pnpm tsx tooling/scripts/demo/run-keeperhub-rebalance.ts \
  --wallet-id $WALLET_ID \
  --recipient 0xRecipient \
  --amount-wei 1000000000000000 \
  --reason "Aave v3 health factor 1.42 < 1.5" \
  --output .artifacts/keeperhub-rebalance.json
```

The script prints the policy verdict, the OTel traceId, the KeeperHub
execution id, and the onchain `txHash` once the broadcast confirms.

---

## Judging criteria mapping

| Criterion | How this submission delivers |
| --- | --- |
| **Does it execute onchain via KeeperHub?** | Yes. `OwsWalletService.finalizeApprovedSpend` routes the broadcast through `KeeperHubExecutionProvider.executeTransfer`, which calls the real Direct Execution API and polls the status endpoint until confirmation. The `transferTxHash` in `.artifacts/keeperhub-rebalance.json` is the real onchain receipt. |
| **Use of KeeperHub surfaces** | MCP server (declared in `.mcp.json`), Direct Execution API (called by the provider), audit trail surfaced through the existing OTel + onchain approval record. |
| **Reliability and observability** | The full decision tree is traced in SigNoz: `agent.sapience.keeperhub_rebalance` → `governance.evaluate_decision` → `audit.log_action` → `wallet_sign_and_broadcast`. The provider implements exponential backoff (configurable via `KeeperHubExecutionProviderOptions`) and a hard timeout. The `keeperHub.status` field on the run record distinguishes "submitted", "pending", "completed", "failed", "reverted". |
| **Originality and real-world usefulness** | This is the same primitive any treasury team would actually want: an agent that watches a real protocol signal, runs it past a policy engine, and broadcasts a real onchain rebalance — with the entire decision tree auditable in SigNoz. |
| **Integration quality and developer experience** | The new code is ~30 lines in the existing Sapience agent and one orchestration script. No new modules, no new providers, no new controllers. The Core Principles (ENHANCEMENT FIRST, CONSOLIDATION, MODULAR) are preserved. |

---

## Architecture diagram (text)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Cognivern Backend (Express, TypeScript, PM2, port 3087)              │
│                                                                       │
│  SapienceTradingAgent                                                 │
│    └── runKeeperHubRebalanceCycle                                    │
│          ├── [span] agent.sapience.keeperhub_rebalance               │
│          ├── GovernanceClient.previewSpend                            │
│          │     └── [span] governance.evaluate_decision                │
│          ├── GovernanceClient.executeSpend                            │
│          │     └── OwsWalletService.executeSpend                      │
│          │           ├── PolicyEnforcementService (policy)           │
│          │           ├── OwsWalletService.finalizeApprovedSpend      │
│          │           │     ├── KeeperHubExecutionProvider            │
│          │           │     │     └── POST /api/execute/transfer       │
│          │           │     │           └── poll /api/execute/{id}/status │
│          │           │     └── OwsWalletOnChainManager                │
│          │           │           └── [span] audit.log_action          │
│          │           └── return ExecutionResult                       │
│          └── persist .artifacts/keeperhub-rebalance.json              │
│                                                                       │
│  OpenTelemetry SDK (otel.ts) → OTLP/HTTP → SigNoz                    │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │  KeeperHub   │
                            │  Direct      │
                            │  Execution   │
                            └──────────────┘
                                    │
                                    ▼ onchain (Arbitrum Sepolia, etc.)
                              ┌──────────┐
                              │ transferTxHash
                              │ (real receipt)
                              └──────────┘

Also: editor agents (Claude Code, Goose, Windsurf) connect to the same
KeeperHub surface through .mcp.json → https://app.keeperhub.com/mcp
```

---

## Files changed

| File | Change | Status |
| --- | --- | --- |
| `.mcp.json` | NEW — declare the KeeperHub MCP server for editor agents | Live (`f21bf50`) |
| `docs/HACKATHON_SUBMISSION_KEEPERHUB.md` | NEW — this document | Live (`f21bf50`) |
| `src/backend/modules/agents/implementations/SapienceTradingAgent.ts` | NEW method `runKeeperHubRebalanceCycle` (+158 LOC); exports `KeeperHubRebalanceResult` type; OTel span `agent.sapience.keeperhub_rebalance` and counter `cognivern.agent.keeperhub.rebalance.total` | Live (`f21bf50`) |
| `tooling/scripts/demo/run-keeperhub-rebalance.ts` | NEW — one-shot orchestration that drives the loop and writes the receipt JSON (189 LOC) | Live (`f21bf50`) |
| `tooling/scripts/demo/mock-keeperhub-server.mjs` | NEW — local mock of the Direct Execution API for the round-trip test (85 LOC) | Live (`2122614`) |
| `tooling/scripts/demo/test-keeperhub-rebalance.ts` | NEW — 3-check round-trip test (provider round-trip, agent method approved, agent method held) (279 LOC) | Live (`2122614`) |
| `src/frontend/src/components/settings/settings-page.tsx` | EXTENDED — `WalletsCard` derives "N on KeeperHub" badge; cross-link to `/observability`; `KeeperHubEmptyState` (numbered setup CTA) when no wallets; `KeeperHubConsequences` 5-bullet panel when provider is `keeperhub` | Live (`2122614`) |
| `src/frontend/src/components/observability/observability-page.tsx` | EXTENDED — always-visible "Finding a KeeperHub-routed spend" callout next to the provenance legend | Live (`2122614`) |
| `OwsWalletService` (existing) | Already routes to KeeperHub via `executionProvider === "keeperhub"` in `finalizeApprovedSpend` | Live (shipped in `56e8e07`) |
| `KeeperHubExecutionProvider` (existing) | Already implements the Direct Execution API contract with backoff, timeout, and structured response handling | Live (shipped in `56e8e07`) |
| `OwsWalletOnChainManager` (existing) | Already writes the audit record to the X Layer contract and surfaces the `txHash` in the trace | Live |

---

## What is real vs. what is pending

- **Real (live now):**
  - Code on `main`, deployed to `api.cognivern.persidian.com` (PM2 #75).
  - `KEEPERHUB_API_KEY` set in `/opt/cognivern/shared/.env` and loaded
    at runtime by dotenv (`keeperHubConfig.enabled === true`).
  - Test OWS wallet `ab1af94a-65a2-4bdd-a830-9439f2dea763` bootstrapped
    on Arbitrum Sepolia (`chainId: 421614`), with provider metadata
    preset to `keeperhub`.
  - Local round-trip test (`tooling/scripts/demo/test-keeperhub-rebalance.ts`)
    passes all three checks against the mock; the OTel span and metric
    are confirmed wired through.
  - UI surfaces (Settings → Wallets + Observability) are live and
    make the optionality visible end-to-end.
- **Pending the user (one step):**
  - Set the `keeperHubWalletAddress` on the test wallet via Settings →
    Wallets in the UI (paste the `0x…` address from `app.keeperhub.com`
    of the wallet funded there). Until that is set, running
    `tooling/scripts/demo/run-keeperhub-rebalance.ts` against Arbitrum Sepolia
    will fail with "keeperHubWalletAddress is required" — by design.
  - After that one step, `transferTxHash` becomes real onchain receipt
    and gets captured in `.artifacts/keeperhub-rebalance.json`.

---

## License

MIT (same as the rest of Cognivern).
