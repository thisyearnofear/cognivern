# Lexsi submission draft — cognivern spend-governance

Track: **3 — Agentic Fine-tuning** (AgentTune + AuditKIT spine).
Problem statement: **#7 — business workflow and decision agents with a full audit trail**.
Model: `CohereLabs/aya-expanse-8b` (permitted Cohere open weights) + LoRA adapter.
Status: FINAL — **v7 adapter is the submission artifact** (`Papajams/aya-expanse-8b-lexsi-v7`). Head-to-head complete: v7 (continue-train) unsafe_enforced 3/113 vs v7f (fresh-combined) 4/113 — v7 kept on the selection rule (lower unsafe_enforced, tie → accuracy); the one-scenario gap is within noise. Counting the partial-order scenario `gov-10`, which the `unsafe_enforced` denominator excludes, v7 is 4/114 and v7f 5/114. Canonical numbers are the bf16 165-scenario suite v3 (Modal L40S, consistent harness).

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
substrate. Each episode presents a spend mandate and a purchase request and
requires a structured four-way decision — `ALLOW`, `REFUSE`, `ESCALATE`, or
`ASK_CLARIFICATION` — with per-item decisions for multi-line orders. Ground
truth comes from a deterministic policy oracle never shown to the model. The
evaluation suite has **165 held-out scenarios**: 22 hand-authored, 48
generated, 55 across 17 new adversarial kinds (vendor spoofing, foreign
currency, quantity math, distractor clauses, boundary budgets), and 40
paraphrase variants. No evaluation scenario appears in any training file
(mandate+request hash over 4,022 training bodies).

The pipeline chains the track stack. An **AgentTune** DECIDE workflow defines
and runs the governed decision episode; **AuditKIT** `agent_eval` scores every
saved episode as a verified outcome in recorded mode, with contract validity,
unsafe enforcement, and over-refusal kept as separate diagnostics. Failure
traces feed a repair dataset — oracle-labeled examples plus rejection-sampled
completions from the model's own correct outputs — and LoRA SFT (rank 16)
repairs `aya-expanse-8b`.

On the 165-scenario suite (bf16, greedy, identical harness), the base model
emits a contract-valid but policy-wrong `ALLOW` on 50 of 113 must-not-allow
cases (44.3%). The v4 adapter cut that to 23/113 (20.4%). The v7 adapter — v4
continued on a balanced 3,300-row repair set — reaches **3/113 (2.7%)**, or
4/114 (3.5%) counting one partial-order scenario the metric's denominator
excludes, while accuracy rises from 55.2% to **95.8%** and contract validity
stays at 100%.

We report what limits that result. The gain over v4 is concentrated on
generator-family scenarios: the new adversarial kinds entered the evaluation
suite and the training generator together, so the suite measures transfer to
unseen instances and paraphrases, not to unseen kinds. On the 22 hand-authored
scenarios, unsafe allows fall 6 → 3 from base, but v7 is no safer than v4
(2 → 3). Two negatives shaped the artifact: v6 (arithmetic-weighted data)
raised accuracy while *regressing* unsafe enforcement, the trade-off the
multi-metric table exists to catch; and a from-scratch ablation (v7f, 4/113)
was within noise of v7, so we claim only that retraining did not help. Spend
is simulated and decisions are single-turn.

To our knowledge this is the first evaluation-and-repair loop targeting
*economic authorization* specifically; the closest prior work,
AuthorizationBench (arXiv 2610.27548), is evaluation-only and not
spend-specific. The scenario suite, training data, adapters, per-scenario
logs, and AuditKIT scores are public on Hugging Face.

*(482 words.)*

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
- [x] Abstract finalized with final numbers (this file — 482 words, under the 500 limit)
- [x] Article: **published on DEV.to** —
      https://dev.to/papajams/can-a-small-open-weights-model-learn-to-enforce-its-own-spending-mandate-4ln3
      (cover image + results chart; HF blog not possible without PRO —
      DEV.to URL is the article field answer)
- [x] v7f fresh-combined result — complete: 93.9% acc, unsafe_enforced 4/113;
      v7 retained as submission artifact (ablation negative, documented)
- [x] Pre-submission audit (Nov 15): AuditKIT recorded-mode rescoring of the
      165-scenario logs published (`v7/results/auditkit_*.json`; verified
      outcome 91/113/158/155 = harness accuracy); v7f logs published; per-subset
      table + `gov-10` accounting + generator-family caveat added to article,
      abstract, dataset and model cards; collections and `lexsi/README.md`
      updated; `dpo_seed_pairs.jsonl` labelled eval-derived / unused
- [ ] Colab T4 4-bit v7 cross-check (running; informational only — bf16 is
      canonical)
- [ ] Serving path for live demo decided (only needed if shortlisted —
      Modal endpoint or recorded-demo fallback)
