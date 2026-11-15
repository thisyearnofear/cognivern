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

**70 held-out scenarios**, split-level held out: no scenario in the eval suite
appears in any training file (verified by ID — training uses a disjoint
generator namespace).

- **22 hand-authored `gov-*` scenarios** covering clean allows, over-budget,
  non-allowlist vendors, blocked categories, purchase-splitting, gift cards,
  tax-inclusive totals, recurring commitments, mid-trajectory scope creep, and
  adversarial pressure.
- **48 generated `gen-9xxx` scenarios** with deterministic oracle labels,
  weighted toward the failure classes found in early evals.

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

## Results — canonical bf16, 70-scenario held-out suite

Identical harness, greedy decode, Modal L40S for all three models:

| metric | base | v4 (submission adapter) | v6 (exploratory) |
|---|---|---|---|
| accuracy | 58.6% (41/70) | 78.6% (55/70) | 80.0% (56/70) |
| unsafe enforced | 17/48 (35.4%) | **2/48 (4.2%)** | 5/48 (10.4%) |
| contract valid | 70/70 | 70/70 | 70/70 |

The base model emits contract-valid but policy-wrong `ALLOW`s on over a third
of must-not-allow cases — the exact failure mode that reaches a wallet.
**v4 cuts unsafe enforced by 88%** while lifting accuracy 20 points and keeping
contract validity at 100%. On the original 22-scenario suite (Kaggle fp16) the
same adapter cuts unsafe enforced 6→2.

### The honest negative: v6

We ran a second iteration — v6, continuing v4's training on 600 additional
**targeted arithmetic examples** aimed at the two residual failure classes
(tax-inclusive totals, multi-item split accounting). It raised accuracy to
80.0% but **regressed unsafe_enforced to 5/48**: the arithmetic-weighted data
made the model more permissive — it newly unsafe-allowed judgment-heavy
scenarios (mid-trajectory scope creep, recurring commitments) while fixing
arithmetic and clarification cases. Classic safety/utility trade-off, caught
precisely because the metrics are separated. **v4 is the submitted adapter**;
v6 weights are published for reproducibility.

v4's remaining failures are budget-arithmetic edge cases (combined multi-item
totals, tax-inclusive estimates) and a small number of
escalation-vs-refusal boundary calls — all reported per-scenario in the
dataset.

## What worked, what didn't

SFT fixed the *judgment* failures: fabricated approvals, claimed authority,
recurring-commitment laundering, scope creep. It did not fully fix *arithmetic*
failures — multi-item totals and tax-inclusive estimates remained the residual
hole even after targeted data (and targeted data alone regressed safety
elsewhere). That split is the useful scientific finding: mandate-following and
arithmetic reliability are partially separable skills, and data targeting one
can erode the other.

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
  — `eval_suite_v2.jsonl` (70 scenarios), `sft_v4.jsonl` / `sft_arith.jsonl` /
  `sft_v6.jsonl`, `results70/` per-scenario metrics and eval logs.
- **Adapters**: [`aya-expanse-8b-lexsi-v4`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v4)
  (submission) · [`aya-expanse-8b-lexsi-v6`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v6)
  (exploratory).
- **Code**: [`lexsi/`](https://github.com/thisyearnofear/cognivern/tree/main/lexsi)
  in the cognivern repo — oracle + scenario generators, AgentTune workflow,
  AuditKIT scoring, Kaggle/Colab/Modal training and eval scripts.

Training reproduces on free-tier GPUs (Kaggle T4×2 for v4; Modal L40S for v6).

## Why this matters

To our knowledge this is the first evaluation-and-repair loop targeting
*economic authorization* specifically. Closest prior work —
AuthorizationBench (arXiv 2610.27548) — benchmarks authorization alignment
eval-only, without spend stakes, a training intervention, or an audit trail.
As agents gain wallet authority, "did the model follow the mandate" becomes a
first-class safety property — and it is measurable, improvable, and auditable.
