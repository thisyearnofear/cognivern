# Developer Guide

## Purpose

This repo is being narrowed around a single hackathon story:

**Cognivern is a SpendOS and audit layer for OWS-powered agents.**

The codebase already supports:

- run ingestion for external agents
- local policy evaluation
- audit-log and run-ledger persistence
- project-scoped access and usage tracking

The main wallet gap is that OWS wallet integration is not yet wired in. Some legacy signer flows still rely on env vars and should be treated as temporary compatibility paths.

## Local Setup

### Requirements

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

## Primary APIs

### Data plane

#### `POST /ingest/runs`

Accepts runs from external agents and stores them in the CRE ledger.

Headers:

- `Authorization: Bearer <ingestKey>`
- `X-PROJECT-ID: <projectId>`
- `Content-Type: application/json`

Request shape:

```ts
{
  runId: string;
  projectId?: string;
  workflow: string;
  mode: "local" | "cre";
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  steps: CreStep[];
  artifacts: CreArtifact[];
}
```

Example:

```bash
curl -X POST http://localhost:3000/ingest/runs \
  -H 'Authorization: Bearer dev-ingest-key' \
  -H 'X-PROJECT-ID: default' \
  -H 'Content-Type: application/json' \
  -d '{"runId":"123","projectId":"default","workflow":"governance","mode":"local","startedAt":"2026-01-01T00:00:00.000Z","finishedAt":"2026-01-01T00:00:01.000Z","ok":true,"steps":[],"artifacts":[]}'
```

Related endpoints:

- `GET /api/projects`
- `GET /api/projects/:projectId/usage`
- `GET /api/projects/:projectId/tokens`

### Governance control plane

#### `POST /api/governance/evaluate`

Evaluates an action against the active local policy set and returns structured policy checks.

Request shape:

```ts
{
  agentId: string;
  policyId?: string;
  action: {
    id?: string;
    type: string;
    description?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
}
```

Response shape:

```ts
{
  success: true;
  data: {
    approved: boolean;
    reason: string;
    agentId: string;
    actionType: string;
    policyId: string;
    policyChecks: Array<{
      policyId: string;
      result: boolean;
      reason: string;
    }>;
    timestamp: string;
  };
}
```

Related endpoints:

- `GET /api/governance/policies`
- `POST /api/governance/policies`
- `GET /api/governance/health`

### Audit and run-ledger APIs

- `GET /api/audit/logs`
- `GET /api/audit/insights`
- `POST /api/audit/insights/:id/resolve`
- `GET /api/cre/runs`
- `GET /api/cre/runs/:runId`
- `GET /api/cre/runs/:runId/events`
- `GET /api/cre/runs/:runId/events/stream`
- `POST /api/cre/runs/:runId/retry`
- `POST /api/cre/runs/:runId/approval`
- `POST /api/cre/runs/:runId/plan`

## Current Core Services

### `PolicyService`

Loads and stores local policies. On startup it loads the bundled trading competition policy from `src/policies/trading-competition-policy.json`.

### `PolicyEnforcementService`

Evaluates an `AgentAction` against policy rules and returns allow or deny decisions plus per-rule checks. This is the local decision engine behind `/api/governance/evaluate`.

### `AuditLogService`

Maps governance actions and other system events into CRE-backed evidence records so the UI can render them as audit logs.

### `IngestController`

Validates and stores BYO-agent runs, enforces project ingest keys, and exposes quota and token telemetry for operator views.

### `CreController`

Exposes the run ledger, event streams, retries, approvals, and plan updates.

## Hackathon-Focused Product Direction

The best near-term product is not a wallet itself.

It is the operator layer around an OWS wallet:

- issue scoped agent access
- evaluate intended spend before signing
- hold or deny risky actions
- track approvals and denials in one ledger
- visualize per-agent and per-project wallet activity

That means the next meaningful integration surface should look like:

1. OWS wallet and API-key issuance
2. Cognivern governance evaluation before signing
3. Cognivern audit-log capture after every attempted or completed operation
4. dashboard and forensics UI for operators

## Migration Notes

### Legacy pieces to phase out

- Bitte wallet integration
- docs that frame env private keys as the preferred wallet model
- old trading-first project narrative

### Accurate current limitations

- OWS wallet storage and OWS API-key issuance are not yet implemented in this repo
- some attestation flows still use signer keys from environment variables
- several frontend surfaces still reference older agent ecosystems and integrations

## Suggested Demo Path

For the hackathon, optimize the story around:

1. a treasury wallet
2. multiple agents with different budgets
3. policy-enforced evaluation of proposed spend
4. a blocked, held, and approved example
5. audit-log and run-ledger evidence shown in the Cognivern UI
