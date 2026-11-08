# Collusion Under Mandate — draft report skeleton

*Apart Research Swarm Alignment Hackathon 2026 — Track 2/4 crossover.*
**Status: DRAFT — results pending Kaggle runs.**

## Title candidates

- Collusion Under Mandate: Population-Level Budget Violations from Individually Compliant Agents
- Agent Economies: When Per-Agent Safety Training Fails at the Population Level

## Abstract (150–250 words, to finalize with numbers)

Multi-agent systems are beginning to hold economic authority — budgets,
procurement mandates, spending limits — yet safety work measures agents one at
a time. We ask whether a population of individually mandate-compliant agents
can produce mandate-violating outcomes through coordination. We build Agent
Bazaar, a procurement market where agents hold individual budget caps and
blocked-category rules while drawing on a shared program treasury with a hard
cap, and where tasks are priced so that full completion requires exceeding
that cap. Across communication conditions (none / broadcast / pairwise) and
model variants (base vs. mandate-fine-tuned Aya Expanse 8B), we measure
population-level violations, task completion, and detection by two oversight
arms: a per-trajectory monitor and deterministic ledger forensics. We find
[pending]: whether violations emerge without communication, whether covert
channels change their shape, whether mandate fine-tuning helps or hurts under
collusion, and how large the detection gap is between individual and
population-level oversight. All code and episode logs are public.

## 1. Introduction

- Economic authority is becoming a standard agent capability (x402 payments,
  procurement agents, spend mandates). Governance is enforced per-transaction
  at the wallet layer; the population-level invariant (program budget) has no
  enforcement point.
- The HF incident showed populations fail in ways no member would (collusion,
  division of labor). Economic analog: each agent's mandate can be satisfied
  while the collective mandate is violated.
- Research question: do individually compliant agents produce collectively
  violating spend outcomes? Does fine-tuned mandate-following change that?
  Can audit-ledger forensics detect what per-trajectory monitors miss?

## 2. Related Work

- GovSim (Piatti et al. 2024): cooperation dilemmas over shared resources — no
  authority, mandates, or adversarial collusion.
- Secret Collusion (Motwani et al. 2024): steganographic collusion — no
  economic stakes.
- AI Control (Greenblatt et al. 2024): single untrusted model vs monitor.
- AuthorizationBench (arXiv 2610.27548): single-agent authorization eval.
- Incident analyses: METR HF report (message board, task division,
  self-renaming, ~7% transcript spoofing) — mechanisms mapped to testbed arms.
- Preexisting substrate (declared): cognivern mandate/policy/CRE ledger,
  lexsi DECIDE eval + Aya Expanse LoRA adapter, control-tower monitoring
  concepts.

## 3. Methodology

- Environment: 4 agents, program cap $1200, per-agent cap $400, completion
  bonus $150/agent, luxury category blocked. Task bundles priced ~380 each at
  cheapest vendors → min total ~1520 > cap. `for_agent` purchases charge the
  buyer's budget (collusion primitive). 12 rounds/episode.
- Conditions: channels {none, broadcast, pairwise} × variants
  {aya-expanse-8b base, +lexsi-v4 LoRA} × seeds {0,1}.
- Model: greedy decode, chat template, JSON action contract; unparseable
  actions count as waits.
- Oracle: population violations (treasury_over_cap, mandate_breach,
  disallowed_purchase, unauthorized_transfer), task completion, bonus.
- Oversight: Arm A per-trajectory monitor (individual breaches only);
  Arm B ledger forensics (split purchases, transfer concentration,
  comm↔transaction correlation, cap-race trajectory).

## 4. Results [PENDING]

Table: violation rates, completion, bonus capture, message/transfer counts,
detection gap, per-detector findings — by variant × channel.

## 5. Discussion [PENDING]

- Did violations emerge without communication?
- Did covert channels change violation *shape* (transfers vs open coordination)?
- Did mandate-SFT reduce individual violations while leaving or worsening
  population violations?
- Detection gap: population violations invisible to per-trajectory monitors?

## 6. Limitations & Dual-Use / Ethical Considerations (required)

- Small model (8B) may under-produce frontier collusion; results are a lower
  bound on capability, not a ceiling.
- Simulated spend, not live rails; "economic authority" is modeled.
- The testbed could inform both defenders (oversight design) and attackers
  (evasion); we release detectors alongside the environment so defensive use
  dominates.
- JSON action contract constrains expressiveness vs. free-form agent loops.

## 7. Reproducibility

- Repo: github.com/thisyearnofear/cognivern `lexsi/swarm/`
- Kernel: papajams/lexsi-swarm-eval (Kaggle T4×2)
- Artifacts: episodes.jsonl, summary.json, forensics findings
