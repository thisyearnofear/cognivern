# Product UX Vision

## Purpose

Cognivern is a control plane for autonomous spending. The interface must make
that control legible: users should see whether anything needs attention, take
the appropriate action, and prove what happened without first learning every
protocol or infrastructure component.

This document is the decision framework for product UI work.

## Experience principles

### Lead with the next decision

Every default page state answers one immediate question before product
explanation, charts, or technical detail.

| Route | Primary question |
| --- | --- |
| Dashboard | Does anything need my attention? |
| Policies | Are the right guardrails in place? |
| API Identities | Which systems have governed access? |
| Governance Check | Would this spend be allowed? |
| Audit | What happened, and can I prove it? |
| Integrate | What is the shortest safe path to a working integration? |

### Defaults are focused; depth is intentional

The default view contains only information necessary for the next action.
Secondary metrics, charts, protocol architecture, and raw data belong in an
explicit disclosure (for example, **Operating insights** or **Technical
details**) or a specialist route. Do not rely on a mode switch users must
discover to reduce density.

### Onboarding is a temporary product state

New users receive one guided setup state with one meaningful success action.
Returning users see their present operating state rather than the same tutorial
copy. Product explanation belongs in contextual help, the demo, and
documentation—not permanently in every working screen.

### One page, one dominant job

Each page may expose related actions, but it has one unmistakable primary
action. Equal-weight CTAs indicate that separate jobs have been combined
without hierarchy.

### Progressive disclosure is consistent and accessible

- Use buttons with `aria-expanded` and a clear label for hidden content.
- Keep compact states useful; do not hide required controls.
- Prefer an existing specialist page to duplicating a large detail panel.
- Use **Insights** for operating context, **Technical details** for
  implementation and telemetry, and **View all** for a full record set.

### Vocabulary describes the user’s mental model

| Concept | Product term | Avoid using as a synonym |
| --- | --- | --- |
| External governed system | API identity | agent, API slot, identity interchangeably |
| Rules that evaluate actions | policy | guardrail/rule for the same object |
| Proposed evaluation | governance check | test, simulation, check interchangeably |
| Evaluated event | decision | action when the distinction matters |
| Result needing investigation | blocked decision | critical issue unless severity is critical |

“Agent” remains appropriate for an autonomous actor; the configuration object
is an **API identity**.

### Visual direction

Cognivern should feel like a calm operational instrument: editorial hierarchy,
precise status color, and enough atmosphere to distinguish the control plane
from a generic card dashboard. The app shell uses a quiet grid and primary
accent line as its signature. Keep surfaces restrained; reserve saturated color
for status, attention, and the current action. New visual treatments should
support scanability rather than add decorative density.

The implementation codifies this direction through shared `PageHeader`,
`StatusBadge`, and `PageState` components plus `app-surface-card` and
`motion-enter` tokens. New routes should reuse these primitives before adding
one-off spacing, status colors, or entrance animations.

## Product modes and information architecture

| Mode | User goal | Routes |
| --- | --- | --- |
| Operate | Monitor and resolve governed activity | Dashboard, Audit, Runs |
| Configure | Establish who can spend and under which rules | Policies, API Identities, Settings |
| Test | Evaluate a proposed action before it happens | Governance Check, Spend Flow Demo |
| Build | Integrate and debug Cognivern | Integrate, Tracing, Terminal |

Sealed Bids is a distinct governance workflow for confidential vendor
selection. It should not be used as routine-wallet-spend explanation on the
Dashboard.

## Shared page contract

All main routes follow this order unless they are a deliberate multi-step flow:

1. Title and outcome-oriented one-sentence description.
2. One primary action.
3. Attention or current state; exceptions appear first.
4. Core working content: list, form, or result.
5. Supporting context.
6. Advanced detail, disclosed or routed to a specialist page.

Empty states direct users to their required next task. Avoid rendering a large
empty-state CTA together with a competing template gallery or duplicate CTA.

## Route blueprint and current audit

| Route | Default experience | Next change |
| --- | --- | --- |
| Dashboard | Status, three outcome metrics, Quick Check, recent activity; detail under **Operating insights** | Keep the compact default; do not re-add promotional or infrastructure strips. |
| Policies | Policy list, active/held state, **Create policy** | Templates are the only zero state; retain **Start from scratch** as secondary. |
| API Identities | User inventory, status, **Create API identity** | Example identities are disclosed behind **View examples** in production workspaces. |
| Governance Check | Natural-language input, summary, **Evaluate spend** | Keep Command Center contextual; continue to order results outcome → reason → policy checks → evidence. |
| Audit | Filters/search, timeline, approved/held/blocked grouping | Keep Security Architecture under **Proof & security details**; next, add grouping when users need bulk investigation. |
| Integrate | Prerequisite checklist, first request, allow/deny handling | Keep the platform overview collapsed; keep protocol coverage and security inventory in Reference. |
| Tracing | Connection health, live metrics, trace search, recent traces | Collapse the specialized KeeperHub walkthrough unless a KeeperHub wallet is configured. |
| Sealed Bids | Round list/status and one creation route | **Create agent round** is primary; retain **Create manually** as the explicit alternative. |

## Delivery plan

### Phase 1 — Align working surfaces

1. Apply the route blueprint to Policies, Governance Check, Audit, Integrate,
   and Sealed Bids.
2. Extract shared primitives: page header, compact attention card, insight
   disclosure, prerequisite checklist, and purposeful empty state.
3. Update sidebar labels and CTA copy to the vocabulary table.

### Phase 2 — Validate workflows

Run moderated tasks with new and returning users:

1. Create a policy and API identity.
2. Evaluate a proposed spend and explain the result.
3. Find and investigate a blocked decision.
4. Integrate a system using an API key and the first request.
5. Start a confidential vendor-selection round.

Capture completion time, wrong turns, help/documentation opens, and the moment
a participant stops reading. Ask about clarity after the task, not general
visual preference.

### Phase 3 — Measure and iterate

Instrument primary-action completion, insight expansion, template selection,
evidence opening, and backtracking between routes. Establish a baseline before
major changes and compare completion and backtracking rates afterward.

## Definition of done for future UI work

- The primary question and action are clear in the first viewport.
- New-user guidance does not persist for established workspaces.
- Secondary information is disclosed or routed intentionally.
- No object has two competing names in the same task flow.
- Empty, error, loading, and populated states preserve the page’s dominant job.
- Keyboard and screen-reader users can control disclosures.
- A task-based test confirms users can finish the page’s primary job without
  being taught the product architecture first.
