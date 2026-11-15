# Lexsi submission draft — cognivern spend-governance

Track: **3 — Agentic Fine-tuning** (AgentTune + AuditKIT spine).
Problem statement: **#7 — business workflow and decision agents with a full audit trail**.
Model: `CohereLabs/aya-expanse-8b` (permitted Cohere open weights) + LoRA adapter.
Status: FINAL — **v7 adapter is the submission artifact** (`Papajams/aya-expanse-8b-lexsi-v7`). Head-to-head complete: v7 (continue-train) unsafe_enforced 3/113 vs v7f (fresh-combined) 4/113 — v7 wins on the selection rule (lower unsafe_enforced, tie → accuracy). Canonical numbers are the bf16 165-scenario suite v3 (Modal L40S, consistent harness).

## Abstract (<500 words)

**Can a small open-weights model learn to enforce its own spending mandate?**

Enterprise agents increasingly hold economic authority — budgets, vendor
allowlists, category restrictions — yet governance today lives almost entirely
at the enforcement chokepoint (wallet policies, payment rails). If the model
itself cannot tell an authorized purchase from a policy violation, every
malformed or manipulated decision becomes an enforcement-layer incident. We ask
whether agentic fine-tuning can internalize mandate-following *before* actions
reach the wallet, and whether the improvement is measurable as a reduction in
violations that would otherwise have been enforced.

We build a governed-spend decision task on Cognivern's mandate/policy/evidence
substrate. Each episode presents the model with a spend mandate (budget,
allowlisted vendors, blocked categories, approval thresholds) and a purchase
request, and requires a structured four-way decision — `ALLOW`, `REFUSE`,
`ESCALATE`, or `ASK_CLARIFICATION` — with per-item decisions for multi-line
orders. The evaluation suite contains **165 held-out scenarios**: 22
hand-authored cases covering clean allows, budget overruns, non-allowlist
vendors, blocked categories, purchase-splitting, gift cards, tax-inclusive
totals, recurring commitments, mid-trajectory scope creep, and adversarial
pressure (urgency, claimed authority, fabricated approvals, "just this once");
48 generated held-out scenarios; 55 scenarios across 17 new adversarial kinds
(vendor spoofing and case tricks, foreign currency, quantity math, multi-item
variants, distractor clauses, boundary budgets); and 40 paraphrase-robustness
variants. No evaluation scenario appears in any training file — verified by
mandate+request hash across all 4,022 training scenario bodies. Ground truth
is computed by a deterministic policy oracle and never shown to the model;
raw responses are preserved for audit.

The pipeline follows the hackathon stack end to end. **AgentTune** DECIDE
workflows execute each scenario as a governed decision episode and emit the
event log; **AuditKIT** `agent_eval` scores every episode with a verified-outcome
oracle (did the agent reach the policy-correct decision), keeping contract
validity, unsafe-enforcement, and over-refusal as separate diagnostics rather
than collapsing them into one accuracy number. Failure traces feed a repair
dataset — deterministic oracle-labeled examples plus rejection-sampled
completions from the model's own correct outputs — and **AgentTune**-compatible
LoRA SFT (rank 16) repairs `aya-expanse-8b`.

On the held-out 165-scenario suite (bf16, greedy decode, identical harness),
the base model emits a contract-valid but policy-wrong `ALLOW` on 50 of 113
must-not-allow cases — violations that would have reached enforcement (44.3%).
The v4 adapter cut that to 23/113 (20.4%). The v7 adapter — v4 continued on a
balanced 3,300-row repair set spanning every observed failure class — reduces
unsafe enforced decisions to **3/113 (2.7%)**, a 94% reduction from base and
87% from v4, while accuracy rises to **95.8%** and contract validity stays at
100%. We report two honest negatives that shaped the final artifact: v6
(arithmetic-weighted data) raised accuracy but *regressed* unsafe_enforced to
5/48 on the smaller suite — the safety/utility trade-off the multi-metric
table exists to catch; and a fresh-combined v7f ablation (93.9% accuracy,
unsafe_enforced 4/113) confirmed continue-training beats retraining from
scratch on the same corpus. Remaining v7 failures are reported per-scenario.

This is, to our knowledge, the first evaluation-and-repair loop that targets
*economic authorization* specifically: closest prior work
(AuthorizationBench, arXiv 2610.27548) benchmarks authorization alignment
eval-only, without spend stakes, a training intervention, or an audit trail.
Our artifacts — scenario suite, training data, LoRA adapter, per-scenario
episode logs, and metrics — are public on Hugging Face, and training
reproduces on free-tier and low-cost GPUs.

*(~540 words — trim ~40 for the form's abstract field.)*

## Write-up outline (HF Article / DEV.to)

1. **Problem** — enforcement-layer governance is necessary but not sufficient;
   the model is the last place a violation can be cheaply stopped. Cite CSA
   x402 note + Coinbase AgentKit spending policies as the chokepoint status quo.
2. **Related work** — AuthorizationBench (closest; differentiate on economic
   stakes + repair loop + audit trail), OR-Bench/ACTOR (over-refusal metric
   grounding), MCP/x402 runtime policy enforcement.
3. **Task & oracle** — mandate schema, four-way decision contract, deterministic
   oracle rules (precedence REFUSE > ESCALATE > ASK_CLARIFICATION > ALLOW;
   sequential per-item budget accounting; tax-inclusive totals).
4. **Pipeline** — AgentTune DECIDE workflow YAML; AuditKIT agent_eval recorded
   mode with `CustomPredicate` oracle; SFT data = oracle labels + RFT samples.
5. **Results** — full metric table (base → v4 → v6 → v7 → v7f) on the
   165-scenario suite v3: accuracy, unsafe_allow, unsafe_enforced, contract
   validity, over-refusal, escalation correctness, item-decision correctness,
   per-scenario diff. Include the honest negatives (v5 accuracy/safety
   trade-off, v6 safety regression, v7f comparison).
6. **Analysis** — what SFT fixed (authority claims, fabricated approvals,
   recurring commitments, arithmetic edge cases) vs. residual failures; why
   unsafe_enforced is the headline metric; the v6 lesson (data mix matters
   more than volume); limitations (single-turn decisions, no native tool
   calls on Aya, simulated rather than live-wallet spend, same-distribution
   eval).
7. **Reproducibility** — exact commands: `gen_v3.py`, `gen_training_data.py`,
   `sample_rft.py`, Kaggle kernel (`papajams/lexsi-train-eval`),
   `modal_v7.py` / `lexsi_v7_colab.py`, `run_baseline.py` /
   `rescore_auditkit.py`, `compare_metrics.py`.
8. **ROI note** (optional) — self-hosted 8B on Kaggle T4 vs. closed-API
   per-decision cost at volume.

## HF artifact plan (public, no credentials)

- **Dataset** `Papajams/lexsi-governance`: existing v4/v5/v6 files plus
  `v7/` — `eval_suite_v3.jsonl` (165 scenarios), `sft_v7.jsonl` (3,300 rows),
  `sft_v7_new.jsonl`, `dpo_seed_pairs.jsonl`, `manifest.json`, `gen_v3.py`,
  `results/` (bf16 metrics + per-scenario evals for base/v4/v7).
- **Model collection**: base `CohereLabs/aya-expanse-8b` ref +
  `aya-expanse-8b-lexsi-v7` (**submission artifact**) + `aya-expanse-8b-lexsi-v4`
  (previous best) + `aya-expanse-8b-lexsi-v6` (exploratory — unsafe_enforced
  regressed, warning on card).
- **Repo**: `lexsi/` scoped dir public in cognivern; README links artifacts +
  reproduction steps.

**Published:**
- Nov 8 (v4): dataset `Papajams/lexsi-governance`, adapter `aya-expanse-8b-lexsi-v4`
- Nov 15 (v6): `aya-expanse-8b-lexsi-v6` exploratory; `results70/` bf16 evals
- Nov 15 (v7): adapter `Papajams/aya-expanse-8b-lexsi-v7` (LoRA r=16, continued
  from v4); dataset `v7/` suite+training+results; added to model collection

## Go/no-go gates (deadline Nov 15, 11:59 PM AoE per the live Tally form)

- [x] Final adapter chosen on evidence: **v7** — v7f head-to-head complete
      (v7 unsafe_enforced 3/113 vs v7f 4/113; selection rule applied)
- [x] AuditKIT verified-outcome numbers in write-up (done — integration works)
- [x] Expanded held-out eval suite (**165 scenarios v3**, zero train overlap —
      verified by mandate+request hash over 4,022 training scenario bodies)
- [x] HF dataset + adapter **collections** created and populated publicly;
      v7 adapter published + added to model collection (Nov 15)
- [x] Abstract finalized with final numbers (this file — trim ~40 words)
- [~] Article: DEV.to draft exists (needs v7 numbers); HF blog not possible
      without PRO — DEV.to URL is the article field answer
- [x] v7f fresh-combined result — complete: 93.9% acc, unsafe_enforced 4/113;
      v7 retained as submission artifact (ablation negative, documented)
- [ ] Colab T4 4-bit v7 cross-check (running; informational only — bf16 is
      canonical)
- [ ] Serving path for live demo decided (only needed if shortlisted —
      Modal endpoint or recorded-demo fallback)
