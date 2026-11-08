# Lexsi submission draft — cognivern spend-governance

Track: **3 — Agentic Fine-tuning** (AgentTune + AuditKIT spine).
Problem statement: **#7 — business workflow and decision agents with a full audit trail**.
Model: `CohereLabs/aya-expanse-8b` (permitted Cohere open weights) + LoRA adapter.
Status: DRAFT — v5 metrics pending; numbers below are v4 (locked) unless noted.

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
orders. The evaluation suite contains 22 hand-authored scenarios covering clean
allows, budget overruns, non-allowlist vendors, blocked categories,
purchase-splitting, gift cards, tax-inclusive totals, recurring commitments,
mid-trajectory scope creep, and adversarial pressure (urgency, claimed
authority, fabricated approvals, "just this once"). Ground truth is computed by
a deterministic policy oracle and never shown to the model; raw responses are
preserved for audit.

The pipeline follows the hackathon stack end to end. **AgentTune** DECIDE
workflows execute each scenario as a governed decision episode and emit the
event log; **AuditKIT** `agent_eval` scores every episode with a verified-outcome
oracle (did the agent reach the policy-correct decision), keeping contract
validity, unsafe-enforcement, and over-refusal as separate diagnostics rather
than collapsing them into one accuracy number. Failure traces feed a repair
dataset — deterministic oracle-labeled examples plus rejection-sampled
completions from the model's own correct outputs — and **AgentTune**-compatible
LoRA SFT (rank 16) repairs `aya-expanse-8b`.

On the held-out 22-scenario suite, the base model emits a contract-valid but
policy-wrong `ALLOW` on 6 of 17 must-not-allow cases — violations that would
have reached enforcement (35.3%). After fine-tuning, unsafe enforced decisions
fall to 2 of 17 (11.8%), a 66% reduction, while contract validity stays at
100% and aggregate accuracy is unchanged (59.1%). AuditKIT verified-outcome
scoring confirms the same before/after on identical harness runs. The two
remaining failures are budget-arithmetic edge cases (combined multi-item totals
and tax-inclusive estimates), which we report honestly along with measured
over-refusals — the "refuse everything" degenerate solution does not survive
our metric table.

This is, to our knowledge, the first evaluation-and-repair loop that targets
*economic authorization* specifically: closest prior work
(AuthorizationBench, arXiv 2610.27548) benchmarks authorization alignment
eval-only, without spend stakes, a training intervention, or an audit trail.
Our artifacts — scenario suite, training data, LoRA adapter, per-scenario
episode logs, and metrics — are public on Hugging Face, and the pipeline
reproduces on free Kaggle T4 GPUs.

*(~430 words — trim/adjust once v5 numbers land.)*

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
5. **Results** — full metric table (v3 → v4 → v5 if it lands): accuracy,
   unsafe_allow, unsafe_enforced, contract validity, over-refusal,
   escalation correctness, item-decision correctness, per-scenario diff.
   Include the honest negatives (flat accuracy, remaining arithmetic holes,
   gov-22 over-refusal).
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
  (eval, ground truth included — it's the benchmark), `sft_v5.jsonl` (or v4),
  `results/*/results.jsonl` + `auditkit.json` episode logs, `summary.json`.
  Exclude: `kaggle/` staging, `hf_token.txt`, anything under `lexsi/kaggle/`.
- **Model collection**: base `CohereLabs/aya-expanse-8b` ref + LoRA adapter
  upload (`aya-expanse-8b-lexsi-vN`) — adapter-only is lighter (181MB) and
  honest about what we trained; merge only if judges need a single repo.
- **Repo**: `lexsi/` scoped dir already public in cognivern; README section
  links artifacts + reproduction steps.

## Go/no-go gates (deadline Nov 14 AoE)

- [ ] v5 metrics downloaded; unsafe_enforced ≤ v4 (ideally 0–1)
- [ ] AuditKIT verified-outcome numbers in write-up (done — integration works)
- [ ] HF dataset + adapter published publicly
- [ ] Abstract finalized with final numbers
- [ ] Serving path for live demo decided (Modal limit vs HF endpoint vs
      recorded-demo fallback)
