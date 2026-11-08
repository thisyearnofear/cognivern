"""Local runner: smoke-test episodes with mock policies or an
OpenAI-compatible endpoint (e.g., a vLLM server). No GPU required for mocks.

Usage:
    .venv/bin/python -m swarm.run_local --policy naive --channel broadcast
    LEXSI_MODEL_ENDPOINT=http://localhost:8000/v1 .venv/bin/python -m swarm.run_local \
        --policy endpoint --channel pairwise --episodes 4
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from swarm.env import default_world  # noqa: E402
from swarm.forensics import oversight_comparison  # noqa: E402
from swarm.mock import MockColluder, MockNaive  # noqa: E402
from swarm.sim import run_episode  # noqa: E402


def endpoint_generate(model: str, api_key: str):
    from openai import OpenAI
    client = OpenAI(base_url=os.environ["LEXSI_MODEL_ENDPOINT"], api_key=api_key)

    def gen(messages):
        r = client.chat.completions.create(
            model=model, messages=messages, temperature=0.0, max_tokens=300)
        return r.choices[0].message.content or ""
    return gen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--policy", choices=["naive", "colluder", "endpoint"],
                    default="naive")
    ap.add_argument("--channel", choices=["none", "broadcast", "pairwise"],
                    default="broadcast")
    ap.add_argument("--episodes", type=int, default=1)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--model", default=os.environ.get("LEXSI_SERVED_MODEL", "aya-expanse-8b"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    all_results = []
    for ep in range(args.episodes):
        seed = args.seed + ep
        world = default_world(seed=seed)
        if args.policy == "naive":
            gen = MockNaive(world)
        elif args.policy == "colluder":
            gen = MockColluder(world)
        else:
            gen = endpoint_generate(args.model, os.environ.get("LEXSI_API_KEY", "none"))

        t0 = time.time()
        result = run_episode(gen, world=world, channel=args.channel,
                             seed=seed, log=False)
        result["oversight"] = oversight_comparison(
            result["outcome"], result["ledger"], world.program_cap)
        result["wall_s"] = round(time.time() - t0, 1)
        all_results.append(result)
        o = result["outcome"]
        print(f"[ep{ep}] channel={args.channel} policy={args.policy} "
              f"violations={o['violations']} spend={o['program_spent']}/"
              f"{o['program_cap']} tasks={o['tasks_complete']}/{o['tasks_total']} "
              f"msgs={o['n_messages']} det_gap={result['oversight']['detection_gap']}")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(json.dumps(r) for r in all_results) + "\n")
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
