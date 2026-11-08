"""Aggregate before/after metrics across all eval runs into a markdown table.

Sources:
  - results/*/summary.json          (Modal AgentTune runs)
  - kaggle/output/**/metrics.json   (Kaggle in-kernel eval, base vs tuned)

Usage: .venv/bin/python scripts/compare_metrics.py
"""

from __future__ import annotations

import json
from pathlib import Path

LEXSI = Path(__file__).resolve().parent.parent


def load_summaries() -> list[dict]:
    rows = []
    for d in sorted((LEXSI / "results").iterdir()):
        s = d / "summary.json"
        if not s.exists():
            continue
        m = json.loads(s.read_text())
        rows.append(
            {
                "run": d.name,
                "n": m["n"],
                "accuracy": m["accuracy"],
                "unsafe_allow_rate": m["unsafe_allow_rate"],
                "unsafe_enforced_rate": m.get("unsafe_enforced_rate"),
                "contract_valid_rate": m.get("contract_valid_rate"),
                "error_classes": m.get("error_classes", {}),
            }
        )
    return rows


def load_kaggle() -> list[dict]:
    rows = []
    for p in (LEXSI / "kaggle" / "output").rglob("metrics.json"):
        m = json.loads(p.read_text())
        for tag in ("base", "tuned"):
            if tag in m:
                t = m[tag]
                eval_path = p.parent / f"eval_{tag}.jsonl"
                uer = None
                if eval_path.exists():
                    recs = [json.loads(l) for l in eval_path.read_text().splitlines() if l.strip()]
                    non_allow = [
                        r for r in recs
                        if r["expected"]["decision"] in {"refuse", "escalate", "ask_clarification"}
                    ]
                    if non_allow:
                        uer = round(
                            sum(
                                1 for r in non_allow
                                if (r.get("emitted_decision") or "").upper() == "ALLOW"
                            )
                            / len(non_allow),
                            4,
                        )
                rows.append(
                    {
                        "run": f"kaggle-{tag}",
                        "n": t["n"],
                        "accuracy": t["accuracy"],
                        "unsafe_allow_rate": t["unsafe_allow_rate"],
                        "unsafe_enforced_rate": uer,
                        "contract_valid_rate": round(t["contract_valid"] / t["n"], 4),
                        "error_classes": t.get("error_classes", {}),
                    }
                )
    return rows


def fmt(v):
    return f"{v:.1%}" if isinstance(v, float) else str(v)


def main() -> None:
    rows = load_summaries() + load_kaggle()
    if not rows:
        print("no results found")
        return
    print("| run | n | accuracy | unsafe allow rate | unsafe enforced | contract valid |")
    print("|---|---|---|---|---|---|")
    for r in rows:
        print(
            f"| {r['run']} | {r['n']} | {fmt(r['accuracy'])} | "
            f"{fmt(r['unsafe_allow_rate'])} | {fmt(r.get('unsafe_enforced_rate'))} | "
            f"{fmt(r.get('contract_valid_rate'))} |"
        )
    print()
    for r in rows:
        print(f"### {r['run']}")
        for k, v in sorted(r["error_classes"].items()):
            print(f"- {k}: {v}")
        print()


if __name__ == "__main__":
    main()
