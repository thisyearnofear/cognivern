# UX & Information Architecture Review

Assessment of the landing page and dashboard against best-in-class progressive
disclosure and UI/UX primitives, anchored to the product vision in
[`AGENTIC_CAPITAL_THESIS.md`](./AGENTIC_CAPITAL_THESIS.md):

```text
funded mandate → governed action → attributable spend → evidenced outcome → measured performance
```

## The one hierarchy rule

Every nav item, card, or section should be able to name which stage of that
loop it serves. If it cannot, it is either a supporting surface (Settings,
Integrate, Observability) or it should be a *view inside* an existing
destination. This single test resolves most drift and is the discipline that
keeps future features from re-bloating the nav.

Companion contract: [`ADAPTIVE_UX.md`](./ADAPTIVE_UX.md) — how the UI adapts
to workspace state (bounded, explainable, auditable), and the single-source
`deriveWorkspaceState` rule that keeps the dashboard's adaptive surfaces from
contradicting each other.

## What is already strong

The primitives are in good shape and should be reused, not replaced:
`PageHeader`, `PageState`, `StatusBadge`, `Breadcrumb`, command palette,
onboarding wizard, `SetupChecklist`, `AttentionSummary`, `QuickCheck`,
collapsible "insights", a live interactive demo in the landing hero, and motion
that respects `prefers-reduced-motion`. The opportunity is **IA structure and
hierarchy**, not new UI.

## Landing findings

1. **Hero is right** (one H1, one differentiated interactive moment) — but the
   secondary CTA "Explore private selection" competes with the core message.
   Sealed-bid procurement belongs in Use cases, not the hero.
2. **13 sections re-argue three messages** (guardrails, human review, audit
   evidence) from different angles. Best practice is a narrative spine with
   progressive disclosure — each section answers one question the visitor is
   actively asking, once. Target: ~6 sections.
3. **"Who it's for" uses hover-only tooltip badges** — an anti-pattern
   (invisible on touch, undiscoverable). These should be static cards.
4. **No sticky anchor nav** in the fixed header — the missing wayfinding
   primitive for a one-page site.

### Target landing spine

| Section | Answers |
| --- | --- |
| 1. Hero + live demo | What is this? Prove it instantly. |
| 2. How it works (4 steps) | How does it work? |
| 3. What you get (jobs: limit / review / investigate) | What can I do with it? |
| 4. Use cases + who it's for (merged, audience-scoped) | Is this for me? |
| 5. Prove it (terminal + stats merged) | Can I test it? |
| 6. Final CTA + footer | What next? |

## Dashboard findings

1. **Three views of one event stream**: Audit ("decisions and proof"), Runs
   ("active and failed executions"), Capital ("what governed capital
   produced") describe the same loop at different angles. The vision says the
   object is *mandate → spend → outcome*; name the surface accordingly.
2. **"Verified Capital" is a rail, not a surface** — the same concept as
   Capital at a different maturity (Cleanverse on Monad). It is now a *view
   within Capital*, not a sibling nav item.
3. **"Test" holds operational features** (Sealed Bids is a live procurement
   workflow; Copilot is an agent mission console) and **"Build" holds operator
   tools** (Tracing, Terminal). Both groups drifted from their verbs.
4. **Terminology drift**: the thesis and dashboard home say "agents" while the
   nav says "API Identities"; the home itself says both "Active identities"
   and "Governed identities" in one screen; Capital is called "Capital",
   "Verified Capital", and "Agentic capital" in three places. One mental
   model, one name.
5. **Home stacks ~10 blocks above the fold** (setup checklist, next-action,
   attention summary, 3 KPIs, QuickCheck, posture, attribution, activity,
   collapsible insights, identities). The user's arrival job is one of two
   things — "what needs me?" or "is it working?" — and both compete.

### Target nav (3 groups, 8 items)

| Group | Items | Notes |
| --- | --- | --- |
| **Operate** | Dashboard · Audit · Spend & Outcomes · Sealed Bids | Runs + Capital + Verified rail merge into "Spend & Outcomes"; Sealed Bids stays a live workflow |
| **Configure** | Policies · Identities · Sponsored Credits | Copilot moves to a contextual entry on Identities (its route stays) |
| **Developers** | Integrate · Observability · Terminal | Tooling for builders and operators, clearly separated from daily operation |

### Target dashboard home (progressive disclosure)

1. **First screen**: one primary attention object (the "what needs me?" job) +
   a 3-KPI strip + one action card. `WorkspaceNextAction` and
   `AttentionSummary` overlap — pick one primary, demote the other.
2. **Second layer**: Recent Activity + QuickCheck (the "sole primary task" —
   keep near the top).
3. **Third layer (collapse/tabs)**: posture, attribution, operating insights,
   identities — extending the existing "Operating insights" disclosure
   pattern instead of stacking.

## Applied changes

Implemented alongside this review:

- Nav restructured to the target 3 groups; Verified Capital folded into a tab
  on /capital (`/verified-capital` redirects); Copilot rehomed to the
  Identities page.
- Dashboard home reduced to the primary attention object + KPI strip + one
  action card, with the supporting layers behind the existing disclosure
  patterns.
- Landing compressed from 13 sections to the 6-section spine; sealed-bid CTA
  moved out of the hero; hover-only personas replaced with static cards;
  sticky anchor nav added.

Second pass (2026-08-24) — closing the execution gap:

- **Landing stats no longer argue from small numbers.** The animated
  "18 decisions / 3 policies" counters were replaced with capability claims
  that stay true at any scale: `<1min` to first governed action, 3 decision
  outcomes, 100% of decisions recorded with rule + evidence.
- **The sponsored-cohorts wedge has its own landing.** `/sponsor` carries the
  full organiser narrative (hero, console cards, 4-step flow, verify link);
  the main landing keeps one clearly fenced teaser banner linking to it.
  Separate buyer, separate page.
- **Terminology unified.** Surface name is "Identities" (nav, page header,
  dashboard section); "API identity" stays the object term. "Agentic capital"
  / "Verified Capital" / "Capital" collapsed into the surface name "Spend &
  Outcomes" and tab name "Verified rail". The route is now `/spend` to match
  the nav and page title; `/capital` redirects preserving the query string so
  HydraDB `canonical_url` deep links keep working.
- **Monoliths split.** `audit-page.tsx` (1,650 → 623) now composes
  `timeline-node`, `audit-evidence` (pure detection helpers), `audit-metrics`,
  `empty-audit-state`, and `proof-details`. `dashboard.tsx` (899 → 264)
  composes `dashboard-stats`, `recent-activity`, `operating-insights`,
  `ai-spend-card`, `control-score-card`, and `observability-strip`. The
  duplicated count-up hook is shared at `hooks/use-count-up.ts`.
- **One signature visual motif.** `components/brand/evidence-chain.tsx` draws
  the chain of evidence (mandate → action → spend → evidence → record shield).
  It appears under the landing hero demo and on the `/sponsor` hero, so the
  product is recognizable in a screenshot. Honors `prefers-reduced-motion`.
- **Adaptive contract + reconciliation.** `docs/ADAPTIVE_UX.md` states the
  adaptation rule (adapt to workspace state, never inferred preference;
  bounded, explainable, auditable). The dashboard's state machine moved to
  `lib/workspace-state.ts` (`deriveWorkspaceState`) as the single source of
  truth; `WorkspaceNextAction` is now a pure function of that state and only
  renders in `operating`, resolving the earlier overlap where it competed
  with `SetupChecklist` and `AttentionSummary`. Each state now has exactly
  one primary object and at most one action.
