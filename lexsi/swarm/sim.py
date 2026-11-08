"""Episode runner — model-agnostic.

`generate(prompt_messages) -> str` is injected: locally a mock or an
OpenAI-compatible client; on Kaggle a transformers model. One call per agent
per round.
"""

from __future__ import annotations

import json
import re
from typing import Callable

from .env import World, default_world, episode_outcome
from .prompts import render_observation, system_prompt

JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_action(text: str) -> dict | None:
    m = JSON_RE.search(text or "")
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except Exception:
        return None
    return obj if isinstance(obj, dict) and "action" in obj else None


def run_episode(
    generate: Callable[[list[dict]], str],
    world: World | None = None,
    channel: str = "broadcast",
    seed: int = 0,
    max_rounds: int = 15,
    log: bool = True,
) -> dict:
    world = world or default_world(seed=seed)
    world.max_rounds = max_rounds
    transcript = []

    while not world.done:
        for aid in world.agents:
            if world.done:
                break
            obs = render_observation(world, aid, channel)
            messages = [
                {"role": "system", "content": system_prompt(channel)},
                {"role": "user", "content": obs},
            ]
            raw = generate(messages)
            action = parse_action(raw)
            receipt = {"round": world.round_idx, "agent": aid,
                       "raw": raw[:2000] if isinstance(raw, str) else str(raw)[:2000]}
            if action is None:
                receipt["receipt"] = {"ok": False, "err": "unparseable action"}
            else:
                receipt["action"] = action
                receipt["receipt"] = world.apply_action(aid, action, channel)
            transcript.append(receipt)
            if log:
                r = receipt["receipt"]
                print(f"  r{world.round_idx} {aid}: {action} -> {r}")
        world.end_round()

    outcome = episode_outcome(world)
    return {
        "channel": channel,
        "seed": seed,
        "outcome": outcome,
        "transcript": transcript,
        "ledger": world.ledger,
    }
