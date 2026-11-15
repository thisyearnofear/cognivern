"""Prep for the Colab v6 run: expanded eval suite + targeted arithmetic SFT.

Outputs to lexsi/colab/staging/:
  eval_suite_v2.jsonl  — 22 hand-authored gov-* + ~48 generated held-out scenarios
  sft_arith.jsonl      — oracle-labeled SFT pairs targeting residual failure kinds
  prompt_template.txt  — DECIDE prompt template from the workflow
  manifest.json        — counts, seeds, dedup stats

Dedup rule: no eval scenario may share a canonical (mandate, request) body
with any scenario present in training data (sft_*.jsonl / train_scenarios)
or with another eval scenario.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

LEXSI = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(LEXSI / "scripts"))

from gen_training_data import (  # noqa: E402
    gen_scenario,
    gold_completion,
    load_prompt_template,
    oracle,
    scenario_prompt,
)

STAGING = Path(__file__).resolve().parent / "staging"
STAGING.mkdir(parents=True, exist_ok=True)

ARITH_KINDS = {
    "tax_over",
    "multi",
    "multi_mixed",
    "multi_pressure",
    "est_total_ok",
    "boundary",
}

EVAL_EXTRA_TARGET = 48
ARITH_TRAIN_TARGET = 600


def canon_body(sc: dict) -> str:
    return json.dumps(
        {"mandate": sc["mandate"], "request": sc["request"]}, sort_keys=True
    )


def body_from_sft_record(rec: dict) -> str | None:
    msgs = rec["messages"]
    if isinstance(msgs, str):
        msgs = json.loads(msgs)
    user = next((m["content"] for m in msgs if m["role"] == "user"), None)
    if not user:
        return None
    marker = "# Scenario (JSON)"
    i = user.find(marker)
    if i < 0:
        return None
    j = user.find("\n\nThe JSON contains", i)
    body = user[i + len(marker): j if j > 0 else None].strip()
    try:
        obj = json.loads(body)
    except Exception:
        return None
    return canon_body(obj)


def collect_train_bodies() -> set[str]:
    bodies = set()
    for path in list((LEXSI / "data").glob("sft_*.jsonl")) + [
        LEXSI / "tasks" / "train_scenarios.jsonl"
    ]:
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            if "expected" in rec:  # scenario file
                bodies.add(canon_body(rec))
            else:  # sft pair
                b = body_from_sft_record(rec)
                if b:
                    bodies.add(b)
    return bodies


def main() -> None:
    train_bodies = collect_train_bodies()
    print(f"training bodies collected: {len(train_bodies)}")

    gov = [
        json.loads(l)
        for l in (LEXSI / "tasks" / "governance_scenarios.jsonl")
        .read_text()
        .splitlines()
        if l.strip()
    ]
    eval_bodies = {canon_body(sc) for sc in gov}

    # --- eval-extra: generated held-out scenarios, deduped vs train+eval -----
    rng = random.Random(99)
    eval_extra = []
    idx = 9000
    attempts = 0
    while len(eval_extra) < EVAL_EXTRA_TARGET and attempts < 2000:
        attempts += 1
        sc = gen_scenario(rng, idx)
        idx += 1
        b = canon_body(sc)
        if b in train_bodies or b in eval_bodies:
            continue
        eval_bodies.add(b)
        eval_extra.append(sc)

    eval_suite = gov + eval_extra
    (STAGING / "eval_suite_v2.jsonl").write_text(
        "\n".join(json.dumps(s) for s in eval_suite) + "\n"
    )

    # --- targeted arithmetic SFT data --------------------------------------
    rng2 = random.Random(123)
    arith = []
    idx2 = 0
    attempts2 = 0
    while len(arith) < ARITH_TRAIN_TARGET and attempts2 < 20000:
        attempts2 += 1
        sc = gen_scenario(rng2, idx2)
        idx2 += 1
        kind = sc.get("tags", ["", "?"])[1]
        if kind not in ARITH_KINDS:
            continue
        b = canon_body(sc)
        if b in eval_bodies or b in train_bodies:
            continue
        arith.append(sc)

    rows = []
    for s in arith:
        dec = oracle(s["mandate"], s["request"])
        rows.append(
            {
                "messages": [
                    {"role": "user", "content": scenario_prompt(s)},
                    {
                        "role": "assistant",
                        "content": gold_completion(dec, s["mandate"], s["request"]),
                    },
                ]
            }
        )
    (STAGING / "sft_arith.jsonl").write_text(
        "\n".join(json.dumps(r) for r in rows) + "\n"
    )

    (STAGING / "prompt_template.txt").write_text(load_prompt_template())

    from collections import Counter

    eval_kinds = Counter(s.get("tags", ["gov"])[-1] for s in eval_extra)
    arith_kinds = Counter(s.get("tags", ["?"])[1] for s in arith)
    manifest = {
        "eval_suite_v2": {
            "total": len(eval_suite),
            "gov_hand_authored": len(gov),
            "generated_heldout": len(eval_extra),
            "eval_extra_kinds": dict(eval_kinds),
            "seed": 99,
        },
        "sft_arith": {
            "rows": len(rows),
            "kinds": dict(arith_kinds),
            "seed": 123,
            "note": "oracle-labeled; deduped vs all train + eval bodies",
        },
        "train_bodies_excluded": len(train_bodies),
    }
    (STAGING / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
