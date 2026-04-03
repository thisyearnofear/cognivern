# Cognivern

**SpendOS for agent wallets.**

Cognivern is an agent spend governance and audit layer being retargeted for the **OWS Hackathon**.

The strongest fit is **Track 02: Agent Spend Governance & Identity**, especially:

- `SpendOS for teams`
- `Audit log forensics`
- `Dead man's switch`
- `Multi-sig agent governance`
- `Agent identity via Web Bot Auth`

## Hackathon Thesis

OWS gives agents wallets, API keys, and policy-gated signing.

Cognivern adds the missing operator layer around that wallet:

- evaluate agent actions before money moves
- issue scoped access for projects and agents
- capture append-only run and spend evidence
- visualize policy denials, approvals, and anomalies
- provide a control plane for human oversight

The current repo already has meaningful pieces of that system:

- project-scoped run ingestion at `/ingest/runs`
- a local governance evaluation API at `/api/governance/evaluate`
- bundled policy loading and local policy execution
- CRE-backed run ledger and audit-log views
- dashboards for monitoring agent activity and compliance state

## Current Positioning

This repo is no longer being positioned as a generic multi-chain trading or Bitte integration project.

The new target is:

> **Cognivern is the control plane for OWS wallets: budgets, policy checks, approvals, and audit for autonomous agents.**

## What Exists Today

These capabilities are already present in code:

- **Policy evaluation**: `PolicyService` and `PolicyEnforcementService` load rules, evaluate actions, and return structured policy checks.
- **Governance API**: `GovernanceController` exposes `/api/governance/evaluate` and `/api/governance/policies`.
- **Audit trail**: `AuditLogService` converts policy decisions and runs into CRE-backed evidence records.
- **Run ingestion**: `IngestController` accepts project-scoped agent run payloads and records quota usage.
- **Run ledger**: `CreController` exposes run details, retries, approvals, and event streams.
- **Operator UI**: the frontend already includes audit, policy, run-ledger, and agent-monitoring surfaces.

## What Is Being Replaced

Two parts of the repo are now considered legacy:

- **Bitte integration**: Bitte is discontinued and should not be part of the product story going forward.
- **Environment-variable private keys as the wallet model**: some services still use signer keys from env vars for legacy forecasting and attestation flows. That is a temporary implementation detail, not the intended architecture.

## OWS Migration Direction

The intended wallet architecture for the hackathon is:

1. **OWS wallet storage** replaces ad hoc env-key wallet handling.
2. **OWS API keys** become the scoped credentials issued to agents.
3. **OWS policy-gated signing** becomes the execution boundary for spend decisions.
4. **Cognivern** becomes the monitoring, approval, and forensics plane around that wallet activity.

In practical terms, Cognivern should demo:

- per-agent budgets
- vendor or destination allowlists
- chain restrictions
- high-value approval holds
- policy denials with human-readable reasons
- audit-log and run-ledger views for every attempted spend

## Demo Story For The Hackathon

Recommended demo narrative:

1. Create an OWS wallet for a team treasury.
2. Issue separate scoped credentials to multiple agents.
3. Have an agent attempt a paid action.
4. Evaluate the action against Cognivern policy.
5. Auto-approve low-risk spend and block or hold risky spend.
6. Show the resulting run, audit evidence, and operator dashboard in Cognivern.

This aligns directly with the hackathon's `SpendOS for teams` and `Audit log forensics` opportunities.

## Quick Start

### Prerequisites

- Node.js v20.14+
- pnpm

### Install

```bash
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern
pnpm install
pnpm build
pnpm start
```

### Minimal local environment

Create `.env` with the values required by the current codebase.

Important:

- some signer-based settings still exist because the OWS migration is not complete
- those legacy signer env vars should be treated as temporary compatibility settings, not the final wallet model

Example:

```env
API_KEY=development-api-key
OPENAI_API_KEY=dummy-for-local-dev

# Legacy compatibility until OWS wallet integration lands
FILECOIN_PRIVATE_KEY=0xyour_private_key_here
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
GOVERNANCE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STORAGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
USDFC_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000

RECALL_API_KEY=dummy
```

### Run the backend

```bash
pnpm start
```

### Ingest a run from any agent

```bash
export COGNIVERN_PROJECTS="default:Default Project"
export COGNIVERN_INGEST_KEYS="default=dev-ingest-key"

curl -X POST http://localhost:3000/ingest/runs \
  -H 'Authorization: Bearer dev-ingest-key' \
  -H 'X-PROJECT-ID: default' \
  -H 'Content-Type: application/json' \
  -d '{"runId":"123","projectId":"default","workflow":"governance","mode":"local","startedAt":"2026-01-01T00:00:00.000Z","finishedAt":"2026-01-01T00:00:01.000Z","ok":true,"steps":[],"artifacts":[]}'
```

## Key Endpoints

- `POST /ingest/runs`
- `GET /api/cre/runs`
- `GET /api/cre/runs/:runId`
- `GET /api/governance/policies`
- `POST /api/governance/policies`
- `POST /api/governance/evaluate`
- `GET /api/audit/logs`
- `GET /api/audit/insights`
- `GET /api/projects`
- `GET /api/projects/:projectId/usage`

## Documentation

- [Hackathon Brief](./docs/HACKATHON.md)
- [Live Demo](./docs/DEMO.md)
- [Submission Draft](./docs/SUBMISSION.md)
- [Developer Guide](./docs/DEVELOPER.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [CRE Notes](./docs/CRE.md)

## Status

This repository is being aggressively retargeted for the OWS Hackathon.

The policy, audit, ingestion, and control-plane pieces are real today.
The wallet layer is the main migration in flight.

## License

MIT
