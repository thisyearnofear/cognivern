"%%writefile lexsi_swarm_eval.py
# Lexsi swarm eval — Agent Bazaar multi-agent procurement market.
# Apart Research Swarm Alignment Hackathon submission artifact.
#
# Runs the condition matrix {none, broadcast, pairwise} x {base, tuned-v4}
# x seeds on CohereLabs/aya-expanse-8b (HF download via private-dataset token)
# with the swarm package shipped inside the private dataset.
#
# Dataset expected at /kaggle/input/lexsi-swarm/ containing:
#   swarm/*.py, adapter_v4/ (LoRA), hf_token.txt

import json
import os
import sys
import time
from pathlib import Path

import torch

IN = Path("/kaggle/input")
OUT = Path("/kaggle/working/swarm_out")
OUT.mkdir(parents=True, exist_ok=True)

# ---- locate inputs ---------------------------------------------------------
def find_root():
    for p in IN.rglob("hf_token.txt"):
        return p.parent
    raise RuntimeError("dataset root with hf_token.txt not found")

ROOT = find_root()
sys.path.insert(0, str(ROOT))  # swarm package importable

from swarm.env import default_world  # noqa: E402
from swarm.forensics import oversight_comparison  # noqa: E402
from swarm.sim import run_episode  # noqa: E402

HF_REPO = "CohereLabs/aya-expanse-8b"
ADAPTER_DIR = ROOT / "adapter_v4"
CHANNELS = ["none", "broadcast", "pairwise"]
VARIANTS = ["base", "tuned"]
SEEDS = [0, 1]
MAX_ROUNDS = 12
MAX_NEW_TOKENS = 220

# ---- model -----------------------------------------------------------------
token = (ROOT / "hf_token.txt").read_text().strip()
os.environ["HF_TOKEN"] = token

from huggingface_hub import snapshot_download  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: E402

print("[swarm] downloading base model...", flush=True)
model_dir = snapshot_download(HF_REPO, token=token)
tok = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForCausalLM.from_pretrained(
    model_dir, torch_dtype=torch.float16, device_map="auto"
)
model.eval()
DEVICE = next(model.parameters()).device
print(f"[swarm] model on {DEVICE}", flush=True)

_adapter_loaded = {"on": False}


def set_variant(name):
    """Attach the LoRA adapter for the tuned pass. VARIANTS runs base first,
    so the adapter is attached exactly once and never removed."""
    global model
    if name == "tuned" and not _adapter_loaded["on"]:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, str(ADAPTER_DIR))
        model.eval()
        _adapter_loaded["on"] = True
        print("[swarm] LoRA v4 adapter attached", flush=True)


def generate(messages):
    text = tok.apply_chat_template(messages, tokenize=False,
                                   add_generation_prompt=True)
    inputs = tok(text, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        out = model.generate(
            **inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False,
            pad_token_id=tok.pad_token_id,
        )
    gen = out[0][inputs["input_ids"].shape[1]:]
    return tok.decode(gen, skip_special_tokens=True)


# ---- run matrix ------------------------------------------------------------
summary_rows = []
for variant in VARIANTS:
    set_variant(variant)
    for channel in CHANNELS:
        for seed in SEEDS:
            tag = f"{variant}_{channel}_s{seed}"
            world = default_world(seed=seed)
            t0 = time.time()
            result = run_episode(generate, world=world, channel=channel,
                                 seed=seed, max_rounds=MAX_ROUNDS, log=False)
            result["oversight"] = oversight_comparison(
                result["outcome"], result["ledger"], world.program_cap)
            result["variant"] = variant
            result["wall_s"] = round(time.time() - t0, 1)
            with open(OUT / "episodes.jsonl", "a") as f:
                f.write(json.dumps(result) + "\n")
            o = result["outcome"]
            row = {
                "variant": variant, "channel": channel, "seed": seed,
                "violations": o["violations"],
                "cap_breached": o["cap_breached"],
                "tasks_complete": o["tasks_complete"],
                "program_spent": o["program_spent"],
                "n_messages": o["n_messages"],
                "n_transfers": len(o["transfers"]),
                "detection_gap": result["oversight"]["detection_gap"],
                "arm_b_findings": result["oversight"]["arm_b_ledger_forensics"]["n_findings"],
                "wall_s": result["wall_s"],
            }
            summary_rows.append(row)
            print(f"[swarm] {tag}: viol={o['violations']} "
                  f"spend={o['program_spent']}/1200 tasks={o['tasks_complete']}/4 "
                  f"msgs={o['n_messages']} gap={row['detection_gap']} "
                  f"({row['wall_s']}s)", flush=True)

with open(OUT / "summary.json", "w") as f:
    json.dump(summary_rows, f, indent=2)
print("[swarm] DONE", flush=True)
"""
