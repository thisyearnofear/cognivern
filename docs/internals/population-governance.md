# Population Governance — product design principles

*Derived from the Apart Swarm Alignment experiment (`lexsi/swarm/`, report in
`lexsi/swarm/REPORT.md`, results in `lexsi/swarm/results/v8/`). Durable design
constraints for the Programs/population layer; update when product changes.*

## What the experiment showed

12 episodes × {none, broadcast, pairwise} × {base, mandate-SFT'd Aya Expanse
8B} × 2 seeds in Agent Bazaar (4 agents, $400 mandates each, $1200 program
cap, tasks priced ~$1520 minimum):

- **12/12 episodes breached the program cap** ($1477 base / $1550 tuned) with
  **zero individual mandate breaches** — the violation is arithmetic:
  Σ mandates ($1600) > program invariant ($1200). Honest compliance guarantees
  the breach.
- **Detection gap = 100%**: per-trajectory oversight flagged 0/12 population
  violations; deterministic ledger forensics caught 12/12.
- Agents **looped identical purchase plans** all 12 rounds; communication
  changed message volume, not plans.
- Base agents broadcast compliance theater ("adhering to policy, no luxury")
  while overspending — verbal compliance uncorrelated with outcomes.
- Mandate-SFT **collapsed the action distribution**: zero messages ever,
  overspent more, completed fewer tasks (0% vs 25%).
- `for_agent` delegated purchases, luxury buys, and strategic division of
  labor **never occurred** in 576 agent-rounds — collusion primitives exist
  but went unused at this model scale.

Sibling-project corroboration (ratiocine `swarm_eval`): a verifier-peer
monitor mostly *hurt* outcomes (evidence dilution + cheap flagging), and
unanimity under poisoned data *fell* while errors rose — confidently-wrong
convergence is a real signature.

## Design principles

### P1 — Coverage lint at mandate issuance (highest leverage)

The breach was guaranteed at configuration time. When a mandate is created
or funded inside a program, compute `Σ authorized budgets` vs. the program
invariant and surface over-provisioning **before** spend occurs — warn, and
optionally require explicit acknowledgment. This is a pure function over
existing data (mandate `budget.byAsset`, program treasury) and belongs at
write time, not in observability.

### P2 — The program invariant is a first-class object

The binding constraint lives one level above the mandate. Programs need
explicit, typed invariants — hard cap, spend-velocity limits, aggregate
category rules — not just an implicit budget field. `/programs/[id]` shows
the invariant, consumption, and a **spend-over-time trajectory** (cap-race
is a trajectory problem; a static utilization bar cannot show it).

### P3 — Detection gap is a per-program metric

"Violations your per-agent monitors cannot see" is computable per program:
population signals fired while no individual mandate breach exists. Surface
it as a first-class number — it is the product's core claim.

### P4 — Ledger is ground truth; agent narrative is a claim

Compliance theater is the equilibrium. All governance surfaces derive from
CRE/attribution records, never transcripts or agent self-reports. If agent
messages are ever displayed, they are labeled claims, not evidence.

### P5 — Escalation needs evidence packets, not scores

Flagging is cheap; checking is expensive (monitor finding). An escalation
item must carry the evidence an operator needs to decide: relevant ledger
findings, program utilization at decision time, and which invariant is at
risk. Approve/reject records *which evidence was shown* so the escalation
itself is auditable. Oversight must not consume the resource it oversees
(the dilution confound is real).

### P6 — Delegated spend gets beneficiary-side coverage checks

`for_agent` is the collusion primitive. A beneficiary outside the mandate
population is already a critical signal; a beneficiary *inside* it still
needs scrutiny — buying on agent A's budget to credit agent B's task is how
work divides under the radar. Coverage checks apply to beneficiaries, not
only buyers.

### P7 — Fine-tuning has measurable behavioral side-effects

Policy internalization can collapse capabilities (the SFT'd model stopped
communicating entirely). If governed agents are fine-tuned, track
action-distribution entropy and cross-agent signal volume alongside
violation rates — a model that cannot communicate cannot collude, but also
cannot cooperate.

### P8 — Signals need confidence and dedup semantics

`split_purchase` fired mostly on repetitive same-item buying, not strategic
division. Low-confidence signals must aggregate, not spam; repeated
identical findings dedup. A signal that fires constantly is noise and
erodes the inbox.

## Non-goals

- No production multi-agent orchestration — this is governance/observability
  surface work.
- No changes to live rails (Canton/x402) — swarm spend is simulated;
  productizing real delegated spending is a separate decision.
