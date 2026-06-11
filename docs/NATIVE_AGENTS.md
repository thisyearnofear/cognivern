# Native Agents — Governed Spend Integration

This document explains how Cognivern's two native trading agents
(`SapienceTradingAgent` and `UserTradingAgent`) route their actions
through Cognivern's own governance pipeline — the same
`/api/governance/evaluate → /api/spend/preview → /api/spend` flow used
by the Cognivern Copilot submission agent and by every external API
caller.

## Why

Before this change, the trading agents called Sapience / RPC / etc.
directly and used a stubbed `checkCompliance` that always returned
`{ isCompliant: true }`. That made the "governed spend" story
incoherent: the platform that *governs* other agents' spend did not
govern its own. Judges of the MongoDB submission noticed this.

After this change, every external action an agent takes — a forecast
attestation on Arbitrum, a USDe trade on Ethereal, a simulated
user-agent trade — is logged in the same audit trail as the Copilot's
spends. There is one policy engine, one audit log, one source of truth.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Cognivern Backend (single Node process)                        │
│                                                                 │
│  ┌────────────────────┐    ┌──────────────────────────────┐    │
│  │ SapienceTrading    │    │ UserTradingAgent             │    │
│  │ Agent              │    │                              │    │
│  │                    │    │                              │    │
│  │ - forecast cycle   │    │ - user-owned agents          │    │
│  │ - EAS attestation  │    │ - simulated trades           │    │
│  │ - USDe trades on   │    │                              │    │
│  │   Ethereal PM      │    │                              │    │
│  └──────────┬─────────┘    └──────────┬───────────────────┘    │
│             │                         │                        │
│             │  GovernanceClient       │                        │
│             │  (HTTP loopback)        │                        │
│             ▼                         ▼                        │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  /api/governance/evaluate                            │     │
│  │  /api/spend/preview                                  │     │
│  │  /api/spend                                          │     │
│  │  /api/audit/logs                                     │     │
│  └──────────────────────┬───────────────────────────────┘     │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  PolicyService                                       │     │
│  │  - sapience-trading-policy                           │     │
│  │  - spend-governance-policy                           │     │
│  │  - trading-competition-policy                        │     │
│  │  - test-policy                                       │     │
│  └──────────────────────┬───────────────────────────────┘     │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  PolicyEnforcementService                            │     │
│  │  - rules evaluation                                  │     │
│  │  - ChainGPT contract audit                           │     │
│  │  - AuditLogService                                   │     │
│  │  - optional Fhenix FHE for confidential policies     │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │                              │
            │ Sapience SDK                 │ AuditLogService
            ▼                              ▼
   ┌─────────────────┐            ┌──────────────────────┐
   │ Sapience        │            │ Audit log            │
   │  - GraphQL API  │            │  - JSONL fallback     │
   │  - EAS (Arbitrum)│            │  - MongoDB (if set)  │
   │  - Ethereal PM  │            │                      │
   └─────────────────┘            └──────────────────────┘
```

## The flow per Sapience cycle

`SapienceTradingAgent.runCycleWithGovernance()` is the canonical entry
point. The orchestrator (`AgentOrchestrator.registerAgent`) calls it
in place of the legacy `performForecastCycle()` for Sapience agents.

1. **Fetch condition** — `AutomatedForecastingService.fetchOptimalCondition()`
   hits Sapience GraphQL for an open, public condition with future
   `endTime`.

2. **Generate forecast** — multi-provider LLM (Cerebras → Groq →
   Routeway) produces a probability and reasoning.

3. **Governance: forecast attestation** — `GovernanceClient.evaluate()`
   posts to `/api/governance/evaluate` with action type
   `sapience_forecast_attestation`. The `sapience-trading-policy` rule
   `forecast-attestation-budget` blocks if gas cost would exceed $1.

4. **Submit attestation** — on approval, `SapienceService.submitForecast()`
   publishes the EAS attestation on Arbitrum.

5. **Fetch market price** — if forecast confidence is high (≥ 0.6),
   `SapienceService.getMarketPrice()` retrieves the current YES/NO
   price from Sapience GraphQL.

6. **Compute edge** — `SapienceService.calculateEdge(forecast, market)`.
   If `|edge| ≤ 0.1`, skip the trade and return.

7. **Governance: trade preview** — `GovernanceClient.previewSpend()` posts
   to `/api/spend/preview` with:
   - `agentId = sapience-agent-1`
   - `policyId = sapience-trading-policy`
   - `recipient = market condition id`
   - `amount = 10 USDe in atomic units (10e18)`
   - `asset = USDe`
   - metadata carries `tradeType: "mint"`, side, confidence, edge, etc.

   The policy enforces:
   - `vendor-must-be-sapience-market` — only Sapience allowed
   - `asset-must-be-usde` — only USDe allowed
   - `per-trade-cap` — 50 USDe max per trade
   - `daily-cap` — 200 USDe max per day
   - `low-confidence-deny` — confidence must be ≥ 0.3
   - `no-stale-forecasts` — forecast must be < 1h old
   - `human-confirm-above-threshold` — trades ≥ 10 USDe require human confirmation

8. **Human confirmation gate** — if the preview returns
   `humanConfirmationRequired: true` (or trade > 5 USDe in dev), the
   agent looks for a token in `SAPIENCE_HUMAN_CONFIRM_TOKEN`. If
   absent, the trade is held (no execution) and surfaced in the audit
   log for the operator to confirm later.

9. **Execute on Sapience** — `SapienceService.executeTrade()` calls
   `prepareForTrade` (USDe wrap + approval) then `mint` on the Ethereal
   prediction market.

10. **Verify audit** — `GovernanceClient.recentAudit({ agentId })`
    confirms the trade was written to the audit trail.

## Failure modes

- **Governance API unreachable** — the agent fails closed. `checkCompliance`
  returns `{ isCompliant: false }` with severity `critical` and the
  reason "governance unreachable". The trade does not execute. This is
  intentional: better to miss a trade than to make an ungoverned one.
- **Preview denied** — the trade is not executed, the denial is recorded
  in the audit log with the matched rules.
- **Held for confirmation** — the trade is not executed, the hold is
  recorded in the audit log. The operator must set
  `SAPIENCE_HUMAN_CONFIRM_TOKEN` (or call
  `POST /api/spend/{decisionId}/confirm` via the UI) for the trade to
  proceed.
- **LLM providers exhausted** — `AutomatedForecastingService` falls back
  to a 50% probability response, which the policy allows but typically
  results in no trade (no edge).

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `COGNIVERN_SELF_BASE_URL` | `http://localhost:3000` | URL the agents use to call their own governance API |
| `COGNIVERN_API_KEY` | (required) | API key for governance calls |
| `SAPIENCE_HUMAN_CONFIRM_TOKEN` | unset | Static token for trades ≥ 10 USDe. In production the operator UI issues short-lived tokens per held trade. |
| `SAPIENCE_ENABLED` | `false` | Toggle whether the Sapience agent is registered on startup |

## How this serves the product vision

The product vision is *"governed spend for AI agents"*. Path A (this
doc) makes that vision operational for the platform's own native
agents, not just for external API callers. The submission agent (the
Cognivern Copilot) and the native Sapience / User agents now use the
same governance pipeline, so the demo is coherent: every agent in the
system, including our own, is governed by the same engine.
