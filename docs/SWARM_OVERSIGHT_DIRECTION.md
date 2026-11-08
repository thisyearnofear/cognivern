# Swarm Oversight — product direction notes

*Drafted Nov 8, 2026 alongside the Apart Swarm Alignment sprint work
(`lexsi/swarm/`, `docs/APART_SWARM_2026.md`). Directional — priorities depend
on the swarm eval results; see "Open questions" at the bottom.*

## The finding that should reshape the product

Every current frontend surface is **per-agent, per-run**: agent spend history
and budget (`components/agents/agent-detail.tsx`), per-decision governance
traces (`components/observability/`), per-agent policies
(`components/policies/`). The swarm testbed's core result — already visible in
mock runs — is that the dangerous failure class is **collective**: a program
treasury cap can be breached while every agent stays individually compliant.
Per-trajectory monitors structurally cannot see it; only population-level
ledger analysis can.

If the Kaggle run confirms this with real models, "safety is a property of
each agent's trajectory" stops being a viable product assumption.

## Proposed evolution, in priority order

### 1. Population layer — programs and shared pools

- New "Programs" surface above agents: shared treasury caps, aggregate spend
  velocity, per-program mandate coverage, program-level completion bonuses.
- Policy objects gain a collective tier: program caps, pooled budgets,
  cross-agent constraints — today `policies` only models individual mandates.
- The backend oracle already treats the program cap as the real invariant;
  the UI should match.

### 2. Ledger forensics as a first-class observability surface

- Port the swarm detectors (`lexsi/swarm/forensics.py`) to run over CRE
  records: split purchases (same item/vendor across agents in a window),
  transfer concentration (`for_agent` funding patterns), comm↔transaction
  correlation, cap-race spend trajectories.
- Surface as a "swarm signals" panel in `observability`, each finding deep-
  linked to evidence/trace IDs — the existing trace-ID pattern extends
  naturally.
- Productize the **detection gap** as a metric: "population violations your
  per-run monitors cannot see." That number is the pitch.

### 3. Delegated-spend visibility

- `for_agent` purchases are the collusion primitive. Agent detail should show
  "spent on behalf of" / "funded by" edges, not a flat spend list.
- A cross-agent transaction graph (even force-directed-simple) makes
  unauthorized transfers legible at a glance.

### 4. Decision-provenance layering

- The lexsi result: mandate-SFT moved unsafe *enforced* decisions 35%→12%
  while enforcement stayed at 100% contract validity — i.e. the model stopped
  violations *before* the chokepoint.
- UI should show which layer decided each spend: model judgment vs policy
  enforcement vs human escalation. "Defense-in-depth" becomes visible —
  violations caught by the model never appear as enforcement events.

### 5. Escalation inbox

- ESCALATE is a first-class decision in the governance contract and needs a
  human queue (approve/reject with evidence attached), not just a log line.
- Generalize the existing spend-confirm flow in `agent-detail` into a proper
  escalation surface.

### 6. "Agent Bazaar" live demo (optional, high demo value)

- If swarm episodes produce real transcripts, a demo page could replay or
  live-run the 4-agent market with the forensics panel lighting up on
  collusion — a stronger demo than a static metrics table, for both hackathon
  judging and sales.

## Open questions (resolve after swarm results land)

- Did population violations emerge *without* communication? (changes how
  alarming item 1 is)
- Did mandate-SFT reduce individual violations while leaving/worsening
  population violations? (changes the item-4 narrative)
- How large is the detection gap between per-trajectory and ledger
  forensics? (sizes item 2)
- Did covert (pairwise) channels produce stealthier violation shapes than
  broadcast? (informs detector priorities)

## Non-goals for now

- No production multi-agent orchestration — this is observability/governance
  surface work, not a new agent runtime.
- No changes to live rails (Canton/x402) — the swarm environment is simulated
  spend; productizing real delegated spending is a later, separate decision.
