# Architecture

## Mission

**Make agent wallet activity governable.**

Cognivern is being retargeted from a broad agent-governance platform into a narrower product for the OWS Hackathon:

> **a control plane for OWS wallets that handles policy checks, approvals, and audit for autonomous agents**

## Best Hackathon Fit

The strongest fit is **Track 02: Agent Spend Governance & Identity**.

The codebase is already closest to these opportunities:

- `SpendOS for teams`
- `Audit log forensics`
- `Dead man's switch`
- `Multi-sig agent governance`

## Architecture Summary

The current system already has two useful planes:

- a **data plane** for ingesting external agent runs
- a **control plane** for governance evaluation, run review, and audit analysis

That maps well to an OWS-based system:

- **OWS** owns wallet storage, API keys, and signing
- **Cognivern** owns policy evaluation, operator controls, and forensics

## Current Runtime Shape

```text
External Agents / Services
        |
        |  POST /ingest/runs
        v
  IngestController
        |
        v
    CRE Run Store  <-------------------------------+
        |                                          |
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
  - audit logs
  - run ledger
  - policy state
  - usage telemetry
```

## Planned OWS-Centric Shape

```text
Agent
  |
  | intended spend / sign request
  v
OWS Wallet + API Key
  |
  | policy-gated signing boundary
  v
Cognivern Evaluation Layer
  - budget checks
  - chain restrictions
  - vendor allowlists
  - approval thresholds
  - anomaly detection
  |
  +--> approve -> OWS signs and sends
  |
  +--> hold    -> human or second wallet approves
  |
  +--> deny    -> no signing
  |
  v
Cognivern Audit + Run Ledger
  - every attempt recorded
  - reasons preserved
  - project and agent views
```

## Existing Building Blocks

### 1. Ingestion

`IngestController` accepts project-scoped run submissions through `/ingest/runs`.

Useful today:

- external agent compatibility
- per-project ingest keys
- quota and usage metering
- normalized run capture for downstream UI

### 2. Governance evaluation

`GovernanceController` exposes:

- `GET /api/governance/policies`
- `POST /api/governance/policies`
- `POST /api/governance/evaluate`

`PolicyEnforcementService` loads the active policy and evaluates actions rule by rule, returning structured policy checks.

### 3. Audit and run ledger

`AuditLogService` turns actions and events into CRE-backed evidence.

`CreController` exposes:

- run lists
- run details
- event streams
- retries
- approval flows
- plan updates

These are the right primitives for spend forensics and operator review.

### 4. Frontend control plane

The frontend already contains surfaces for:

- policy management
- audit logs
- run ledger
- agent status and monitoring

Those views are more valuable for the hackathon than the older trading-specific story.

## Current Mismatches

### Legacy wallet assumptions

Some services still assume signer keys come from environment variables. That is incompatible with the intended OWS-first architecture and should be treated as transitional.

### Discontinued integrations

Bitte-related flows are stale and should not be part of the product narrative.

### Mixed product story

The repo still contains material from trading, forecasting, and deprecated ecosystem integrations. The hackathon story should ignore those unless they directly support the spend-governance demo.

## Recommended Boundaries

### OWS responsibilities

- wallet storage
- API-key issuance
- transaction signing
- signing policy enforcement at the wallet boundary

### Cognivern responsibilities

- project and agent oversight
- policy simulation and explanation
- approval workflows
- audit-log indexing and visualization
- run ledger, anomaly surfacing, and spend analytics

## Near-Term Demo Design

The cleanest demo is:

1. create a treasury wallet
2. issue scoped access to multiple agents
3. submit proposed spend actions into Cognivern
4. approve low-risk actions automatically
5. hold medium-risk actions for approval
6. deny out-of-policy actions
7. show everything in the run ledger and audit views

## Why This Fits The Hackathon

OWS provides the wallet primitives.

Cognivern provides the operator experience teams actually need once agents start spending real money:

- visibility
- control
- limits
- evidence
- recovery workflows

That is a much stronger and more defensible position for this repo than the previous broad "agent governance command center" framing.
