"""Aggregate swarm episodes.jsonl into report-ready tables.

Usage:
    .venv/bin/python -m swarm.analyze_swarm kaggle/output/swarm_out/episodes.jsonl
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def load(path: str) -> list[dict]:
    return [json.loads(l) for l in Path(path).open() if l.strip()]


def main(path: str) -> None:
    eps = load(path)
    groups = defaultdict(list)
    for e in eps:
        groups[(e["variant"], e["channel"])].append(e)

    print(f"{'variant':<7} {'channel':<10} {'n':>3} {'cap%':>5} {'popViol%':>8} "
          f"{'mandBre%':>8} {'blocked%':>8} {'xfer%':>6} {'compl%':>7} "
          f"{'bonus%':>7} {'msgs':>5} {'gap%':>5} {'armBdet%':>8}")
    for (variant, channel), rows in sorted(groups.items()):
        n = len(rows)
        cap = sum(r["outcome"]["cap_breached"] for r in rows) / n
        pop = sum(r["outcome"]["population_violation"] for r in rows) / n
        mand = sum(bool(r["outcome"]["per_agent_breaches"]) for r in rows) / n
        blk = sum(bool(r["outcome"]["blocked_purchases"]) for r in rows) / n
        xfer = sum(bool(r["outcome"]["transfers"]) for r in rows) / n
        compl = sum(r["outcome"]["completion_frac"] for r in rows) / n
        bonus = sum(r["outcome"]["bonus_achieved"] for r in rows) / n
        msgs = sum(r["outcome"]["n_messages"] for r in rows) / n
        gap = sum(r["oversight"]["detection_gap"] for r in rows) / n
        armb = sum(r["oversight"]["arm_b_ledger_forensics"]["detected"]
                   for r in rows) / n
        print(f"{variant:<7} {channel:<10} {n:>3} {cap:>5.0%} {pop:>8.0%} "
              f"{mand:>8.0%} {blk:>8.0%} {xfer:>6.0%} {compl:>7.0%} "
              f"{bonus:>7.0%} {msgs:>5.1f} {gap:>5.0%} {armb:>8.0%}")

    # violation-type frequency overall
    vc = Counter()
    for e in eps:
        for v in e["outcome"]["violations"]:
            vc[v] += 1
    print("\nviolation counts:", dict(vc))

    # per-detector forensics frequency
    fc = Counter()
    for e in eps:
        for k, v in e["oversight"]["arm_b_ledger_forensics"]["by_detector"].items():
            fc[k] += v
    print("forensics findings:", dict(fc))


if __name__ == "__main__":
    main(sys.argv[1])
