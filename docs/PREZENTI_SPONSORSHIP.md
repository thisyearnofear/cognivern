# Prezenti AI Builder Sponsorship — application tracker

Status: **applying** (seats fill as builders are selected; hard close 2026-12-29).
Program source: https://sponsorships.prezenti.xyz · terms `prezenti-sponsorship-trial-2026-08-18-v4`.

## What it is

Five builders, four months, $1,400 each (Claude Max 20x + ChatGPT Pro 5x + $200
flexible), scored on public GitHub evidence against a published 100-point rubric
(origination 40, cadence 20, acceptance 10, blockchain 10, agent signal 15,
reviews 5). A month-two **Celo mainnet deployment, integration, or material
contribution** is required to keep months 3–4. Commitments: monthly receipts,
monthly public updates, 2% give-back pledge (capped $14k, 36-month expiry) posted
as a **Celo EAS attestation naming the GitHub handle** at acceptance.

## Where we stand (2026-08-22)

- Reproduced our own score with their engine: **34.07/100**, flagged
  `partial_data`. Root cause was **commit attribution**, not output: local git
  used the legacy unprefixed noreply email, so GitHub could not link ~6 months
  of commits to the account (see AGENTS.md — repo email is now the ID-prefixed
  form).
- Filed the fix upstream: **P-U-C/talent-engine PR #3**
  (https://github.com/P-U-C/talent-engine/pull/3) — noreply email fallback in
  the collector + 4 fixture tests + before/after evidence
  (**34.07 → 56.27** on our own profile; origination ~9.6→25.7/40,
  cadence 6.5→16.9/20).
- Residual floor: external merges 0/10 and reviews 0/5 are real gaps — PR #3's
  merge and the LiteLLM 0G pricing entry (next candidate: add `0g/` provider
  entries to LiteLLM's `model_prices_and_context_window.json`) address the
  first; reviewing PRs on active repos addresses the second.
- Residual engine cap: 12-of-27 repo sampling still flags the collection
  partial. Raise as an upstream issue, not silently into PR #3.

## The four-month plan (Celo)

- **M1:** Celo as a rail in `packages/shared/src/rails.ts` + `xlayerMainnet`-style
  hardhat network + deploy script RAILS entry (the chain-agnostic pipeline built
  for 0G/X Layer makes this a small change by design).
- **M2 (checkpoint):** `GovernanceProofV2` live on **Celo mainnet** with
  verifiable anchored proofs (`contracts/deployments/42220.json`).
- **M3–4:** run a sponsored-inference cohort metered on the Celo rail; monthly
  forum updates; public verification links per snapshot.

## The meta-pitch to Prezenti (stewards)

Their operating loop — per-builder budgets, monthly receipts, update compliance,
month-2 checkpoint verification, give-back accounting — is our product's
ledger. Offer to run the flexible allowance (or a future round's tooling budget)
as **metered 0G inference credits through Cognivern**: budgeted keys, real-time
metering, Merkle-anchored snapshots, login-free public verification. Receipts
become anchored, publicly verifiable reports. (Honesty note: their $200/$100
lines are subscription reimbursements, not API metering — pitch the receipts
layer and the flexible slice, not a wholesale replacement.)

## Open items

- [ ] Submit the application (forms/sponsorship-application.json fields: plan
      paragraphs ready — keep in sync with this doc).
- [ ] Track PR #3 to merge; if merged before scoring, it also counts toward
      external-validation.
- [ ] LiteLLM 0G pricing PR (candidate 2).
- [ ] Celo EAS pledge step at acceptance (names `thisyearnofear`).
- [ ] M2 checkpoint artifact: `contracts/deployments/42220.json` + verifier run.
