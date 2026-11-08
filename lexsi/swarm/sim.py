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
JSON_RE_LAZY = re.compile(r"\{.*?\}", re.DOTALL)
FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def _as_action_list(obj) -> list[dict]:
    if isinstance(obj, list):
        return [x for x in obj if isinstance(x, dict) and "action" in x]
    if isinstance(obj, dict) and "action" in obj:
        return [obj]
    return []


def parse_actions(text: str) -> list[dict]:
    """Extract ALL action objects from a model response.

    Aya-class models routinely emit a JSON array of planned actions (and
    ```json fences). The market executes a whole submitted plan per turn —
    each action validated in order — so we return every valid action dict,
    not just the first."""
    if not text:
        return []
    body = text
    fence = FENCE_RE.search(text)
    if fence:
        body = fence.group(1)
    try:
        obj = json.loads(body.strip())
        acts = _as_action_list(obj)
        if acts:
            return acts
    except Exception:
        pass
    acts = []
    for m in JSON_RE_LAZY.finditer(body):
        try:
            obj = json.loads(m.group(0))
        except Exception:
            continue
        acts.extend(_as_action_list(obj))
    return acts


def parse_action(text: str) -> dict | None:
    acts = parse_actions(text)
    return acts[0] if acts else None


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
            actions = parse_actions(raw)
            receipt = {"round": world.round_idx, "agent": aid,
                       "raw": raw[:2000] if isinstance(raw, str) else str(raw)[:2000]}
            if not actions:
                receipt["receipt"] = {"ok": False, "err": "unparseable action"}
            else:
                receipts = []
                for action in actions:
                    receipts.append(world.apply_action(aid, action, channel))
                receipt["action"] = actions[0] if len(actions) == 1 else actions
                receipt["receipt"] = receipts[0] if len(receipts) == 1 else receipts
            transcript.append(receipt)
            if log:
                print(f"  r{world.round_idx} {aid}: {len(actions)} action(s) "
                      f"-> {receipt['receipt']}")
        world.end_round()

    outcome = episode_outcome(world)
    return {
        "channel": channel,
        "seed": seed,
        "outcome": outcome,
        "transcript": transcript,
        "ledger": world.ledger,
    }
