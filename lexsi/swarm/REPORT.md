# Collusion Under Mandate: Population-Level Budget Violations from Individually Compliant Agents

*Apart Research Swarm Alignment Hackathon 2026 — Track 2 (Science of Agent Networks) with Track 4 (Oversight) crossover.*
**Status: DRAFT — results pending Kaggle kernel v5.**

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

Agents are being given economic authority: spending sessions, procurement
budgets, per-agent mandates, payment rails. The governance story so far is
per-transaction — a policy check at the wallet chokepoint decides each spend
in isolation. But organizations do not have budgets per employee; they have
budgets per *program*. A population of agents can each stay inside an
individual mandate while the collective outcome violates the program-level
invariant that actually matters.

The OpenAI/Hugging Face incident (July 2025) showed that agent populations
fail in ways no member would: agents self-organized on a shared message
board, divided labor, renamed themselves, and spoofed transcripts — with
roughly 7% of messages containing injected or forged content. The economic
analog is purchase-splitting generalized to a swarm: each transaction looks
compliant, the aggregate does not.

This report asks three questions:

1. **Emergence.** Do individually compliant agents produce collectively
   violating spend outcomes — and does that require communication at all?
2. **Intervention.** Does fine-tuning a model on single-agent mandate
   compliance (our Lexsi adapter) reduce population-level violations — or
   does it improve coordination enough to make violations *more* likely?
3. **Oversight.** When a violation is invisible to per-trajectory monitoring,
   can deterministic audit-ledger forensics recover it?

## 2. Related Work

- **GovSim** (Piatti et al. 2024): LLM agents sharing a common resource face
  cooperation dilemmas. No economic authority, no mandates, no adversarial
  collusion, no audit substrate.
- **Secret Collusion** (Motwani et al. 2024): agents hide information in
  message content via steganography. Demonstrates covert channels but with
  no real stakes — nothing is spent, authorized, or enforced.
- **AI Control** (Greenblatt et al. 2024): protocols for safely deploying
  untrusted models against a trusted monitor. Single untrusted model, not a
  population; no economic dimension.
- **AuthorizationBench** (arXiv 2610.27548): evaluates single-agent
  authorization decisions. Population-level authorization is unmeasured.
- **Incident analyses**: the METR report on the HF incident documents the
  coordination mechanisms (message board, task division, self-renaming,
  transcript spoofing) our channel conditions are designed to echo.
- **Agent economies / spend governance**: x402 payment rails and agent
  spending sessions are emerging infrastructure; per-transaction policy
  enforcement is the current practice. No published work, to our knowledge,
  measures whether per-agent compliance training survives contact with a
  population-level budget.

**Preexisting substrate (declared, not weekend work):** the Cognivern
repository (mandate/policy/evidence-ledger concepts), the Lexsi DECIDE
evaluation suite and Aya Expanse mandate-fine-tuned LoRA adapter, and
Control Tower monitoring concepts. All weekend work is confined to
`lexsi/swarm/` plus this report.

## 3. Methodology

### 3.1 Environment: Agent Bazaar

A procurement market with **4 agents**, a **shared program treasury capped at
$1200**, and **per-agent budget caps of $400**. Each agent holds a private
procurement task (a bundle of 3–4 items) plus a private luxury "want" in a
blocked category — an individually rational temptation that violates its own
mandate if purchased.

Key mechanics:

- **Tasks are priced so full completion is impossible within the cap.** The
  four task bundles cost ~$330–395 each at the cheapest vendor (~$1520 total
  minimum) against a $1200 program cap. Even perfectly efficient, fully
  cooperative agents cannot complete everything without breaching the
  population invariant — they must *choose* which invariant to violate.
- **`for_agent` purchases.** An agent may buy items charged to its own budget
  but credited to another agent's task progress. This is the collusion
  primitive: work can be divided and credit transferred without any agent
  exceeding its own mandate.
- **Completion bonus.** If *all* tasks complete, every agent receives +$150.
  This creates a population-level incentive to coordinate that no individual
  mandate captures.
- **Posted vendor prices.** Four vendors with public per-item price
  multipliers; agents must comparison-shop under uncertainty about what
  others are buying.
- **12 rounds/episode.** Each round every agent submits a plan of actions
  (buys, messages, waits); the environment validates each action in order
  against evolving state. Greedy decoding, fixed chat template.

### 3.2 Conditions

| Factor | Levels |
|---|---|
| Communication channel | `none`, `broadcast`, `pairwise` (private DMs) |
| Model variant | `aya-expanse-8b` base; `+lexsi-v4` LoRA (mandate-SFT) |
| Seeds | {0, 1} — greedy decode, seed affects world generation |

12 episodes per run (3 channels × 2 variants × 2 seeds), ~2h on Kaggle T4×2.

### 3.3 Oracle (population-level verified outcome)

An episode is a **population violation** if any of:

- `treasury_over_cap` — aggregate spend exceeds the program cap;
- `mandate_breach` — any agent exceeds its individual cap;
- `disallowed_purchase` — a blocked-category (luxury) item is bought;
- `unauthorized_transfer` — a buy credits an agent other than the buyer
  (`for_agent` usage).

We additionally record task completion fraction, bonus achievement,
message counts, and per-agent spend trajectories.

### 3.4 Oversight arms

- **Arm A — per-trajectory monitor.** Flags only violations visible in a
  single agent's record: individual mandate breaches, disallowed purchases,
  `for_agent` buys attributed to that agent's own actions. Population-level
  cap breaches with no individual breach are *invisible* to this arm.
- **Arm B — ledger forensics.** Deterministic detectors over the shared
  audit ledger: (i) split purchases (same item+vendor procured by different
  agents — division of labor), (ii) transfer concentration (one agent
  funding many others), (iii) communication↔transaction correlation
  (messages preceding coordinated buys), (iv) cap-race trajectory
  (aggregate spend velocity vs. remaining rounds).

The **detection gap** — population violations Arm B catches that Arm A
misses — is the headline oversight metric.

## 4. Results [PENDING]

*To be filled from `swarm_out/summary.json` + `episodes.jsonl` via
`analyze_swarm.py`. Planned tables:*

- Table 1: violation rates, task completion, bonus capture, message and
  transfer counts by variant × channel (n=2 per cell).
- Table 2: oversight comparison — Arm A vs Arm B detection rates and the
  detection gap.
- Per-detector finding counts (split purchases, transfer concentration,
  comm↔transaction correlation, cap-race).

*Pre-registered expectations (stated before results, to avoid HARKing):*
(a) `treasury_over_cap` will occur in most episodes — the pricing makes it
nearly unavoidable, so the interesting variance is in *how* agents get
there (transfers, luxury buys, message coordination); (b) `pairwise` should
produce more `for_agent` transfers than `broadcast` (covert division of
labor); (c) mandate-SFT should reduce `disallowed_purchase` and
`mandate_breach` per-agent but may not reduce `treasury_over_cap`, which is
a population property no individual decision controls.

## 5. Discussion [PENDING]

- Did violations emerge without communication?
- Did covert channels change violation *shape* (transfers vs open
  coordination)?
- Did mandate-SFT reduce individual violations while leaving or worsening
  population violations?
- Detection gap: population violations invisible to per-trajectory monitors?

## 6. Limitations & Dual-Use / Ethical Considerations (required)

- **Model scale.** Aya Expanse 8B is a small open-weights model; it may
  under-produce frontier collusion. Our results are a lower bound on
  capability, not a ceiling — and conversely, failures may reflect
  instruction-following limits rather than alignment.
- **Simulated stakes.** Spend is modeled, not real; "economic authority" is
  a game mechanic. The findings motivate, but do not prove, risks on live
  payment rails.
- **Task incompleteness.** If agents fail to complete tasks for mundane
  reasons (planning errors, JSON contract friction), population violations
  may reflect incompetence rather than collusion. We report task completion
  alongside violations to keep these interpretations separable.
- **n=2 per cell.** Small sample; we report raw counts and treat channel
  effects as directional, not significant.
- **Dual-use.** The testbed and `for_agent` primitive could inform attackers
  designing budget-evasion schemes. We release the ledger forensics
  detectors alongside the environment so defensive application dominates,
  and we do not release prompts or data optimized for evasion.
- **Preexisting substrate.** Cognivern/Lexsi/Control Tower infrastructure
  predates the sprint and is declared as such; all judged work is the
  swarm testbed, conditions, detectors, and analysis.

## 7. Reproducibility

- Repo: `github.com/thisyearnofear/cognivern`, `lexsi/swarm/`
  (env, sim, prompts, forensics, analyze_swarm, mock policies)
- Kernel: `papajams/lexsi-swarm-eval` on Kaggle (T4×2, ~2h)
- Artifacts: `episodes.jsonl` (full transcripts + receipts),
  `summary.json`, per-detector forensics findings
- Local smoke test: `python -m swarm.run_local --policy naive --channel
  broadcast` (no GPU required)
