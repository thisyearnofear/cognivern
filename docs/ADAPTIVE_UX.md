# Adaptive UX — Cognivern's adaptation contract

Cognivern's product thesis is *governing adaptive agents*: bounded mandates,
policy enforcement, human review at consequential moments, and an evidence
trail for every action. The interface should embody the same contract it
sells. This document states the rules that govern how the UI adapts.

Roots: adaptive-interface HCI (Nielsen, *Noncommand User Interfaces*, 1993;
the adaptive-vs-adaptable distinction), self-adaptive software (the MAPE-K
Monitor→Analyze→Plan→Execute-over-Knowledge loop), and modern context-aware
dashboard practice. See `UX_IA_REVIEW.md` for the information-architecture
rules this builds on.

## The one rule

> **The UI adapts to workspace *state*, never to inferred *preference*. Every
> adaptation states its reason. Structure is fixed.**

Three properties, mirroring what a governed agent spend must have:

1. **Bounded.** The UI may adapt *emphasis and content* — what appears first,
   what is expanded, what is flagged, which single next action is offered. It
   must never adapt *structure*: nav order, route names, or the identity of a
   primary action. Operators build muscle memory in a console; a governance
   tool that silently moves things is ironic and harmful.
2. **Explainable.** When the first screen changes, say why. The reason is
   always one line, derived from an observable fact (a count, a missing
   milestone), never from a guess about the user.
3. **Auditable / reversible.** Adaptations rest on observable inputs and any
   user-facing preference lives in `preferences-store` where it can be seen
   and reset. No invisible magic.

## Adaptive vs adaptable

- **Adaptive** (system-initiated): allowed, and only on the dimensions below.
- **Adaptable** (user-initiated): preferred wherever the user can state the
  need directly — filters, saved views, disclosure toggles. These sync to the
  URL so they are shareable and reversible (see the audit page).

Prefer adaptable over adaptive when both would work. Adapt only for things the
system can observe with certainty.

## What the UI adapts to (the allowed dimensions)

| Dimension | Example | Status |
|---|---|---|
| **Workspace state** | Dashboard first screen: `setup` → `attention` → `operating` | Built — the canonical adaptation |
| **Attention** | `AttentionSummary` tone, counts, and the single next action | Built |
| **Auth / session** | Landing redirects signed-in users to the dashboard | Built |
| **Mode** | Demo vs production banners, deterministic demo data | Built |
| **Capability / context** | `prefers-reduced-motion`, iOS safe areas, mobile sidebar | Built |
| **Data presence** | Empty states, skeleton loading, hidden-when-absent cards | Built |

## What the UI must NOT adapt to (for now)

- **Inferred role or persona** (reordering nav per "type of user"). Premature
  with few users; the `UX_IA_REVIEW.md` one-hierarchy rule is the safer
  substitute.
- **ML/AI personalization** (predicted layout, inferred preferences). This is
  where over-personalization erodes user control and conflicts with a trust
  product. Defer until real usage data makes adaptations observations, not
  stereotypes.

## The canonical adaptation: the dashboard first screen

The dashboard derives one `workspaceState` from observable facts and the whole
first screen plans itself around a single job. This is MAPE-K applied to a UI:

```
Monitor   → policies? identities? API key? any decisions? held/stopped count?
Analyze   → workspaceState = setup | attention | operating
Plan      → pick the one primary object + the one next action
Execute   → render SetupChecklist | AttentionSummary | action card
Knowledge → the derivation lives in one place so every surface agrees
```

The state machine and its single source of truth:

- `setup` — a milestone is missing (no active policy, identity, key, or first
  decision). `SetupChecklist` owns the first screen.
- `attention` — held or stopped decisions exist. `AttentionSummary` is the
  primary object and carries the one action ("review decisions").
- `operating` — governance is steady. `AttentionSummary` reports healthy and
  `WorkspaceNextAction` offers the single forward-looking review.

**Reconciliation rule:** the derivation lives in `lib/workspace-state.ts`
(`deriveWorkspaceState`). `SetupChecklist`, `AttentionSummary`, and
`WorkspaceNextAction` all consume that one result; none re-derives its own
ladder. Each state renders exactly one primary object and at most one action:

| State | Primary object | The one action |
|---|---|---|
| `setup` | `SetupChecklist` | the next incomplete milestone |
| `attention` | `AttentionSummary` (attention tone) | Review decisions |
| `operating` | `AttentionSummary` (healthy tone) + `WorkspaceNextAction` | the forward-looking spend/mandate review |

## Extending the loop safely

When adding a new adaptation, it must pass this checklist:

- [ ] It adapts emphasis/content, not structure.
- [ ] The trigger is an observable fact, not an inference.
- [ ] The reason can be stated in one line.
- [ ] The user can see what changed and reverse it.
- [ ] It is driven by the existing `workspaceState` (or a named sibling), not
      an ad-hoc condition buried in a component.

The `trackUxEvent` telemetry is the Monitor layer's foundation. Let it
accumulate real usage before considering behavior- or role-adaptive features.
