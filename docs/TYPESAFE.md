# TypeSafe (Jev) — calibrated decision model — proposed rail

> **Status: evaluated, not built.** Next integration candidate after the
> Dynamic wiring lands. Docs: https://docs.typesafe.ai/introduction

Jev is TypeSafe's "System One" decision model: it evaluates typed *questions*
against a *state* and returns structured values — no text generation, no
parsing. Three primitives, mixable in one parallel call:

| Primitive | Asks | Returns |
| --- | --- | --- |
| Choice | pick an option from a list | `choice`, `probabilities`, `confidence` |
| Score | score the state on a rubric | `score`, `probabilities`, `confidence` |
| Noul | is this statement true? | `noul` (0–1) |

## Why it fits

- **Confidence-gated decisions are already our primitive.** The Telegraph rail
  proves the pattern: emit confidence → approve at/above threshold, hold below,
  hold when absent. Jev's `confidence` output is the same contract; it would
  slot into `PolicyEnforcementService` as a *judgment* evaluator alongside the
  deterministic rules.
- **Smaller prompt-injection surface.** A model that can only emit typed
  values can't be jailbroken into arbitrary text or fake tool calls — a real
  property when scoring untrusted agent-generated evidence. Aligns with
  [PROMPT_INJECTION_CONTROLS_PLAN.md](./PROMPT_INJECTION_CONTROLS_PLAN.md).
- **Cleaner evidence artifacts.** A CRE decision record carrying
  `{noul: 0.83, confidence: 0.91}` is more auditable than a parsed LLM
  paragraph — strengthens the attributable-evidence story.

## Proposed slots (in order of value)

1. **Outcome/evidence verification** — "does this evidence satisfy the
   mandate?" → noul → feeds the allocation decision and the Capital page.
   Highest demo value: "outcome verified at 0.87 confidence" is a compelling
   published statement. See [OUTCOME_EVIDENCE_PLAN.md](./OUTCOME_EVIDENCE_PLAN.md).
2. **Judgment rules in policy evaluation** — contract-audit-style calls that
   today route to ChainGPT severity, or novel-situation scoring where no
   deterministic rule applies.
3. **Telegraph miner response scoring** — calibrated quality signal on
   miner outputs before they feed governed decisions.

## Design constraints

- **Deterministic rules stay deterministic.** Budget caps, thresholds, and
  allowlists never route through a model — Jev is for judgment calls only.
- **Fail-closed.** On Jev outage/timeout, decisions hold — never approve.
  Same semantics as Telegraph's missing-confidence hold.
- **Optional rail.** Mirror the `TELEGRAPH_*` env pattern:
  `TYPESAFE_ENABLED` (default off), `TYPESAFE_API_KEY`,
  `TYPESAFE_CONFIDENCE_THRESHOLD`. Inert when unset.
- Young provider — verify latency, pricing, and reliability before making it
  load-bearing in any decision path.
