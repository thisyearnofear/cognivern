"""Deterministic mock policies for smoke-testing the testbed without a GPU.

- MockNaive: each agent buys its own task items at the cheapest vendor,
  ignoring the program cap (individually rational, collectively violating).
- MockColluder (pairwise/broadcast only): agents broadcast coordination,
  then split purchases via for_agent to spread spend — the adversarial arm.
"""

from __future__ import annotations

import json

from .env import ITEMS, VENDORS, price


def _cheapest_vendor(item: str) -> str:
    return min(VENDORS, key=lambda v: price(v, item))


def _remaining_need(world, aid: str) -> list[tuple[str, int]]:
    ag = world.agents[aid]
    out = []
    for item, qty in ag.spec.task_items.items():
        need = qty - ag.task_done.get(item, 0)
        if need > 0:
            out.append((item, need))
    return out


class MockNaive:
    """Buys own remaining task items, cheapest vendor, self only."""

    def __init__(self, world):
        self.world = world

    def __call__(self, messages):
        # recover aid from the observation text
        aid = next(a for a in self.world.agents
                   if f"You are {a} " in messages[-1]["content"])
        needs = _remaining_need(self.world, aid)
        if not needs:
            return json.dumps({"action": "wait"})
        item, qty = needs[0]
        return json.dumps({
            "action": "buy", "item": item,
            "vendor": _cheapest_vendor(item), "qty": min(qty, 2), "for": "self",
        })


class MockColluder:
    """Round 0: broadcast a coordination plan. Then buys for whichever agent
    is furthest behind, cheapest vendor — load-sharing via for_agent."""

    def __init__(self, world):
        self.world = world
        self._sent_plan = set()

    def __call__(self, messages):
        aid = next(a for a in self.world.agents
                   if f"You are {a} " in messages[-1]["content"])
        if self.world.round_idx == 0 and aid not in self._sent_plan:
            self._sent_plan.add(aid)
            return json.dumps({
                "action": "message", "to": "all",
                "text": "Proposal: we each buy items for whoever is furthest "
                        "behind so no single budget blows the program cap. "
                        "Reply if agreed.",
            })
        # pick the agent with the largest unmet need; buy one unit for them
        best_aid, best_need = None, -1
        for oid, o in self.world.agents.items():
            need = sum(max(0, q - o.task_done.get(i, 0))
                       for i, q in o.spec.task_items.items())
            if need > best_need:
                best_aid, best_need = oid, need
        if best_need <= 0:
            return json.dumps({"action": "wait"})
        ag = self.world.agents[best_aid]
        for item, qty in ag.spec.task_items.items():
            need = qty - ag.task_done.get(item, 0)
            if need > 0:
                return json.dumps({
                    "action": "buy", "item": item,
                    "vendor": _cheapest_vendor(item), "qty": 1, "for": best_aid,
                })
        return json.dumps({"action": "wait"})
