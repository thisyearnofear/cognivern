# OWS Hackathon 2026 Plan

## Event Facts

- **Hackathon**: OWS Hackathon
- **Date**: Friday, April 3, 2026
- **Submission window**: opens Friday morning and closes at **Saturday, April 4 at 9:00 AM EDT**
- **Prize pool**: **$50,000**
- **Prize structure**:
  - Grand Prize: **$10,000**
  - 1st per track: **$3,000 x 5**
  - 2nd per track: **$1,000 x 5**
  - Bonus credits: **$20,000**
- **Optional in-person hubs**:
  - San Francisco: `153 Kearny St, Floor 5`
  - New York City: `520 Broadway, Floor 8`
  - Miami: `The LAB Miami`

## Our Best Shot

We should optimize for **Track 02: Agent Spend Governance & Identity**.

This is the strongest fit between the hackathon prompt and the code that already exists in this repo.

The best submission angle is:

> **Cognivern is SpendOS for OWS wallets. It gives operators a control plane for agent budgets, restrictions, approvals, and audit logs.**

That puts us closest to these track ideas:

- `SpendOS for teams`
- `Audit log forensics`
- `Dead man's switch`
- `Multi-sig agent governance`
- `Agent identity via Web Bot Auth`

## Winning Thesis

OWS gives agents wallets, API keys, and policy-gated signing.

Cognivern turns those primitives into something a team can actually operate:

- create agent-specific controls
- evaluate spend before signing
- block or hold risky actions
- capture every attempted action in an operator ledger
- explain what happened in human-readable terms

The judges should come away with one sentence:

> **This is the missing trust and control layer for teams giving real money to autonomous agents.**

## What We Must Show In The Demo

The live demo should prove all of the following:

1. A treasury wallet exists.
2. Multiple agents have different scopes and budgets.
3. A low-risk spend is auto-approved.
4. A high-risk spend is held for review or denied.
5. The operator can inspect the reason, policy checks, and audit trail immediately.
6. The UI looks like a real operator product, not a hacky internal dashboard.

## Scope Discipline

We are **not** trying to win by building the broadest project.

We are trying to win by building the most credible, crisp, high-signal product for one track.

### Do not optimize for

- generic multi-chain governance messaging
- old trading competition positioning
- Bitte integrations
- Vincent branding
- prediction-market or forecasting demos
- every partner integration at once

### Optimize for

- OWS-native wallet control
- budget and restriction policies
- approve or hold or deny flows
- operator visibility
- audit and forensics
- polished demo narrative

## Parallel Execution Plan

To move twice as fast, split the work into **two parallel parts** with minimal overlap.

## Part A: OWS Wallet And Execution Boundary

### Goal

Make the money path real.

This stream owns the path from:

`agent intends to spend` -> `policy-aware decision` -> `wallet signs or does not sign`

### Why this is Part A

Without this, we have a nice dashboard story but not a convincing OWS submission.

### Owns

- wallet adapter and OWS integration surface
- agent credential or API-key issuance model
- spend-intent request format
- execution decision states: approve, hold, deny
- wallet-side policy enforcement hooks
- audit event emission from the actual execution path
- removal or isolation of stale Bitte-specific wallet assumptions

### Likely code areas

- `src/services/*wallet*`
- `src/services/PolicyEnforcementService.ts`
- `src/services/AuditLogService.ts`
- `src/modules/api/controllers/GovernanceController.ts`
- `src/modules/api/controllers/IngestController.ts`
- `src/modules/api/controllers/CreController.ts`
- `src/modules/api/ApiModule.ts`
- `src/config.ts`

### Deliverables

1. A concrete OWS-facing wallet boundary.
2. An action or spend request schema the UI can submit.
3. A local decision model with `approved`, `held`, and `denied` outcomes.
4. At least one end-to-end operation that reaches the wallet boundary.
5. Audit records generated from real decision points, not fake UI-only state.
6. A dead-simple fallback path if full OWS signing is not ready.

### Definition of done

Part A is done when:

- one agent can propose a spend action
- the system can evaluate it against policy
- the result can block, hold, or allow execution
- the outcome is recorded in the audit and run ledger

## Part B: Operator UX, Narrative, And Submission Package

### Goal

Make the product feel like a winner.

This stream owns the operator experience, demo clarity, and submission readiness.

### Why this is Part B

Even if Part A works, we still lose if the project feels like an old trading dashboard with stale branding and unclear positioning.

### Owns

- renaming the frontend around SpendOS and OWS
- operator dashboard polish
- audit and run-ledger demo flow
- policy-management UX
- stale trading, Vincent, and Bitte cleanup in user-facing surfaces
- sample scenarios and seeded demo data
- screenshots, writeup, architecture diagrams, and submission copy

### Likely code and doc areas

- `src/frontend/src/components/cre/*`
- `src/frontend/src/components/audit/*`
- `src/frontend/src/components/policies/*`
- `src/frontend/src/components/layout/*`
- `src/frontend/src/components/integration/*`
- `src/frontend/src/components/trading/*`
- `src/frontend/src/components/agents/*`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPER.md`
- `docs/HACKATHON.md`

### Deliverables

1. A primary dashboard focused on budgets, policy decisions, approvals, and audit.
2. Run-ledger copy and actions that describe spend evaluation, not forecasts.
3. Audit views that highlight denials, approvals, reason strings, and anomalies.
4. A clean operator story for multiple agents under one treasury.
5. Removal of stale product language that weakens the hackathon narrative.
6. A submission package with a sharp one-line pitch, architecture image, and demo script.

### Definition of done

Part B is done when:

- a first-time judge can understand the product in under 30 seconds
- the UI reads as an agent-wallet operator product
- the demo sequence feels intentional and polished
- nothing user-facing suggests a discontinued or off-theme integration

## Contract Between Part A And Part B

To avoid blocking each other, both parts should align on one shared interface:

### Required decision payload

```ts
type SpendDecision = {
  approved: boolean;
  state: "approved" | "held" | "denied";
  agentId: string;
  policyId: string;
  actionType: string;
  reason: string;
  policyChecks: Array<{
    policyId: string;
    result: boolean;
    reason: string;
  }>;
  timestamp: string;
  runId?: string;
};
```

If Part A can emit this shape consistently, Part B can move independently on the operator UI.

## Fastest Path To A Strong Submission

### Must-have

- one real OWS-aligned wallet path
- one clean operator dashboard
- approve or hold or deny behavior
- audit logs with reasons
- multi-agent budget story

### Strong stretch goals

- dead man's switch
- dual approval or multi-sig threshold flow
- RFC 9421 or Web Bot Auth style request identity
- anomaly detection on spend patterns

### Nice-to-have only if everything else is done

- cross-chain complexity
- extra partner integrations
- voice features
- generalized agent marketplace features

## Proposed Demo Script

1. Show the treasury and two agents.
2. Show each agent's budget and restrictions.
3. Trigger a safe spend request from Agent A.
4. Show it auto-approve.
5. Trigger a risky spend request from Agent B.
6. Show it hold or deny with a clear reason.
7. Open the run ledger.
8. Open the audit log.
9. Show that the operator can explain exactly what happened.

## Judge-Facing Messaging

The pitch should stay simple:

- OWS solves wallet primitives.
- Cognivern solves team control and trust.
- Agents get wallets, not blank checks.

## Final Success Bar

By the time we submit, the repo and demo should make this obvious:

- the wallet layer is OWS-oriented
- the control layer is Cognivern
- the product is built for real teams managing real agent spend
- the story is tighter than the average hackathon entry
