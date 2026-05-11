# Hackathon Submissions

## Fhenix Privacy-by-Design dApp Buildathon

**Cognivern is the privacy-by-design SpendOS for autonomous agent wallets** — an existing multi-chain spend control plane that adds **Fhenix (CoFHE)** as a confidential policy layer so institutions can run autonomous agents without leaking budgets, counterparties, or strategy.

### The Institutional Gap We Close

Compliance teams reject autonomous agent deployments on transparent rails because per-agent budgets, vendor allowlists, and remaining spend headroom are visible competitive intelligence. Cognivern moves these into encrypted state on Fhenix while keeping execution and audit anchoring on existing public chains.

### Layered Architecture

| Layer | Chain | Role |
|-------|-------|------|
| Confidential Policy State | Fhenix (Sepolia / Arbitrum Sepolia / Base Sepolia) | Encrypted budgets, encrypted spend counters, sealed approval ciphertexts, FHE policy evaluation |
| Cross-Chain Bridge | **Hyperlane Messaging Protocol** | Permissionless messaging between Fhenix and X Layer with strict origin/sender verification |
| Execution & Public Anchoring | X Layer Testnet (1952) | `GovernanceContract` consumes Fhenix decisions via `handle()`, executes signed spend |
| Live Audit | 0G Newton Testnet | Real-time decision anchoring |
| Audit Archive | Filecoin Calibration | Long-term immutable storage |

### Fhenix Stack Usage

- **Solidity library** — `ConfidentialSpendPolicy.sol` uses `euint128` / `ebool` for budgets, counters, and decisions
- **CoFHE SDK** — `FhenixPolicyService` wraps `@cofhe/sdk` for client-side encryption + permits
- **React hooks** — frontend uses `useEncrypt`, `useWrite`, `useDecrypt` for confidential policy editor and auditor views
- **Hardhat plugin** — `contracts/fhenix/` workspace for local FHE development
- **Privara SDK** — `@reineira-os/sdk` powers the confidential payment-rails half of `/api/spend`
- **Hyperlane Protocol** — Standard `IMailbox` and `IMessageRecipient` implementation for secure cross-chain governance logic
- **Encryption Sidecar** — `/api/fhenix/encrypt` utility for non-TS agents (Python/Go) to perform FHE operations without native SDKs

### What's Privacy-Preserving

| Today (plaintext) | With Fhenix (encrypted) |
|-------------------|--------------------------|
| Per-agent daily budget | `euint128 dailyLimit` on Fhenix |
| Spend counter | `euint128 spentToday` on Fhenix |
| Approval threshold | `euint128 approvalThreshold` |
| Spend amount in `/api/spend` | Client-encrypted via `useEncrypt` |
| Audit row amounts | Sealed; revealed only via auditor permits |

The decision (approve / hold / deny) is publicly verifiable. The inputs and thresholds stay encrypted.

### Wave Plan

| Wave | Deliverable |
|------|-------------|
| Wave 1 | [x] Integration plan + `ConfidentialSpendPolicy.sol` skeleton + Hardhat scaffold |
| Wave 2 | [x] `FhenixPolicyService` end-to-end on Fhenix testnet; `/api/spend/encrypted` |
| Wave 3 | [x] Frontend `useEncrypt` flow; auditor permits; X Layer cross-chain attestation |
| Wave 4 | [ ] Privara SDK confidential payroll; sealed-bid vendor selection *(starts May 11)* |
| Wave 5 | [ ] Production demo: institutional treasury agent with fully encrypted budgets, MEV-protected execution, selective auditor disclosure *(starts May 23)* |

### Submission Package (Fhenix Buildathon)

- **Project Name:** Cognivern
- **Primary Angle:** Privacy-by-design SpendOS for autonomous agent wallets
- **Application Areas:** Confidential DeFi, Private Payments, RWA & Compliance
- **Existing Foundation:** Live spend control plane on X Layer + Filecoin + 0G
- **New Layer:** Fhenix `ConfidentialSpendPolicy` + Privara payment rails
- **Full Plan:** [Fhenix Integration](./FHENIX_INTEGRATION.md)
- **GitHub:** https://github.com/thisyearnofear/cognivern

### Why This Wins

- **Real protocol, not a weekend project.** Existing OWS wallet layer, policy engine, audit ledger, multi-chain deployment.
- **Direct hit on the institutional gap.** Encrypted policy state removes the compliance blocker for agent deployments.
- **MEV protection by construction.** Sealed approval ciphertexts hide agent intent until execution.
- **Selective disclosure for audits.** Permits give auditors exactly what they need.
- **Composable with Privara.** Cognivern decides → Privara executes the confidential transfer.

---

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

**Do not optimize for:** generic multi-chain governance, old trading competition positioning, prediction-market demos.

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

---

## Agents Assemble Healthcare AI Endgame (2026)

**Cognivern is the governance control plane for autonomous healthcare AI agents** — a
policy-checked, HIPAA-aware, audit-ready SpendOS that makes multi-agent clinical workflows
safe to deploy in production.

### The Healthcare Governance Gap

Hospitals and payers are blocked from deploying autonomous AI agents because:

1. **No policy enforcement** — agents can access PHI, order tests, or authorise spend without
   clinical or compliance review.
2. **No audit trail** — decisions are opaque; regulators cannot reconstruct what happened.
3. **No interoperability** — agents from different vendors cannot share clinical context safely.

Cognivern closes all three gaps with a single, composable governance layer.

### Architecture: FHIR Context Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Multi-Agent Call Chain (A2A)                    │
│                                                                     │
│  Agent A ──► Agent B ──► Agent C ──► ... ──► Cognivern Governance  │
│     │           │           │                        │              │
│  FHIR ctx    FHIR ctx    FHIR ctx           SharpContext envelope   │
│  (Patient)  (Encounter)  (Obs/Rx)           propagated end-to-end  │
└─────────────────────────────────────────────────────────────────────┘
                                                        │
                              ┌─────────────────────────▼──────────────────────────┐
                              │          Cognivern Governance Pipeline              │
                              │                                                     │
                              │  1. Ingest run (CRE)                               │
                              │       ↓                                             │
                              │  2. FHIR/SHARP context adapter                     │
                              │     • Validates resource refs (Patient, Encounter) │
                              │     • Checks sensitivity labels (HIV, MH, SUD)     │
                              │     • Attaches a2aTraceId for call-chain audit      │
                              │       ↓                                             │
                              │  3. Together AI policy evaluator                   │
                              │     • Model: Llama-3.3-70B-Instruct-Turbo          │
                              │     • System prompt: HIPAA + FHIR R4 rules         │
                              │     • Returns: allowed, reasoning, policyChecks    │
                              │       ↓                                             │
                              │  4. Immutable audit log (0G Newton + Filecoin)     │
                              │       ↓                                             │
                              │  5. A2A result emitted via MCP tool endpoint       │
                              └─────────────────────────────────────────────────────┘
```

### Integration Stack

| Sponsor | Integration | File |
|---------|-------------|------|
| **Together AI** | Primary LLM for policy evaluation (Llama-3.3-70B-Instruct-Turbo) | `src/services/TogetherAIPolicyEvaluator.ts` |
| **Kestra** | Orchestrates the full governance loop (ingest → evaluate → audit → A2A) | `deploy/kestra/governance-flow.yml` |
| **CodeRabbit** | Automated policy + smart-contract review on every PR | `.coderabbit.yaml` |
| **MCP / Prompt Opinion** | `POST /api/mcp/governance-check` tool endpoint | `src/modules/api/controllers/McpGovernanceController.ts` |
| **FHIR R4 / SHARP** | Clinical context propagation through multi-agent call chains | `src/types/Policy.ts` |

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mcp/governance-check` | MCP tool manifest (Prompt Opinion Marketplace) |
| `POST` | `/api/mcp/governance-check` | Evaluate governance action with FHIR context |
| `POST` | `/api/governance/evaluate` | Core governance evaluation (Together AI backed) |
| `GET` | `/api/audit/logs` | Immutable audit trail |

### Example: MCP Governance-Check Request

```json
POST /api/mcp/governance-check
{
  "agentId": "clinical-agent-001",
  "action": {
    "type": "medication_order",
    "description": "Order metformin 500mg for patient P-12345",
    "amount": 45.00,
    "currency": "USD"
  },
  "fhirContext": {
    "subject": { "resourceType": "Patient", "id": "P-12345", "display": "Jane Doe" },
    "encounter": { "resourceType": "Encounter", "id": "E-98765" },
    "requester": { "resourceType": "Practitioner", "id": "DR-001" },
    "sensitivityLabels": [],
    "eventTime": "2026-05-11T10:21:00Z"
  },
  "a2aTraceId": "trace-abc-123"
}
```

```json
{
  "success": true,
  "data": {
    "tool": "governance-check",
    "callId": "uuid-...",
    "allowed": true,
    "reasoning": "Action complies with formulary policy; spend within daily limit; no sensitivity flags.",
    "policyChecks": [...],
    "auditLogId": "audit-uuid-...",
    "provider": "together-ai",
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "a2aTraceId": "trace-abc-123",
    "timestamp": "2026-05-11T10:21:00Z"
  }
}
```

### Environment Variables

```bash
TOGETHER_API_KEY=your_together_ai_key        # Together AI inference
TOGETHER_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo  # optional override
COGNIVERN_BASE_URL=https://your-deployment   # for Kestra workflow
COGNIVERN_API_KEY=your_api_key               # for Kestra workflow
```

### Quick Start — Test the Integrations in 60 Seconds

**Prerequisites:** Cognivern running locally (`pnpm dev`) with `TOGETHER_API_KEY` set in `.env`.

#### 1. Discover the MCP tool manifest
```bash
curl http://localhost:3000/api/mcp/governance-check
```

#### 2. Run a governance check via Together AI (no FHIR context)
```bash
curl -X POST http://localhost:3000/api/mcp/governance-check \
  -H "Content-Type: application/json" \
  -H "x-api-key: $COGNIVERN_API_KEY" \
  -d '{
    "agentId": "agent-001",
    "action": {
      "type": "spend",
      "description": "Purchase lab reagents",
      "amount": 450,
      "currency": "USD"
    }
  }'
```

#### 3. Run a governance check with FHIR/SHARP clinical context
```bash
curl -X POST http://localhost:3000/api/mcp/governance-check \
  -H "Content-Type: application/json" \
  -H "x-api-key: $COGNIVERN_API_KEY" \
  -d '{
    "agentId": "agent-001",
    "action": {
      "type": "spend",
      "description": "Administer insulin — formulary check",
      "amount": 120,
      "currency": "USD"
    },
    "fhirContext": {
      "subject":   { "resourceType": "Patient",      "id": "P-12345", "display": "Jane Doe" },
      "encounter": { "resourceType": "Encounter",    "id": "E-98765" },
      "requester": { "resourceType": "Practitioner", "id": "DR-001"  },
      "sensitivityLabels": [],
      "eventTime": "2026-05-11T10:00:00Z"
    },
    "a2aTraceId": "trace-demo-001"
  }'
```

#### 4. Ingest a run directly into the Core Run Engine
```bash
curl -X POST http://localhost:3000/ingest/runs \
  -H "Content-Type: application/json" \
  -H "x-api-key: $COGNIVERN_API_KEY" \
  -d '{
    "agentId": "agent-001",
    "action": { "type": "data_access", "description": "Read patient record", "amount": 0, "currency": "USD" }
  }'
```

#### 5. Fetch the audit trail
```bash
curl http://localhost:3000/api/audit/logs \
  -H "x-api-key: $COGNIVERN_API_KEY"
```

#### 6. Trigger the full Kestra governance loop (requires Kestra running)
```bash
curl -X POST http://localhost:8080/api/v1/executions/cognivern.healthcare/cognivern-governance-loop \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-001",
    "actionPayload": { "type": "spend", "description": "MRI scan authorisation", "amount": 800, "currency": "USD" },
    "policyId": "standard",
    "a2aTraceId": "kestra-demo-001"
  }'
```

Expected response shape for steps 2 & 3:
```json
{
  "success": true,
  "data": {
    "tool": "governance-check",
    "allowed": true,
    "reasoning": "Action complies with policy; spend within daily limit.",
    "provider": "together-ai",
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "auditLogId": "<uuid>",
    "a2aTraceId": "trace-demo-001",
    "timestamp": "<iso8601>"
  }
}
```

---

### Submission Package (Agents Assemble Healthcare AI Endgame)

- **Project Name:** Cognivern
- **Hackathon:** Agents Assemble Healthcare AI Endgame (agents-assemble.devpost.com)
- **Track:** Healthcare Governance / Interoperable AI Agents
- **Primary Angle:** Policy-checked, HIPAA-aware governance control plane for autonomous
  healthcare AI agents using MCP, A2A, and FHIR R4 standards
- **Sponsor Integrations:** Together AI · Kestra · CodeRabbit · Prompt Opinion (MCP)
- **Standards:** FHIR R4, SHARP extension spec, MCP tool schema, A2A call-chain tracing
- **Existing Foundation:** Live multi-chain spend governance (X Layer + 0G + Filecoin + Fhenix)
- **New Layer:** FHIR/SHARP context adapter + Together AI evaluator + Kestra orchestration +
  MCP marketplace endpoint

---

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
- [Fhenix Integration](./FHENIX_INTEGRATION.md) — Confidential policy state on Fhenix
