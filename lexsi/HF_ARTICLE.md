# Can a Small Open-Weights Model Learn to Enforce Its Own Spending Mandate?

*Agentic fine-tuning for economic authorization — Lexsi AI Safety & Alignment Hackathon, Track 3 (AgentTune + AuditKIT)*

## The problem: governance stops at the wallet

Enterprise agents are starting to hold real economic authority — budgets, vendor
allowlists, category restrictions, approval thresholds. Today, governance over
that authority lives almost entirely at the enforcement chokepoint: wallet
policies, payment rails, and spend limits (the x402 ecosystem and Coinbase
AgentKit spending policies are the current state of the art). That layering is
necessary but not sufficient. If the model itself cannot tell an authorized
purchase from a policy violation, every malformed or manipulated decision
becomes an enforcement-layer incident — a declined payment, a fraud flag, a
manual review queue.

We ask a narrower, testable question: **can agentic fine-tuning internalize
mandate-following *before* actions reach the wallet — and can the improvement
be measured as a reduction in violations that would otherwise have been
enforced?**

## Task and oracle

We built a governed-spend decision task on Cognivern's mandate/policy/evidence
substrate (the same rails that power its production agent-spend governance).
Each episode presents the model with:

- a **spend mandate** — budget, allowlisted vendors, blocked categories,
  approval thresholds;
- a **purchase request** — one or more line items with prices, possibly
  adversarial framing (urgency, claimed authority, fabricated approvals,
  "just this once").

The model must emit a structured decision — `ALLOW`, `REFUSE`, `ESCALATE`, or
`ASK_CLARIFICATION` — plus per-item decisions for multi-line orders, a reason
code, and a rationale. Ground truth comes from a **deterministic policy
oracle** (never shown to the model): budget arithmetic including
tax-inclusive totals, sequential per-item accounting for split purchases,
vendor/category matching, and precedence
`REFUSE > ESCALATE > ASK_CLARIFICATION > ALLOW`.

The headline metric is **unsafe enforced decisions**: contract-valid `ALLOW`s
emitted where policy requires otherwise — violations that would have reached
the wallet. We report it separately from accuracy because a model can be
"accurate" on easy allows while still leaking the violations that matter.
Over-refusal, escalation correctness, and per-item decision accuracy are
tracked as separate diagnostics.

## Evaluation suite

**165 held-out scenarios** (suite v3), held out at the scenario level and
verified by mandate+request hash: none of the 4,022 unique training scenario
bodies appears in the eval set.

- **22 hand-authored `gov-*` scenarios** covering clean allows, over-budget,
  non-allowlist vendors, blocked categories, purchase-splitting, gift cards,
  tax-inclusive totals, recurring commitments, mid-trajectory scope creep, and
  adversarial pressure.
- **48 generated `gen-*` scenarios** from the v2 generator.
- **55 scenarios across 17 new adversarial kinds**: vendor spoofing and case
  tricks, foreign currency, quantity math, multi-item variants, distractor
  clauses, boundary budgets, approval-category literal matches.
- **40 paraphrase-robustness variants** — same mandate semantics, different
  surface wording; labels re-verified against the oracle.

## Pipeline (the required stack, end to end)

1. **AgentTune DECIDE** executes each scenario as a governed decision episode
   and emits the event log.
2. **AuditKIT** `agent_eval` (recorded mode, `CustomPredicate` oracle) scores
   every episode as a verified outcome — policy-correct decision or not —
   keeping contract validity, unsafe enforcement, and over-refusal as separate
   metrics.
3. Failure traces feed a **repair dataset**: deterministic oracle-labeled
   examples plus **rejection-sampled completions** from the base model's own
   correct outputs (RFT).
4. **LoRA SFT** (rank 16, alpha 32) repairs `CohereLabs/aya-expanse-8b` — a
   permitted open-weights model with no native tool-calling template, so the
   decision is a single-turn structured record rather than a tool call.

## Results — canonical bf16, 165-scenario held-out suite

Identical harness, greedy decode, Modal L40S for all models:

| metric | base | v4 | v6 (exploratory) | **v7 (submission)** |
|---|---|---|---|---|
| accuracy | 55.2% (91/165) | 68.5% (113/165) | — | **95.8% (158/165)** |
| unsafe enforced | 50/113 (44.3%) | 23/113 (20.4%) | 5/48 on 70-suite | **3/113 (2.7%)** |
| contract valid | 165/165 | 165/165 | 70/70 | **165/165** |

*(v6 was evaluated on the earlier 70-scenario suite; it is not part of the
suite-v3 table.)*

The base model emits contract-valid but policy-wrong `ALLOW`s on 44% of
must-not-allow cases — the exact failure mode that reaches a wallet.
**v7 cuts unsafe enforced by 94% from base** (and 87% from v4) while lifting
accuracy to 95.8% and keeping contract validity at 100%. On the original
22-scenario suite (Kaggle fp16) earlier adapters cut unsafe enforced 6→2.

### How v7 was built

v7 continues v4's adapter on a **balanced 3,300-row repair set**: 700 replay
rows (protecting v4's existing behavior), 1,800 new oracle-labeled examples
spanning *every* observed failure class — not just arithmetic — and 800
paraphrase-augmented variants for robustness. Two epochs, LoRA r=16, lr 5e-5.

### The honest negatives

- **v5** traded safety for accuracy and was discarded.
- **v6** — v4 + 600 targeted arithmetic examples — raised accuracy to 80.0%
  on the 70-scenario suite but *regressed* unsafe_enforced to 5/48: the
  arithmetic-weighted data made the model more permissive on judgment-heavy
  scenarios (scope creep, recurring commitments). Data mix matters more than
  volume; v6 weights are published for reproducibility.
- **v7f** — a fresh LoRA trained from base on the combined corpus (no v4
  init) — landed at 93.9% accuracy with unsafe_enforced 4/113: slightly
  worse than continue-training on both metrics, confirming that v4's
  learned judgment is worth preserving rather than relearning.

v7's remaining failures (4 unsafe allows, 3 enforced; 2 over-refusals; 1
escalation-to-refusal) are all reported per-scenario in the dataset.

## What worked, what didn't

SFT fixed the *judgment* failures: fabricated approvals, claimed authority,
recurring-commitment laundering, scope creep in most forms, vendor spoofing,
foreign currency, and quantity math. What remains is a small residue — 7
failures out of 165, including the hardest arithmetic case (simultaneous
split purchases over budget, `gov-17`), one scope-creep variant, one
partial-decision case, and boundary over-refusals on unusual-but-valid
allows. The useful scientific finding: mandate-following and arithmetic
reliability are partially separable skills, data targeting one can erode
the other (v6), and *balanced* coverage of every failure class is what
finally moved the headline metric (v7).

## Limitations

- Single-turn structured decisions, not multi-step tool-call trajectories
  (Aya Expanse has no tool-calling template).
- Spend is simulated — "enforcement" is the decision contract, not a live
  wallet. The production Cognivern substrate these scenarios derive from does
  settle real x402 payments, but this eval measures the decision layer.
- Held-out at the *scenario* level but same generator distribution as
  training; it measures generalization to unseen scenarios, not a different
  task distribution.
- bf16 and 4-bit NF4 evals produce materially different absolute numbers;
  canonical results are bf16.

## Reproduce

All artifacts are public:

- **Dataset**: [`Papajams/lexsi-governance`](https://huggingface.co/datasets/Papajams/lexsi-governance)
  — `v7/eval_suite_v3.jsonl` (165 scenarios), `v7/sft_v7.jsonl` (3,300 rows),
  `v7/dpo_seed_pairs.jsonl`, `v7/gen_v3.py`, `v7/results/` per-scenario
  metrics and eval logs for base/v4/v7; earlier `eval_suite_v2.jsonl`,
  `sft_v4/v5/v6` files and `results70/` logs also included.
- **Adapters**: [`aya-expanse-8b-lexsi-v7`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v7)
  (submission) · [`aya-expanse-8b-lexsi-v4`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v4)
  (previous best) · [`aya-expanse-8b-lexsi-v6`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v6)
  (exploratory — safety regression documented).
- **Code**: [`lexsi/`](https://github.com/thisyearnofear/cognivern/tree/main/lexsi)
  in the cognivern repo — oracle + scenario generators (`gen_v3.py`),
  AgentTune workflow, AuditKIT scoring, Kaggle/Colab/Modal training and eval
  scripts (`modal_v7.py`, `lexsi_v7_colab.py`).

Training reproduces on free-tier and low-cost GPUs (Kaggle T4×2 for v4;
Modal L40S for v6/v7 canonical bf16 runs; Colab T4 for 4-bit iteration).

## Why this matters

To our knowledge this is the first evaluation-and-repair loop targeting
*economic authorization* specifically. Closest prior work —
AuthorizationBench (arXiv 2610.27548) — benchmarks authorization alignment
eval-only, without spend stakes, a training intervention, or an audit trail.
As agents gain wallet authority, "did the model follow the mandate" becomes a
first-class safety property — and it is measurable, improvable, and auditable.
