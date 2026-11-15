# Lexsi → product translation

What the Lexsi governed-spend work (Track 3 submission, `lexsi/`) teaches us
about Cognivern's roadmap — and the build order that follows. Durable context:
`docs/LEXSI_HACKATHON.md` (experiment log), `lexsi/SUBMISSION.md` (submission),
`lexsi/HF_ARTICLE.md` (write-up).

## What the experiments actually showed

- **A small open model can internalize mandate-following.** v7
  (`aya-expanse-8b-lexsi-v7`, LoRA r=16 continued from v4) cut unsafe enforced
  spend decisions from 50/113 → 3/113 (94%) and lifted accuracy to 95.8% on a
  165-scenario held-out suite, contract validity 100%. Economic authorization
  is a learnable safety property, not just an enforcement-layer concern.
- **`unsafe_enforced` is the metric that matters.** "Contract-valid ALLOWs
  where policy requires otherwise" — the violations that would have reached
  the wallet. Accuracy alone hides the failures that cost money.
- **Data mix beats data volume.** v6 (600 arithmetic-targeted examples)
  raised accuracy but *regressed* unsafe_enforced — targeted retraining erodes
  adjacent judgment classes. v7's balanced per-failure-class mix + replay
  rows is what moved the headline metric.
- **The audit trail is training-data provenance.** Every governed decision
  already emits CRE evidence; those traces can be rescored, mined for
  failures, and turned into repair data. Evidence-native post-training is a
  real differentiator — nobody else has the ledger.
- **Honest negatives are cheap credibility.** Reporting v5/v6 regressions
  publicly is what makes the v7 claim believable.

## Product implications

1. **Decision layer as a product surface.** Governance today is
   enforcement-first (policy checks at payment/ledger chokepoints). The Lexsi
   result motivates a *pre-flight decision* tier: agents query a decision
   endpoint before attempting spend and get the four-way contract
   (`ALLOW | REFUSE | ESCALATE | ASK_CLARIFICATION` + checks + rationale).
   The deterministic oracle is canonical; a fine-tuned adapter is the
   learned approximation for unstructured/ambiguous requests.
2. **`unsafe_enforced` as a sellable KPI.** Per-agent, per-mandate
   unsafe-enforcement rate on the spend ledger is the number enterprise
   buyers understand — declined payments, fraud flags, review-queue load.
   Governance stops being a binary allow/deny log and becomes an assurance
   dashboard.
3. **The repair loop is an architecture.** Eval → oracle → failure taxonomy
   → balanced SFT is productizable: per-tenant adapters on a shared base,
   retrained from that tenant's own CRE decision traces.
4. **Eval infrastructure as a retention product.** The scenario
   generator + deterministic oracle + multi-metric harness is a continuous
   compliance regression suite: when a customer changes a mandate, swaps a
   model, or edits a prompt, prove the decision layer still respects policy.
   "Prove your agent still complies" is a recurring-value surface.
5. **Positioning.** AgentKit/x402-style controls enforce at the wallet;
   Cognivern can claim the model itself is mandate-aligned — enforcement
   becomes the backstop, not the only line of defense.

## Build order

- [x] **Decision contract API** — `POST /api/spend/mandate-decision`
      (`SpendMandateDecisionService`, deterministic oracle port; every call
      writes a `mandate_spend_decision` CRE event). Deterministic layer only;
      structured-policy requests covered.
- [~] **Unsafe-enforcement metrics on the spend ledger** — v1 shipped:
      `GET /api/spend/mandate-decisions/summary` aggregates CRE
      `mandate_spend_decision` events into per-decision-type and per-agent
      counts (the decision distribution half of the KPI). Still needed: the
      decision→violation join — flagging contract-valid ALLOWs that violated
      mandate terms discovered downstream (e.g., Telegraph compliance
      screening) — requires correlating decision events with later
      enforcement outcomes across CRE runs.
- [ ] **Model-assisted decision path** — optional adapter call for requests
      the deterministic layer can't judge (ambiguous vendor names,
      justification-text pressure like urgency/claimed authority, which the
      hand-authored gov-* scenarios cover but the oracle does not). Host the
      LoRA behind an internal endpoint; keep deterministic as canonical.
- [~] **Per-tenant eval/regression service** — v1 shipped:
      `POST /api/spend/mandate-eval` accepts a workspace-supplied scenario
      suite (`{mandate, request, expected}`), runs it through the oracle, and
      returns per-scenario verdicts plus Lexsi-compatible metrics (accuracy,
      unsafe_enforced, error classes); every run writes a
      `mandate_eval_run` CRE event. Still needed: the scenario *generator*
      (port `lexsi/scripts/gen_v3.py` kinds) and scheduling it as a gate on
      mandate/policy/model changes.
- [ ] **Adapter fine-tuning rail** — premium offering: fine-tune a tenant
      adapter from their CRE decision traces using the balanced-mix recipe
      (replay + per-class coverage — the v6 lesson is now an engineering
      rule).

## Honest limits

- Lexsi spend is **simulated** — the eval measures the decision contract,
  not live settlement. Product claims stay at the decision layer unless we
  wire real x402 evals.
- Eval is **same-distribution** (unseen scenarios, same generator family) —
  95.8% is real but not a different task distribution.
- Aya Expanse has **no tool-calling template** — the adapter emits
  single-turn structured decisions, not multi-step trajectories.
- The deterministic oracle covers **structured policy only**; judgment calls
  on adversarial text (urgency, claimed authority, justification gaming)
  need the model path or human escalation — which is what ESCALATE is for.
