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

- live governance evaluation via `/api/governance/evaluate`
- live policy creation via `/api/governance/policies`
- live BYO-agent ingestion via `/ingest/runs`
- live audit views via `/api/audit/logs`
- live run-ledger views via `/api/cre/runs`

## Demo

Our live demo shows:

1. a custom spend policy created in real time
2. one allowed spend request
3. one denied spend request
4. one paused-for-approval run
5. one completed run

## Why This Matters

OWS makes agent wallets possible.

Cognivern makes them operable for teams.

That means:

- safer delegation
- better oversight
- faster incident response
- clearer trust boundaries for autonomous systems

## Current Limitation

The OWS-native wallet execution path is still being wired in.

Today, the strongest live proof is the control plane:

- policy decisions
- run ledger
- audit evidence

The final wallet-layer integration is the remaining Part A workstream.
