# lexsi/ — governed agent-spend decision eval + repair loop

Lexsi AI Safety & Alignment Hackathon, Track 3 (Agentic Fine-tuning:
AgentTune + AuditKIT). Question: can a small open-weights model
(`CohereLabs/aya-expanse-8b` + LoRA) internalize a spend mandate so that
policy violations are refused before they reach wallet-layer enforcement?

- Write-up: <https://dev.to/papajams/can-a-small-open-weights-model-learn-to-enforce-its-own-spending-mandate-4ln3>
  (source: [`HF_ARTICLE.md`](HF_ARTICLE.md))
- Submission adapter: [`Papajams/aya-expanse-8b-lexsi-v7`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v7)
- Data, eval suite, per-scenario logs, AuditKIT scores:
  [`Papajams/lexsi-governance`](https://huggingface.co/datasets/Papajams/lexsi-governance)
- Experiment log: [`docs/history/LEXSI_HACKATHON.md`](../docs/history/LEXSI_HACKATHON.md) ·
  submission draft: [`SUBMISSION.md`](SUBMISSION.md)

Everything in this directory was built during the hackathon; it reuses
Cognivern's mandate/policy vocabulary but not its runtime.

## Results (165-scenario suite v3, bf16, greedy)

| metric | base | v4 | **v7 (submission)** | v7f (ablation) |
|---|---|---|---|---|
| accuracy | 91/165 | 113/165 | **158/165** | 155/165 |
| unsafe enforced (113 non-`ALLOW` scenarios) | 50 | 23 | **3** | 4 |
| unsafe allows incl. partial-order case `gov-10` (114) | 50 | 23 | **4** | 5 |
| contract valid | 165/165 | 165/165 | 165/165 | 165/165 |

Caveats that matter: the suite is held out by scenario body but shares the
training generator's template family, and the 17 new adversarial kinds entered
eval and training together — so this measures transfer to unseen instances
and paraphrases, not unseen kinds. On the 22 hand-authored scenarios v7 is
more accurate than v4 but not safer (unsafe allows 6 → 2 → 3). See the
write-up for the per-subset table.

## Layout

| path | what |
|---|---|
| `workflows/spend_governance.yaml`, `config.yaml` | AgentTune DECIDE workflow: the decision episode, prompt and output contract |
| `tasks/governance_scenarios.jsonl` | 22 hand-authored eval scenarios |
| `scripts/gen_training_data.py` | deterministic policy oracle + scenario/label generator |
| `scripts/gen_v3.py` | suite v3 (165 scenarios) and the v7 training set, with body-hash dedup |
| `scripts/sample_rft.py` | rejection-samples correct completions from a served model |
| `scripts/run_baseline.py` | runs the DECIDE workflow against an endpoint and scores episodes with AuditKIT `agent_eval` |
| `scripts/rescore_auditkit.py` | AuditKIT recorded-mode rescoring of saved eval logs |
| `scripts/compare_metrics.py` | per-scenario diff between two runs |
| `scripts/kaggle_train_eval.py` | self-contained Kaggle T4×2 train + eval (v4/v5) |
| `modal_v6.py`, `modal_v7.py`, `modal_v7f.py` | bf16 Modal L40S train + eval for v6, v7 and the v7f from-scratch ablation |
| `colab/` | Colab T4 4-bit variants and staged data (`staging_v7/` = suite v3 + sft_v7) |
| `modal_publish.py`, `modal_collection.py` | Hugging Face publishing |
| `swarm/` | separate multi-agent experiment, not part of this submission |

## Reproduce

```bash
# data: suite v3 + v7 training set (writes colab/staging_v7/)
python scripts/gen_v3.py

# train v7 from v4 and evaluate base/v4/v7 on suite v3 (needs Modal + HF token)
modal run modal_v7.py
modal run modal_v7f.py        # from-scratch ablation

# AuditKIT verified-outcome scores for a saved eval log
.venv/bin/python scripts/rescore_auditkit.py \
  --eval <eval_v7.jsonl> --tasks colab/staging_v7/eval_suite_v3.jsonl \
  --out <auditkit_v7.json>
```

The 165-scenario runs do batch inference in the Modal scripts' own harness,
which uses the DECIDE workflow's prompt template and decision contract; the
saved episodes are then scored with AuditKIT. `v7/dpo_seed_pairs.jsonl` in the
dataset is built from eval-suite failures and was not used for training.
