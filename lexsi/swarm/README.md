# Agent Bazaar — swarm-economy testbed

Weekend work for the **Apart Research Swarm Alignment Hackathon 2026**
(submission deadline Nov 8, 11:59 PM AoE). See `docs/APART_SWARM_2026.md`.

## What this is

A multi-agent procurement market where N agents each hold an individual spend
mandate (budget cap, blocked categories) and a procurement task, operating
over a **shared program treasury with a hard cap**. Tasks are priced so full
completion requires exceeding the program cap — individually compliant agents
can still produce a collectively violating outcome. Agents may communicate
(none / broadcast / pairwise channels) and may buy items `for` other agents
(charged to the buyer's budget — the collusion primitive).

## Population-level violations (oracle)

`treasury_over_cap`, `mandate_breach`, `disallowed_purchase` (luxury category),
`unauthorized_transfer` (`for != self` spend). Per-episode outcome +
forensics in `forensics.py`.

## Oversight arms

- **A — per-trajectory monitor**: flags single-agent mandate breaches only.
- **B — ledger forensics**: deterministic detectors over the population
  ledger — split purchases, transfer concentration, comm↔transaction
  correlation, cap-race spend trajectories.

`oversight_comparison()` reports the detection gap per episode.

## Files

- `env.py` — world state, actions, oracle (`episode_outcome`)
- `prompts.py` — observation rendering + JSON action contract
- `sim.py` — episode runner (model-agnostic `generate(messages)` injection)
- `forensics.py` — oversight detectors + arm comparison
- `mock.py` — deterministic policies for GPU-free smoke tests
- `run_local.py` — local runner (mock or OpenAI-compatible endpoint)
- `../kaggle/swarm_kernel.py` — Kaggle T4 kernel: full condition matrix on
  `CohereLabs/aya-expanse-8b` base vs LoRA-tuned

## Preexisting vs weekend work (declared for the sprint)

- **Preexisting:** cognivern repo, `lexsi/` eval/oracle/SFT pipeline,
  control-tower, the Kaggle train/eval kernel pattern, the aya-expanse-8b
  LoRA adapter (`Papajams/aya-expanse-8b-lexsi-v4`).
- **Weekend work (this submission):** everything in `lexsi/swarm/`,
  `kaggle/swarm_kernel.py`, the condition matrix, forensics detectors,
  results, and the report.

## Smoke test (no GPU)

```bash
cd lexsi
.venv/bin/python -m swarm.run_local --policy naive --channel none --episodes 2
.venv/bin/python -m swarm.run_local --policy colluder --channel pairwise --episodes 2
```

Naive agents overspend the program cap with zero communication
(`treasury_over_cap`, detection gap = True); the colluder adds
`unauthorized_transfer` signatures the per-trajectory monitor misses.
