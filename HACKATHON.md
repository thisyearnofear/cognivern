# OWS Hackathon - April 3, 2026
## Track 02: Agent Spend Governance & Identity
## Project: SpendOS for OWS Wallets

SpendOS is a governance-first execution layer for AI agents using OWS wallets. It transforms raw agentic spend into a verifiable, policy-enforced stream of intent.

### Parallel Execution Plan

#### Part A: OWS Wallet Execution Layer (Current Focus)
**Goal: Own the real money path.**
- **OWS Wallet Integration**: Establish secure connection and scoped access for agentic signing.
- **Spend-Intent Payloads**: Define a standard schema for agents to declare *why* they are spending before they sign.
- **Pre-sign Policy Checks**: Intercept execution requests to validate against governance policies.
- **Outcomes**: Robust implementation of Approve, Hold (pending manual review), and Deny states.

#### Part B: Operator UX, Forensics, and Demo Packaging (User Working)
- **Product Surface**: Dashboard copy, audit/run-ledger polish.
- **Cleanup**: Remove stale Bitte/Vincent references.
- **Review UX**: Implementation of the "Held-Action" review interface for human-in-the-loop governance.
- **Judging Package**: Final docs and demo recording.

---

### Implementation Status: Part A

- [ ] OWS Provider Abstraction
- [ ] Scoped Permission Management
- [ ] Intent-to-Signature Flow
- [ ] Policy Interceptor Logic
