"""Publish Lexsi v7 artifacts to Hugging Face.

CPU-only Modal functions (hf-token secret already configured):

  publish_v7_adapter — copies adapter_v7 off the lexsi-artifacts volume and
      pushes it as a PEFT adapter repo: Papajams/aya-expanse-8b-lexsi-v7
  publish_dataset_v7 — uploads suite v3 / sft_v7 / generator / dpo pairs and
      the Modal bf16 results into Papajams/lexsi-governance under v7/

Run:  modal run lexsi/modal_publish.py
"""

import modal

app = modal.App("lexsi-publish-v7")

STAGING_REPO = "papajams/lexsi-v6-staging"
DATASET_REPO = "Papajams/lexsi-governance"
MODEL_REPO = "Papajams/aya-expanse-8b-lexsi-v7"
ART = "/artifacts"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("huggingface_hub")
    .add_local_dir("colab/staging_v7", "/data/staging_v7", copy=True)
    .add_local_file("scripts/gen_v3.py", "/data/gen_v3.py", copy=True)
)

hf_secret = modal.Secret.from_name("hf-token")
volume = modal.Volume.from_name("lexsi-artifacts", create_if_missing=True)

MODEL_CARD = """---
base_model: CohereLabs/aya-expanse-8b
library_name: peft
tags: [lexsi, governance, spend-mandate, lora, safetensors]
---

# aya-expanse-8b-lexsi-v7

LoRA adapter (r=16) for governed-spend decision-making, continued from
[`aya-expanse-8b-lexsi-v4`](https://huggingface.co/Papajams/aya-expanse-8b-lexsi-v4)
on the balanced v7 SFT set (3,300 rows: replay + oracle + paraphrase-augmented).

Task: given a spend mandate + purchase request, emit ALLOW / REFUSE /
ESCALATE / ASK_CLARIFICATION with per-item decisions and a checks contract.

## Held-out results (165-scenario suite v3, bf16, greedy)

| model | accuracy | unsafe_enforced | contract_valid |
|---|---|---|---|
| base (aya-expanse-8b) | 55.2% | 50/113 | 165/165 |
| lexsi-v4 | 68.5% | 23/113 | 165/165 |
| **lexsi-v7** | **95.8%** | **3/113** | **165/165** |

`unsafe_enforced` = contract-valid ALLOW where policy requires
REFUSE/ESCALATE/ASK_CLARIFICATION — the decisions that would reach the wallet.

Eval suite v3: 165 held-out scenarios (22 hand-authored + 48 generated +
55 new adversarial kinds + 40 paraphrase-robustness), zero train overlap
(verified by mandate+request hash). Training data and full per-scenario
evals: [`Papajams/lexsi-governance`](https://huggingface.co/datasets/Papajams/lexsi-governance).

Part of the [Lexsi governed agent-spend models](https://huggingface.co/collections/Papajams/lexsi-governed-agent-spend-models)
collection. Trained with AgentTune DECIDE + AuditKIT verified-outcome scoring.
"""


@app.function(image=image, secrets=[hf_secret], volumes={ART: volume}, timeout=30 * 60)
def publish_v7_adapter() -> str:
    import os
    from pathlib import Path

    from huggingface_hub import HfApi

    HF_TOKEN = ""
    for k, v in os.environ.items():
        if "HF" in k.upper() and "TOKEN" in k.upper():
            HF_TOKEN = v
            break
    assert HF_TOKEN, "no HF token in env"

    src = Path(ART) / "v7-out" / "adapter_v7"
    files = sorted(p.name for p in src.iterdir() if p.is_file())
    print("adapter files:", files, flush=True)

    api = HfApi(token=HF_TOKEN)
    api.create_repo(MODEL_REPO, repo_type="model", exist_ok=True)

    card = Path("/tmp/model_card.md")
    card.write_text(MODEL_CARD)

    api.upload_folder(
        folder_path=str(src),
        path_in_repo=".",
        repo_id=MODEL_REPO,
        repo_type="model",
    )
    api.upload_file(
        path_or_fileobj=str(card),
        path_in_repo="README.md",
        repo_id=MODEL_REPO,
        repo_type="model",
    )
    print(f"published {MODEL_REPO}", flush=True)
    return MODEL_REPO


@app.function(image=image, secrets=[hf_secret], volumes={ART: volume}, timeout=60 * 60)
def publish_dataset_v7() -> str:
    import os
    from pathlib import Path

    from huggingface_hub import HfApi

    HF_TOKEN = ""
    for k, v in os.environ.items():
        if "HF" in k.upper() and "TOKEN" in k.upper():
            HF_TOKEN = v
            break
    assert HF_TOKEN, "no HF token in env"

    api = HfApi(token=HF_TOKEN)
    api.create_repo(DATASET_REPO, repo_type="dataset", exist_ok=True)

    local = Path("/data/staging_v7")
    for name in [
        "eval_suite_v3.jsonl",
        "sft_v7.jsonl",
        "sft_v7_new.jsonl",
        "dpo_seed_pairs.jsonl",
        "manifest.json",
    ]:
        api.upload_file(
            path_or_fileobj=str(local / name),
            path_in_repo=f"v7/{name}",
            repo_id=DATASET_REPO,
            repo_type="dataset",
        )
        print(f"uploaded v7/{name}", flush=True)

    api.upload_file(
        path_or_fileobj="/data/gen_v3.py",
        path_in_repo="v7/gen_v3.py",
        repo_id=DATASET_REPO,
        repo_type="dataset",
    )

    # results from the Modal run: metrics + per-scenario evals for base/v4/v7
    res = Path(ART) / "v7-out"
    for p in sorted(res.iterdir()):
        if p.name.startswith(("metrics_", "eval_")) and p.is_file():
            api.upload_file(
                path_or_fileobj=str(p),
                path_in_repo=f"v7/results/{p.name}",
                repo_id=DATASET_REPO,
                repo_type="dataset",
            )
            print(f"uploaded v7/results/{p.name}", flush=True)

    print(f"dataset {DATASET_REPO} updated", flush=True)
    return DATASET_REPO


@app.local_entrypoint()
def main() -> None:
    print(publish_v7_adapter.remote())
    print(publish_dataset_v7.remote())
