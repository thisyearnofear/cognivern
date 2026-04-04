# Architecture

## Mission

**Make agent wallet activity governable.**

Cognivern is a control plane for OWS wallets that handles policy checks, approvals, and audit for autonomous agents.

## Responsibility Boundary

| OWS Owns | Cognivern Owns |
|----------|----------------|
| Wallet storage | Policy evaluation |
| API-key issuance | Approval workflows |
| Transaction signing | Audit-log indexing |
| Signing policy enforcement | Run ledger & analytics |

## System Overview

```
Agent
  |
  | intended spend / sign request
  v
OWS Wallet + API Key
  |
  | policy-gated signing boundary
  v
Cognivern Evaluation Layer
  - budget checks, chain restrictions, vendor allowlists
  - approval thresholds, anomaly detection
  |
  +--> approve -> OWS signs and sends
  +--> hold    -> human or second wallet approves
  +--> deny    -> no signing
  |
  v
Cognivern Audit + Run Ledger
  - every attempt recorded, reasons preserved
  - project and agent views
```

## Existing Building Blocks

### 1. Ingestion — `POST /ingest/runs`

Project-scoped run submission with ingest key validation, quota metering, and normalized run capture for downstream UI.

### 2. Governance Evaluation

`GovernanceController` exposes policy CRUD and evaluation:
- `GET/POST /api/governance/policies`
- `POST /api/governance/evaluate`

`PolicyEnforcementService` loads the active policy and evaluates actions rule by rule, returning structured allow/deny decisions with per-rule checks.

### 3. Audit & Run Ledger

`AuditLogService` converts actions and events into CRE-backed evidence records.

`CreController` exposes run lists, details, event streams, retries, approvals, and plan updates — the right primitives for spend forensics and operator review.

### 4. OWS Wallet Layer

`OwsLocalVaultService` stores encrypted local wallets, issues delegated API keys, and resolves wallet access for spend execution.

`OwsWalletService` exposes `/api/spend`, enforces spend policies, produces approve/hold/deny outcomes, signs approved spend envelopes, and persists runs to the CRE ledger.

### 5. Frontend Control Plane

The frontend already contains surfaces for policy management, audit logs, run ledger, and agent monitoring.

## Data Flow

```
External Agents / Services
        |
        |  POST /ingest/runs
        v
  IngestController
        |
        v
    CRE Run Store  <-------------------------------+
        |                                          |
        v                                          |
 AuditLogService  <---- GovernanceController ------+
        |                   |
        |                   | evaluate action
        |                   v
        |           PolicyEnforcementService
        |                   |
        |                   v
        |              PolicyService
        |
        v
  UI / Operator Views
```

## Legacy Components

These parts of the repo are considered transitional and should not be part of the product narrative:

- **Bitte integration** — discontinued, should not be part of the hackathon story
- **Env-var private keys** — some services still use signer keys from env vars as a temporary implementation detail; the intended architecture uses OWS wallet storage

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest/runs` | POST | Project-scoped run ingestion |
| `/api/governance/policies` | GET, POST | Policy management |
| `/api/governance/evaluate` | POST | Evaluate action against policy |
| `/api/ows/bootstrap` | POST | Bootstrap OWS wallet |
| `/api/ows/api-keys` | GET, POST | API key management |
| `/api/ows/wallets` | GET | List wallets |
| `/api/spend` | POST | Execute governed spend |
| `/api/spend/preview` | POST | Simulate spend (dry-run) |
| `/api/spend/status` | GET | Execution layer status |
| `/api/audit/logs` | GET | Audit trail |
| `/api/audit/insights` | GET | Audit insights |
| `/api/cre/runs` | GET | Run ledger |
| `/api/cre/runs/:runId` | GET | Run details |
| `/api/projects` | GET | Project list |
| `/api/projects/:projectId/usage` | GET | Project usage |

## Related Docs

- [Hackathon Brief](./HACKATHON.md) — Demo story and submission
- [Developer Guide](./DEVELOPER.md) — APIs, local setup, testing
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
