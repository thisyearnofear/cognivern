"""Modal app: SFT aya-expanse-8b on the governance decision dataset (LoRA).

Run:
    modal run lexsi/modal_train.py

Artifacts land on the `lexsi-artifacts` volume:
    /artifacts/aya-expanse-8b-lexsi/   merged bf16 model (serve this)
    /artifacts/adapter/                raw LoRA adapter (audit/provenance)

The merged model is what modal_serve.py should point MODEL at for the
post-repair eval (set LEXSI_MERGED=1 or edit MODEL).
"""

import modal

app = modal.App("lexsi-train")

MODEL = "CohereLabs/aya-expanse-8b"
ART = "/artifacts"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install(
        "torch==2.9.1",
        "transformers>=5.0",
        "trl>=0.19",
        "peft>=0.17",
        "accelerate>=1.7",
        "datasets>=4.0",
        "sentencepiece",
        "protobuf",
    )
    .add_local_file(
        "data/sft_v4.jsonl", "/data/sft_train.jsonl", copy=True
    )
)

hf_secret = modal.Secret.from_name("hf-token")
volume = modal.Volume.from_name("lexsi-artifacts", create_if_missing=True)


@app.function(
    image=image,
    gpu="L40S",
    secrets=[hf_secret],
    volumes={ART: volume},
    timeout=4 * 60 * 60,
)
def train() -> str:
    import json

    from datasets import load_dataset
    from peft import LoraConfig
    from torch.utils.data import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    tok = AutoTokenizer.from_pretrained(MODEL)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL, torch_dtype="bfloat16", attn_implementation="sdpa"
    )
    model.config.use_cache = False

    ds = load_dataset("json", data_files="/data/sft_train.jsonl", split="train")

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
    )

    cfg = SFTConfig(
        output_dir=f"{ART}/ckpt",
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        num_train_epochs=2,
        learning_rate=1e-4,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="no",
        bf16=True,
        max_length=4096,
        dataset_num_proc=4,
        report_to=[],
        seed=7,
    )

    trainer = SFTTrainer(
        model=model,
        args=cfg,
        train_dataset=ds,
        peft_config=lora,
    )
    trainer.train()

    adapter_dir = f"{ART}/adapter-v4"
    trainer.model.save_pretrained(adapter_dir)
    tok.save_pretrained(adapter_dir)

    merged_dir = f"{ART}/aya-expanse-8b-lexsi-v4"
    merged = trainer.model.merge_and_unload()
    merged.save_pretrained(merged_dir, safe_serialization=True)
    tok.save_pretrained(merged_dir)

    volume.commit()
    return merged_dir


@app.local_entrypoint()
def main() -> None:
    print(train.remote())
