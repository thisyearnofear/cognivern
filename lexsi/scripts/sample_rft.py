"""Rejection-sampling SFT data: sample k completions per training scenario
from the served model, keep only strict-JSON outputs whose decision matches
the oracle. Writes data/sft_rft.jsonl in the same messages format as
sft_train.jsonl.

Env: LEXSI_MODEL_ENDPOINT, LEXSI_SERVED_MODEL, LEXSI_API_KEY (optional).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

LEXSI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(LEXSI_DIR / "scripts"))

import litellm  # noqa: E402

from gen_training_data import oracle, scenario_prompt  # noqa: E402
from run_baseline import classify  # noqa: E402


def parse_completion(text: str) -> dict | None:
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    raw = m.group(1) if m else text
    try:
        obj = json.loads(raw.strip())
    except Exception:
        return None
    if isinstance(obj, dict) and obj.get("decision") and isinstance(obj.get("checks"), dict):
        return obj
    return None


async def sample_one(
    endpoint_model: str, prompt: str, sem: asyncio.Semaphore, api_base: str, api_key: str
) -> str | None:
    async with sem:
        for _ in range(2):
            try:
                resp = await litellm.acompletion(
                    model=endpoint_model,
                    api_base=api_base,
                    api_key=api_key,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.8,
                    max_tokens=700,
                )
                return resp.choices[0].message.content or ""
            except Exception:
                await asyncio.sleep(2)
    return None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenarios", default=str(LEXSI_DIR / "tasks" / "train_scenarios.jsonl"))
    ap.add_argument("--out", default=str(LEXSI_DIR / "data" / "sft_rft.jsonl"))
    ap.add_argument("--k", type=int, default=6)
    ap.add_argument("--keep", type=int, default=3)
    ap.add_argument("--concurrency", type=int, default=16)
    args = ap.parse_args()

    endpoint = os.environ["LEXSI_MODEL_ENDPOINT"]
    served = os.environ.get("LEXSI_SERVED_MODEL", "aya-expanse-8b")
    api_key = os.environ.get("LEXSI_API_KEY", "none")

    scenarios = [json.loads(l) for l in open(args.scenarios) if l.strip()]
    sem = asyncio.Semaphore(args.concurrency)
    kept = 0
    total_correct = 0

    async def process(sc: dict) -> list[dict]:
        prompt = scenario_prompt(sc)
        expected = sc["expected"]
        texts = await asyncio.gather(
            *(sample_one(f"openai/{served}", prompt, sem, endpoint, api_key) for _ in range(args.k))
        )
        rows = []
        seen = set()
        for text in texts:
            if not text:
                continue
            obj = parse_completion(text)
            if obj is None:
                continue
            decision = str(obj.get("decision", "")).upper()
            ids = obj.get("item_decisions")
            if classify(decision, expected, ids) != "correct":
                continue
            canon = json.dumps(obj, sort_keys=True)
            if canon in seen:
                continue
            seen.add(canon)
            rows.append(
                {
                    "messages": [
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": json.dumps(obj, indent=2)},
                    ]
                }
            )
            if len(rows) >= args.keep:
                break
        return rows

    with open(args.out, "w") as f:
        for i, sc in enumerate(scenarios):
            rows = await process(sc)
            total_correct += len(rows)
            for r in rows:
                f.write(json.dumps(r) + "\n")
                kept += 1
            if (i + 1) % 50 == 0:
                print(f"[{i+1}/{len(scenarios)}] kept={kept}", flush=True)

    print(f"done: {kept} RFT pairs from {len(scenarios)} scenarios -> {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
