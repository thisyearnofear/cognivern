# Submission Draft

## Project Name

**Cognivern**

## One-Liner

**SpendOS for OWS wallets: give agents wallets without giving them blank checks.**

## Track

**Track 02: Agent Spend Governance & Identity**

Primary angle:

- `SpendOS for teams`

Secondary angle:

- `Audit log forensics`

## Problem

OWS gives agents a standardized wallet, API keys, and policy-gated signing.

That is necessary, but not sufficient for real teams. Once agents can spend money, teams still need:

- per-agent budgets
- approval thresholds
- vendor and chain restrictions
- operator visibility
- incident forensics

Without that layer, an agent wallet is operationally risky even if the signing primitive is good.

## Solution

Cognivern is the control plane around OWS wallets.

It evaluates proposed agent actions, records audit evidence, and gives operators a live view of:

- approved actions
- denied actions
- actions paused for approval
- the evidence and policy checks behind each decision

## What Is Live Today

- live OWS wallet bootstrap into encrypted local storage via `/api/ows/bootstrap`
- live delegated OWS API-key issuance via `/api/ows/api-keys`
- live ERC-7715 permissions request flow via `/api/ows/permissions`
- live policy creation via `/api/governance/policies`
- live governed spend execution via `/api/spend`
- live execution-layer status via `/api/spend/status`
- live audit views via `/api/audit/logs`
- live run-ledger views via `/api/cre/runs`

## Demo

Our live demo shows:

1. a custom spend policy created in real time
2. a local OWS wallet bootstrapped into encrypted storage
3. an ERC-7715 permission request (simulating wallet UI authorization)
4. a scoped OWS API key issued to one agent
5. one allowed spend request
6. one held-for-approval spend request
7. one denied spend request
8. the resulting approved and held runs in the ledger

## Why This Matters

OWS makes agent wallets possible.

Cognivern makes them operable for teams.

That means:

- safer delegation
- better oversight
- faster incident response
- clearer trust boundaries for autonomous systems
