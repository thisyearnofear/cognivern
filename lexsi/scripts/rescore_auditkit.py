"""Rescore saved eval JSONL with AuditKIT agent_eval (recorded mode).

Takes eval output produced by run_baseline.py (results.jsonl) or the Kaggle
kernel (eval_base.jsonl / eval_tuned.jsonl) plus the scenario suite, rebuilds
AgentEpisodes, and writes auditkit.json with the verified-outcome headline.

Usage:
    .venv/bin/python scripts/rescore_auditkit.py \
        --eval kaggle/output/lexsi_v4_out/eval_tuned.jsonl \
        --tasks tasks/governance_scenarios.jsonl \
        --out results/auditkit_tuned.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LEXSI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(LEXSI_DIR / "scripts"))

import run_baseline as rb  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval", required=True, help="eval JSONL (results.jsonl or eval_*.jsonl)")
    ap.add_argument("--tasks", default=str(LEXSI_DIR / "tasks" / "governance_scenarios.jsonl"))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    results = [
        json.loads(line)
        for line in Path(args.eval).open()
        if line.strip()
    ]
    scenarios = rb.load_scenarios(Path(args.tasks))
    auditkit = rb.auditkit_eval(scenarios, results)
    if auditkit is None:
        raise SystemExit("auditkit unavailable")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(auditkit, indent=2) + "\n")
    print(auditkit.get("summary_text") or "(no summary text)")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
