# Hackathon Submissions

## X Layer Arena — X Layer Hackathon

**Cognivern is SpendOS for agent wallets** — a complete onchain application for agent spend governance, deployed across X Layer (execution) and Filecoin (audit storage).

### Multi-Chain Architecture

| Layer | Chain | Purpose |
|-------|-------|---------|
| Execution & Policy | X Layer (chainId 1952 testnet) | Agent spend approvals, policy enforcement |
| Live Audit Anchoring | 0G Newton Testnet | Real-time governance decisions anchored to 0G Storage |
| Audit Archive | Filecoin Calibration | Long-term immutable governance records, CID anchoring |

### Deployed Contracts (X Layer Testnet)

| Contract | Address |
|----------|---------|
| GovernanceContract | `0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6` |
| AIGovernanceStorage | `0x1E0317beFf188e314BbC3483e06773EEfa28bB2D` |

### OnchainOS Usage

Cognivern uses **OnchainOS's EVM infrastructure on X Layer** to deploy and interact with two governance smart contracts: `GovernanceContract` (policy enforcement, agent registration, action logging) and `AIGovernanceStorage` (immutable audit trail for AI agent spend decisions). Our TypeScript backend uses ethers.js to call these contracts for on-chain policy evaluation and decision recording, while our React frontend reads contract state for real-time governance metrics. OnchainOS's **Trade** and **Payments** skill categories map directly to our agent spend pipeline — agents can initiate swaps and transfers, but only after passing Cognivern's cryptographic policy enforcement. We leverage X Layer's low-cost execution for high-frequency governance checks across the full lifecycle: policy creation → agent registration → spend request evaluation → on-chain action logging.

### Demo: X Layer Integration

Run the interactive demo script to showcase the full X Layer governance lifecycle:

```bash
# Reads deployed contracts on X Layer testnet and walks through the governance flow
node scripts/demo-xlayer.cjs
```

The demo script:
1. Connects to deployed GovernanceContract and AIGovernanceStorage on X Layer testnet
2. Reads current governance stats (policies, agents, actions)
3. Creates a new governance policy and activates it
4. Registers a new AI agent bound to the policy
5. Logs a governed spend action to AIGovernanceStorage
6. Queries the audit trail to verify the action was recorded on-chain
7. Displays a summary of the full governance lifecycle

---

## 0G APAC Hackathon — Track 3: Agentic Economy & Autonomous Applications

**Cognivern is SpendOS for agent wallets** — a self-custodial agent wallet governance layer with automated spend approval, policy enforcement, and a cryptographically-anchored audit trail stored on 0G decentralized storage.

### Why Track 3

Track 3 explicitly calls out *"Self-custodial agent wallets and AI-governed DAO infrastructure"* and *"Micropayments, automated billing, and revenue-sharing"*. Cognivern is a textbook implementation: agents request spends, Cognivern enforces policies, signs approved transactions, and anchors every decision to 0G Storage for tamper-proof auditability.

### 0G Integration

| Component | 0G Service | Detail |
|-----------|-----------|--------|
| Audit log anchoring | 0G Storage (Newton Testnet) | Every governance decision (allow/deny) is uploaded to 0G Storage via `ZeroGStorageService` |
| Indexer endpoint | `indexer-storage-testnet-standard.0g.ai` | Used for file upload and root hash retrieval |
| Root hash | Returned per record | Permanent, verifiable identifier for each audit event |

### Submission Package (0G APAC)
- **Project Name:** Cognivern
- **Track:** Track 3 — Agentic Economy & Autonomous Applications
- **Primary Angle:** Self-custodial agent wallet governance with 0G-anchored audit trail
- **0G Usage:** `ZeroGStorageService` anchors every governance decision to 0G Storage in real-time
- **Live Frontend:** https://cognivern.vercel.app
- **GitHub:** https://github.com/thisyearnofear/cognivern
- **Deadline:** May 16, 2026, 23:59 UTC+8

---

## OWS Hackathon — Track 02: Agent Spend Governance & Identity

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

### X Layer Arena
- **Project Name:** Cognivern
- **Track:** X Layer Arena
- **Primary Angle:** Complete onchain agent spend governance application
- **Multi-chain:** X Layer (execution) + 0G (live audit) + Filecoin (audit archive)
- **Deployed:** GovernanceContract + AIGovernanceStorage on X Layer testnet

### OWS Hackathon
- **Project Name:** Cognivern
- **Track:** Track 02: Agent Spend Governance & Identity
- **Primary Angle:** SpendOS for teams
- **Secondary Angle:** Audit log forensics

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
