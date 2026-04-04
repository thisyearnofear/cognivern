# OWS Hackathon

## Track 02: Agent Spend Governance & Identity

**Cognivern is SpendOS for OWS wallets** — a control plane for agent budgets, policy checks, approvals, and audit logs.

## One-Liner

> Give agents wallets without giving them blank checks.

## Problem

OWS gives agents wallets, API keys, and policy-gated signing. But once agents can spend money, teams still need per-agent budgets, approval thresholds, vendor/chain restrictions, operator visibility, and incident forensics.

## Solution

Cognivern evaluates proposed agent actions, records audit evidence, and gives operators a live view of approved, denied, and held actions — with the policy checks behind each decision.

## What Exists Today

- OWS wallet bootstrap into encrypted local storage (`POST /api/ows/bootstrap`)
- Delegated OWS API-key issuance (`POST /api/ows/api-keys`)
- Policy creation and evaluation (`POST /api/governance/policies`, `POST /api/governance/evaluate`)
- Governed spend execution (`POST /api/spend`)
- Audit trail and run-ledger views (`GET /api/audit/logs`, `GET /api/cre/runs`)
- Operator UI with policy, audit, and run-ledger surfaces

## Demo Flow

```
Policy → Preview (simulate) → Execute (sign) → Audit (review)
```

1. **Create Policy** — custom spend policy via `/api/governance/policies`
2. **Bootstrap Wallet** — `POST /api/ows/bootstrap`
3. **Issue API Key** — `POST /api/ows/api-keys` with scoped bindings
4. **Preview Spend** — `POST /api/spend/preview` (dry-run, shows would-execute outcome)
5. **Execute Spend** — `POST /api/spend` (actual signing)
6. **Review Audit** — `GET /api/audit/logs` shows DENY/HOLD/APPROVED decisions

### Run the Live Demo

```bash
# Terminal 1: Start server
pnpm build && pnpm start

# Terminal 2: Run demo scenario
export COGNIVERN_URL=http://localhost:3000
export COGNIVERN_API_KEY=development-api-key
pnpm demo:live
```

### Screens to Show

| Page | Shows |
|------|-------|
| `/` | Dashboard with OWS status |
| `/agents` | Agents with different governance boundaries |
| `/policies` | Active policies and templates |
| `/audit` | Spend decisions with DENY/HOLD/APPROVED badges |
| `/runs` | Completed and pending spend executions |

### Talk Track

1. Start on `/agents`: "Cognivern is SpendOS for OWS wallets."
2. Show scoped API keys (not raw env private keys).
3. Move to `/audit`: show one allowed, one held, one denied spend with recorded reasons.
4. Move to `/runs`: show paused-for-approval and completed approved runs.
5. Close: "OWS handles wallets and signing; Cognivern handles oversight, approvals, and forensics."

## Decision Payload

Part A (wallet layer) emits this shape for Part B (operator UI):

```ts
type SpendDecision = {
  approved: boolean;
  state: "approved" | "held" | "denied";
  agentId: string;
  policyId: string;
  actionType: string;
  reason: string;
  policyChecks: Array<{ policyId: string; result: boolean; reason: string }>;
  timestamp: string;
  runId?: string;
};
```

## Scope Discipline

**Optimize for:** OWS-native wallet control, budget/restriction policies, approve-hold-deny flows, operator visibility, audit forensics, polished demo.

**Do not optimize for:** generic multi-chain governance, old trading competition positioning, Bitte integrations, prediction-market demos.

## Submission Package

- **Project Name:** Cognivern
- **Track:** Track 02: Agent Spend Governance & Identity
- **Primary Angle:** SpendOS for teams
- **Secondary Angle:** Audit log forensics

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
