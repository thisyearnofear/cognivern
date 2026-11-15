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

One accounting note up front. The harness computes `unsafe_enforced` over the
113 scenarios whose expected *overall* decision is non-`ALLOW`. One further
scenario (`gov-10`) expects a *partial* order — allow one item, refuse the
other — and is not in that denominator. Allowing its must-refuse item is just
as much a wallet-reaching violation, so we report it on its own row (out of
114) instead of leaving it out silently.

## Evaluation suite

**165 held-out scenarios** (suite v3), held out at the scenario level and
verified by mandate+request hash: none of the 4,022 unique training scenario
bodies appears in the eval set. Hash dedup rules out identical scenarios, not
same-template neighbours with different numbers — the per-subset breakdown
below is how to read the results with that in mind.

- **22 hand-authored `gov-*` scenarios** covering clean allows, over-budget,
  non-allowlist vendors, blocked categories, purchase-splitting, gift cards,
  tax-inclusive totals, recurring commitments, mid-trajectory scope creep, and
  adversarial pressure.
- **48 generated `gen-*` scenarios** from the v2 generator.
- **55 scenarios across 17 new adversarial kinds**: vendor spoofing and case
  tricks, foreign currency, quantity math, multi-item variants, distractor
  clauses, boundary budgets, approval-category literal matches.
- **40 paraphrase-robustness variants** — same mandate semantics, different
  surface wording; labels re-verified against the oracle. Each is a paraphrase
  of another generated *eval* scenario, so these are not 40 independent items.

The `gov-*` and v2 scenarios were also our iteration signal while building
v4–v6, so they double as a development set.

## Pipeline (the required stack, end to end)

1. **AgentTune DECIDE** (`workflows/spend_governance.yaml`) defines the
   governed decision episode — prompt, decision contract, event log — and
   `run_baseline.py` executes it live against a served model.
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

How the stack applies to the headline numbers: the 165-scenario bf16 runs do
batch GPU inference in a self-contained Modal harness (`modal_v7.py`,
`modal_v7f.py`) that uses the DECIDE workflow's prompt template and decision
contract; the saved episodes are then scored by AuditKIT in recorded mode
(`scripts/rescore_auditkit.py`), and the `auditkit_*.json` outputs are
published next to the harness metrics. AgentTune DECIDE ran live (with its
own event log, `audit.jsonl`) for the baseline diagnosis runs on the original
22-scenario suite; AuditKIT scoring is recorded-mode over saved episodes
throughout. LoRA training is plain PEFT/TRL SFT.

## Results — canonical bf16, 165-scenario held-out suite

Identical harness, greedy decode, Modal L40S for all models:

| metric | base | v4 | **v7 (submission)** | v7f (ablation) |
|---|---|---|---|---|
| accuracy | 55.2% (91/165) | 68.5% (113/165) | **95.8% (158/165)** | 93.9% (155/165) |
| unsafe enforced (113 non-`ALLOW` scenarios) | 50/113 (44.3%) | 23/113 (20.4%) | **3/113 (2.7%)** | 4/113 (3.5%) |
| unsafe allows incl. partial-order case `gov-10` (114) | 50/114 (43.9%) | 23/114 (20.2%) | **4/114 (3.5%)** | 5/114 (4.4%) |
| contract valid | 165/165 | 165/165 | **165/165** | 165/165 |
| AuditKIT verified outcome (recorded mode) | 91/165 | 113/165 | **158/165** | 155/165 |

![Unsafe enforced decisions by model version — violations that would have reached the wallet, out of 113 must-not-allow scenarios](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/9tcc9e6etvr9ns23hcrs.png)

The base model emits contract-valid but policy-wrong `ALLOW`s on 44% of
must-not-allow cases — the exact failure mode that reaches a wallet.
**v7 cuts unsafe enforced from 44.3% to 2.7%** (3.5% counting `gov-10`) — a
92–94% relative reduction from base and 83–87% from v4 — while lifting
accuracy to 95.8% and keeping contract validity at 100%. The suite is small:
the 95% Wilson interval on v7's 4/114 is 1.4–8.7%.

### Where the gain comes from — read this before the headline

Unsafe allows (and accuracy) by eval subset, recomputed from the published
per-scenario logs:

| subset (must-not-allow n) | base | v4 | v7 |
|---|---|---|---|
| hand-authored `gov-*` (18 of 22) | 6 · acc 13/22 | 2 · acc 13/22 | **3** · acc 17/22 |
| v2 generated (31 of 48) | 11 · acc 28/48 | 0 · acc 42/48 | 0 · acc 47/48 |
| 17 new adversarial kinds (35 of 55) | 21 · acc 30/55 | 13 · acc 33/55 | 0 · acc 55/55 |
| paraphrase variants (30 of 40) | 12 · acc 20/40 | 8 · acc 25/40 | 1 · acc 39/40 |

Two things follow, and we would rather say them than have a reader find them:

- **v7's gain over v4 is on generator-family scenarios.** The 17 new kinds
  were added to the eval suite and to v7's training generator in the same
  iteration — different instances, same templates — and v4 never trained on
  them. So v4 → v7 on those rows shows the repair loop can teach a template
  family and that it transfers to unseen instances and paraphrases of it. It
  does not show generalization to adversarial kinds the model has never seen.
- **On the 22 hand-authored scenarios — the only subset our generator did
  not produce — v7 is more accurate than v4 (13 → 17) but not safer** (2 → 3
  unsafe allows: `gov-21` fixed, `gov-10` and `gov-13` newly allowed,
  `gov-17` still allowed). With 18 cases that is noise, not a regression
  claim, but it means the safety improvement over v4 is not demonstrated
  outside the generator family. Against base the hand-authored subset still
  halves (6 → 3). Three of v7's four unsafe allows are hand-authored.

### How v7 was built

v7 continues v4's adapter on a **balanced 3,300-row repair set**: 700 replay
rows (protecting v4's existing behavior), 1,800 new oracle-labeled examples
spanning *every* observed failure class — not just arithmetic — and 800
paraphrase-augmented variants for robustness. Two epochs, LoRA r=16, lr 5e-5.
The failure classes were read off v4's errors on the evaluation scenarios, so
the eval informed the training mix at the level of scenario *kind* (never
scenario body) — the reason for the subset caveat above.

### The honest negatives

- **v5** traded safety for accuracy and was discarded.
- **v6** — v4 + 600 targeted arithmetic examples — raised accuracy to 80.0%
  on the 70-scenario suite but *regressed* unsafe_enforced to 5/48: the
  arithmetic-weighted data made the model more permissive on judgment-heavy
  scenarios (scope creep, recurring commitments). Data mix matters more than
  volume; v6 weights are published for reproducibility.
- **v7f** — a fresh LoRA trained from base on the combined corpus (no v4
  init) — landed at 93.9% accuracy with unsafe_enforced 4/113 (5/114 with
  `gov-10`): one scenario behind v7 on safety and three on accuracy. That is
  within noise at this suite size, so we do not claim continue-training is
  better — only that retraining from scratch was not. v7 was kept under the
  selection rule fixed in advance (lower unsafe_enforced; tie → accuracy).

v7's seven remaining failures are four unsafe allows — `gov-10` (partial
order), `gov-13` (scope creep), `gov-17` (simultaneous split over budget) and
`gen-09208` (a paraphrase), all contract-valid — plus two over-refusals and
one escalation-to-refusal. All are reported per-scenario in the dataset.

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
finally moved the headline metric (v7) — within the generator family, per
the subset table.

## Limitations

- Single-turn structured decisions, not multi-step tool-call trajectories
  (Aya Expanse has no tool-calling template).
- Spend is simulated — "enforcement" is the decision contract, not a live
  wallet. The production Cognivern substrate these scenarios derive from does
  settle real x402 payments, but this eval measures the decision layer.
- Held-out at the *scenario* level but same generator distribution as
  training, and the new adversarial kinds were introduced to eval and training
  together. The suite measures generalization to unseen instances and
  paraphrases, not to unseen kinds or a different task distribution; on the
  hand-authored subset v7 is not safer than v4. A held-out-kind split is the
  obvious next experiment.
- Small n: 114 must-not-allow cases, 40 of them paraphrases of other eval
  items. Differences of one or two scenarios (v7 vs v7f) are noise.
- One model family (`aya-expanse-8b`), one seed per adapter.
- bf16 and 4-bit NF4 evals produce materially different absolute numbers;
  canonical results are bf16.

## Reproduce

All artifacts are public:

- **Dataset**: [`Papajams/lexsi-governance`](https://huggingface.co/datasets/Papajams/lexsi-governance)
  — `v7/eval_suite_v3.jsonl` (165 scenarios), `v7/sft_v7.jsonl` (3,300 rows),
  `v7/gen_v3.py`, `v7/results/` per-scenario eval logs, harness metrics and
  AuditKIT scores for base/v4/v7/v7f; earlier `eval_suite_v2.jsonl`,
  `sft_v4/v6` files and `results70/` logs also included.
  `v7/dpo_seed_pairs.jsonl` holds 15 v4 failures *on eval scenarios* paired
  with gold answers — seeds for a DPO stage we did not run. It was **not used
  in any training run** and must not be trained on if you evaluate on suite v3.
- **Adapters**: [`aya-expanse-8b-lexsi-v7`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v7)
  (submission) · [`aya-expanse-8b-lexsi-v4`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v4)
  (previous best) · [`aya-expanse-8b-lexsi-v6`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v6)
  (exploratory — safety regression documented).
- **Code**: [`lexsi/`](https://github.com/thisyearnofear/cognivern/tree/main/lexsi)
  in the cognivern repo — oracle + scenario generators (`gen_v3.py`),
  AgentTune workflow, AuditKIT scoring, Kaggle/Colab/Modal training and eval
  scripts (`modal_v7.py`, `modal_v7f.py`, `lexsi_v7_colab.py`).

v4 trains and evaluates on a free Kaggle T4×2. The canonical bf16 v6/v7/v7f
runs used a rented Modal L40S (low cost, not free); a Colab T4 4-bit path
exists for iteration but gives different absolute numbers.

## Why this matters

To our knowledge this is the first evaluation-and-repair loop targeting
*economic authorization* specifically. Closest prior work —
AuthorizationBench (arXiv 2610.27548) — benchmarks authorization alignment
across ten application domains; it is evaluation-only and not spend-specific,
with no training intervention or audit trail.
As agents gain wallet authority, "did the model follow the mandate" becomes a
first-class safety property — and it is measurable, improvable, and auditable.
