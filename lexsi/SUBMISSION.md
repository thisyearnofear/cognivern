# Lexsi submission draft — cognivern spend-governance

Track: **3 — Agentic Fine-tuning** (AgentTune + AuditKIT spine).
Problem statement: **#7 — business workflow and decision agents with a full audit trail**.
Model: `CohereLabs/aya-expanse-8b` (permitted Cohere open weights) + LoRA adapter.
Status: FINAL CANDIDATE — v6 experiment complete (honest negative); **v4 adapter is the submission artifact**. Canonical numbers are the bf16 70-scenario suite (Modal L40S, consistent harness).

## Abstract (<500 words)

**Can a small open-weights model learn to enforce its own spending mandate?**

Enterprise agents increasingly hold economic authority — budgets, vendor
allowlists, category restrictions — yet governance today lives almost entirely
at the enforcement chokepoint (wallet policies, payment rails). If the model
itself cannot tell an authorized purchase from a policy violation, every
malformed or manipulated decision becomes a enforcement-layer incident. We ask
whether agentic fine-tuning can internalize mandate-following *before* actions
reach the wallet, and whether the improvement is measurable as a reduction in
violations that would otherwise have been enforced.

We build a governed-spend decision task on Cognivern's mandate/policy/evidence
substrate. Each episode presents the model with a spend mandate (budget,
allowlisted vendors, blocked categories, approval thresholds) and a purchase
request, and requires a structured four-way decision — `ALLOW`, `REFUSE`,
`ESCALATE`, or `ASK_CLARIFICATION` — with per-item decisions for multi-line
orders. The evaluation suite contains 70 held-out scenarios: 22 hand-authored
cases covering clean allows, budget overruns, non-allowlist vendors, blocked
categories, purchase-splitting, gift cards, tax-inclusive totals, recurring
commitments, mid-trajectory scope creep, and adversarial pressure (urgency,
claimed authority, fabricated approvals, "just this once"), plus 48 generated
held-out scenarios with deterministic oracle labels. No evaluation scenario
appears in any training file. Ground truth is computed by a deterministic
policy oracle and never shown to the model; raw responses are preserved for
audit.

The pipeline follows the hackathon stack end to end. **AgentTune** DECIDE
workflows execute each scenario as a governed decision episode and emit the
event log; **AuditKIT** `agent_eval` scores every episode with a verified-outcome
oracle (did the agent reach the policy-correct decision), keeping contract
validity, unsafe-enforcement, and over-refusal as separate diagnostics rather
than collapsing them into one accuracy number. Failure traces feed a repair
dataset — deterministic oracle-labeled examples plus rejection-sampled
completions from the model's own correct outputs — and **AgentTune**-compatible
LoRA SFT (rank 16) repairs `aya-expanse-8b`.

On the held-out 70-scenario suite (bf16, greedy decode, identical harness),
the base model emits a contract-valid but policy-wrong `ALLOW` on 17 of 48
must-not-allow cases — violations that would have reached enforcement (35.4%).
After LoRA fine-tuning, unsafe enforced decisions fall to 2 of 48 (4.2%), an
88% reduction, while contract validity stays at 100% and accuracy rises from
58.6% to 78.6%. On the original 22-scenario suite the same adapter cuts unsafe
enforced from 6 to 2. A second iteration — v6, trained on the v4 data plus 600
targeted arithmetic examples — raised accuracy to 80.0% but *regressed*
unsafe_enforced to 5/48: the arithmetic-weighted data diluted judgment-heavy
refusals (scope creep, recurring commitments). We report this negative result
because it is exactly what the multi-metric table exists to catch, and it is
why v4 — not the newer checkpoint — is the submitted adapter. The remaining v4
failures are budget-arithmetic edge cases (combined multi-item totals and
tax-inclusive estimates) plus a small number of escalation-vs-refusal boundary
calls, all reported per-scenario.

This is, to our knowledge, the first evaluation-and-repair loop that targets
*economic authorization* specifically: closest prior work
(AuthorizationBench, arXiv 2610.27548) benchmarks authorization alignment
eval-only, without spend stakes, a training intervention, or an audit trail.
Our artifacts — scenario suite, training data, LoRA adapter, per-scenario
episode logs, and metrics — are public on Hugging Face, and training
reproduces on free-tier GPUs (Kaggle T4×2 for v4; Modal L40S for v6).

*(~470 words — trim for the form's abstract field.)*

## Write-up outline (HF Article / README fallback)

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
5. **Results** — full metric table (v4 → v5 → v6) on both the 22- and
   70-scenario suites: accuracy, unsafe_allow, unsafe_enforced, contract
   validity, over-refusal, escalation correctness, item-decision correctness,
   per-scenario diff. Include the honest negatives (v5 accuracy/safety
   trade-off, v6 safety regression, remaining arithmetic holes, gov-22
   over-refusal in v4).
6. **Analysis** — what SFT fixed (authority claims, fabricated approvals,
   recurring commitments) vs. what it didn't (multi-item arithmetic); why
   unsafe_enforced is the headline metric; limitations (single-turn decisions,
   no native tool calls on Aya, simulated rather than live-wallet spend).
7. **Reproducibility** — exact commands: `gen_training_data.py`,
   `sample_rft.py`, Kaggle kernel (`papajams/lexsi-train-eval`),
   `run_baseline.py` / `rescore_auditkit.py`, `compare_metrics.py`.
8. **ROI note** (optional) — self-hosted 8B on Kaggle T4 vs. closed-API
   per-decision cost at volume.

## HF artifact plan (public, no credentials)

- **Dataset collection** `lexsi-governance`: `governance_scenarios.jsonl`
  (22-scenario eval), `eval_suite_v2.jsonl` (70-scenario eval), `sft_v4.jsonl`,
  `sft_arith.jsonl`, `results/*/results.jsonl` + `auditkit.json` episode logs,
  `summary.json`, v6 metrics/eval JSONLs (from `lexsi-v6-staging/out/`).
  Exclude: `kaggle/` staging, `hf_token.txt`, anything under `lexsi/kaggle/`.
- **Model collection**: base `CohereLabs/aya-expanse-8b` ref + LoRA adapter
  `aya-expanse-8b-lexsi-v4` (submission artifact). Optionally include
  `aya-expanse-8b-lexsi-v6` labeled "exploratory — unsafe_enforced regressed"
  for transparency; adapter-only is lighter (~170–180MB) and honest about
  what we trained.
- **Repo**: `lexsi/` scoped dir already public in cognivern; README section
  links artifacts + reproduction steps.

**Published Nov 8 (v4 artifacts):**
- Dataset: https://huggingface.co/datasets/Papajams/lexsi-governance (10 files — scenarios, sft_v4, eval JSONLs, metrics, auditkit JSONs)
- Adapter: https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v4 (LoRA r=16 + cards)
- Staging dirs `lexsi/hf_public/` are gitignored; re-stage + re-upload when v5 lands.

## Go/no-go gates (deadline Nov 15, 11:59 PM AoE per the live Tally form)

- [x] Final adapter chosen on evidence: **v4** (unsafe_enforced 2/48 bf16-70;
      v5 and v6 both regressed the headline metric)
- [x] AuditKIT verified-outcome numbers in write-up (done — integration works)
- [x] Expanded held-out eval suite (70 scenarios, zero train overlap)
- [ ] HF dataset + adapter **collections** created and populated publicly
      (repos exist; collections + v6-suite data files still to add)
- [x] Abstract finalized with final numbers (this file)
- [ ] HF write-up/article drafted and published (write-up outline below is the draft)
- [ ] Serving path for live demo decided (only needed if shortlisted —
      Modal endpoint or recorded-demo fallback)
