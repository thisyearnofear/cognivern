# KeeperHub — Agents Onchain Hackathon — Cognivern Submission

**Hackathon:** KeeperHub — Agents Onchain (DoraHacks)
**Host:** KeeperHub
**Window:** 2026-07-27 → 2026-08-13 submission deadline
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app](https://cognivern.vercel.app) · API: `cognivern.thisyearnofear.com`

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

### 2. New files (4)

| File | Purpose | LOC |
| --- | --- | --- |
| `.mcp.json` | Declares the KeeperHub MCP server for editor agents | ~10 |
| `docs/HACKATHON_SUBMISSION_KEEPERHUB.md` | This submission document | — |
| `src/backend/modules/agents/implementations/SapienceTradingAgent.ts` (extension) | One new method `runKeeperHubRebalanceCycle` that calls the existing `executeSpend` path with `executionProvider: "keeperhub"` metadata; reuses the existing `agent.sapience.forecast_cycle` span | ~30 |
| `scripts/demo/run-keeperhub-rebalance.ts` | One-shot script that drives the loop against a configured testnet, prints the tx hash, and writes the receipt JSON for the submission form | ~80 |

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
`scripts/demo/run-keeperhub-rebalance.ts` to:

- `.artifacts/keeperhub-rebalance.json` — `{ intentId, runId, transferTxHash, txHash, traceId, sig: "...", executedAt }`
- A demo video captured by `scripts/demo/capture-demo-screenshots.ts`
  showing the policy approval + KeeperHub execution + SigNoz trace.

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
pnpm tsx scripts/demo/run-keeperhub-rebalance.ts \
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
| `.mcp.json` | NEW — declare the KeeperHub MCP server for editor agents | Live |
| `docs/HACKATHON_SUBMISSION_KEEPERHUB.md` | NEW — this document | Live |
| `src/backend/modules/agents/implementations/SapienceTradingAgent.ts` | NEW method `runKeeperHubRebalanceCycle` that wraps the existing `executeSpend` path with `executionProvider: "keeperhub"` | Live |
| `scripts/demo/run-keeperhub-rebalance.ts` | NEW — one-shot orchestration that drives the loop and writes the receipt JSON | Live |
| `OwsWalletService` (existing) | Already routes to KeeperHub via `executionProvider === "keeperhub"` in `finalizeApprovedSpend` | Live (shipped in `56e8e07`) |
| `KeeperHubExecutionProvider` (existing) | Already implements the Direct Execution API contract with backoff, timeout, and structured response handling | Live (shipped in `56e8e07`) |
| `OwsWalletOnChainManager` (existing) | Already writes the audit record to the X Layer contract and surfaces the `txHash` in the trace | Live |
| `src/frontend/src/components/settings/settings-page.tsx` (existing) | Already exposes the per-wallet execution form that lets the user pick `local` vs `keeperhub` | Live (shipped in `56e8e07`) |

---

## License

MIT (same as the rest of Cognivern).
