# UX Consistency Implementation Plan

This plan turns the UX feedback loop into a sequence of small, testable
changes. It follows the principles in [UX_VISION.md](./UX_VISION.md) and uses
the [UX_VALIDATION_CHECKLIST.md](./UX_VALIDATION_CHECKLIST.md) for acceptance.

## Outcome

Across the product, a user should be able to answer three questions without
learning the implementation architecture first:

1. What needs my attention?
2. What is the next safe action?
3. Where can I inspect proof or detail if I need it?

## Delivery guardrails

- Keep the default view focused; put secondary detail behind explicit
  disclosure or a specialist route.
- Use the shared empty/error state for every route.
- Give every page one dominant primary action.
- Preserve existing backend behavior and data contracts unless a UX change
  cannot be implemented without them.
- Do not capture wallet addresses, API keys, spend amounts, policy content, or
  raw search text in UX analytics.

## Phase 0 — Baseline and shared primitives

### 0.1 Freeze the baseline

Before changing the next surfaces, run the current frontend typecheck, lint,
unit suite, and the manual UX checklist. Record the results and capture one
desktop and one narrow viewport screenshot for Dashboard, Audit, Settings, and
Runs.

### 0.2 Create shared UI primitives

Build or standardize these components under `src/frontend/src/components/ui/`:

- `page-header`: title, outcome-oriented description, optional primary action.
- `attention-summary`: compact healthy/needs-attention state with a next action.
- `page-state`: `empty`, `no-results`, `error`, and `unavailable` variants.
- `disclosure-section`: accessible button, `aria-expanded`, consistent label and
  icon treatment.
- `filter-bar`: search, status chips, clear-all behavior, result count.

Acceptance: a new page can use the primitives without inventing custom spacing,
copy, or retry behavior.

## Phase 1 — Audit investigation flow

### 1.1 Make triage the default

Add an attention summary above the timeline:

- Needs attention = held + denied + suspicious decisions.
- Healthy state = no unresolved items.
- Primary action links to the first unresolved decision.

### 1.2 Add investigation controls

Support:

- Saved views: All, Needs attention, Blocked, Held, Approved. The first release
  uses safe local presets; persistence and shareable URL state follow once the
  filter vocabulary is validated.
- Search by identity, action, policy, chain, or transaction identifier.
- Grouping by decision, API identity, policy, and time.
- Clear-all and result-count feedback.

**Done (2026-08-02):** Filter state (status, search, group) is synced to URL
search params (`?status=`, `?q=`, `?group=`). A copied investigation link
preserves the view. The collapsed audit timeline now shows only agent, action,
decision, and time; evidence badges (FHE, On-Chain, Suspicion, etc.) appear in
the expanded detail section to keep the list scannable. A `/` keyboard shortcut
focuses the search input.

### 1.3 Add safe selection behavior

Add row selection only for reversible actions:

- Export selected records.
- Mark selected records reviewed.
- Open selected evidence.

Do not add bulk approval, policy mutation, or spend execution in this phase.

Acceptance:

- A user can find all denied decisions in under 10 seconds.
- A user can search for one identity and explain why its decision was denied.
- A no-results state offers one clear way to clear filters.
- Proof and architecture detail remain secondary to the investigation timeline.

## Phase 2 — Standardize empty, loading, and error states

### 2.1 Define the state taxonomy

| State | Meaning | Primary action |
| --- | --- | --- |
| Empty | The workspace has no records yet | Create/run the first relevant item |
| No results | Records exist, current filters match none | Clear filters |
| Error | The request failed | Retry |
| Unavailable | The capability is not configured/enabled | Configure or learn more |

### 2.2 Migrate routes in this order

1. Dashboard
2. Audit
3. Policies
4. API Identities
5. Runs
6. Settings
7. Integrate, Tracing, and Sealed Bids

Remove duplicate CTAs when the shared state already supplies the next action.
Use the same title/description/action structure in loading and populated
states, with skeletons replacing only the content area.

**Progress (2026-08-02):** Dashboard sub-cards that previously swallowed fetch
errors now have loading skeletons and graceful unavailable states — `AiSpendCard`
(skeleton + unavailable message), `ControlScoreCard` (skeleton), and
`ObservabilityStrip` (neutral loading copy). The Settings suspicion-threshold
save now surfaces failure via toast + inline message instead of silently
failing. Remaining: apply the same pattern to any route still rendering an
unexplained blank panel.

Acceptance: every primary route has one consistent state for each applicable
condition and no route uses an unexplained blank panel.

## Phase 3 — Align Runs and Settings

### 3.1 Runs as an operational queue

Change the default order to:

1. Page header: “What executions need attention?”
2. Active/awaiting/failed summary.
3. Status, workflow, and date filters.
4. Run list with clear next action.
5. Detail timeline after selecting a run.

Keep **Run governance check** as the single primary action. Make failed and awaiting
runs visually prominent; do not make completed runs compete with them.

Acceptance: a user can find an awaiting or failed run without scanning every
completed run.

### 3.2 Settings as configuration, not a tab drawer

Organize settings into these jobs:

- Workspace
- Access & API keys
- Wallet execution
- Appearance

Each section needs current status, one primary save/configure action, and a
local success/error confirmation. Provider-specific explanation appears only
after that provider is selected. Keep destructive actions isolated and clearly
named.

Acceptance: a user can find API keys and wallet execution without opening tabs
that do not relate to that task; every save has visible confirmation.

## Phase 4 — Lightweight UX analytics

### 4.1 Event contract

Create a small client helper such as `trackUxEvent` with this payload:

```ts
type UxEvent = {
  event:
    | "route_viewed"
    | "primary_action_clicked"
    | "primary_action_completed"
    | "disclosure_opened"
    | "filter_applied"
    | "search_used"
    | "empty_state_action_clicked"
    | "error_retry_clicked"
    | "route_backtracked"
    | "proof_shared";
  route: string;
  component: string;
  variant?: string;
  workspaceMode?: string;
};
```

Use `navigator.sendBeacon` or a fire-and-forget request. Analytics must never
block rendering or a user action. If no approved analytics sink exists, keep a
development logger and defer production transport until the sink is selected.

### 4.2 Instrument only decisions that answer UX questions

Start with Dashboard, Audit, Integrate, Settings, and Runs. Measure:

- Primary-action completion rate.
- Disclosure open rate.
- Filter/search usage and no-result rate.
- Error retry success rate.
- Backtracking between routes.

Do not instrument every click. Review an aggregate report after the first user
testing round and remove events that do not change a product decision.

### 4.3 Measure the proof-and-collaboration funnel

For the Dashboard → Audit/Run → disclosure → copied-artifact path, use only
these privacy-safe events: `route_viewed`, `disclosure_opened`,
`primary_action_clicked`, `primary_action_completed`, and `proof_shared`.
Review the sequence in aggregate by route and component; never send decision
text, policy values, wallet addresses, or spend amounts to UX analytics.

The Dashboard posture artifact is aggregate-only. It exists to let an operator
copy a current governance summary into an existing review thread, with a link
back to the protected audit trail. It must remain disclosed by default so the
operational dashboard stays compact.

## Phase 5 — Validate and roll out

### 5.1 Test groups

Run the checklist with:

- 2 new users.
- 2 returning operators.
- 1 developer/integrator.
- 1 procurement lead if Sealed Bids is in scope.

### 5.2 Record

- Time to completion.
- Wrong turns and backtracking.
- Help/documentation opens.
- Disclosure usage.
- Confidence from 1–5.
- Exact terms users use when describing the result.

### 5.3 Ship in slices

1. Shared primitives + Audit filters.
2. Empty/error state migration.
3. Runs and Settings alignment.
4. Analytics instrumentation.
5. User validation and copy/label cleanup.

Keep each slice independently deployable and run typecheck, lint, unit tests,
and the relevant checklist section before merging.

## Phase 6 — Proof and collaboration loop

Turn decisions into concise, copyable review artifacts. A receipt should state
the outcome, the governed subject, the evidence categories, and a protected
link back to Cognivern—without copying wallet addresses, policy content, or
spend amounts by default. Audit selection should also produce a lightweight
review brief for a teammate or stakeholder. Measure explicit receipt/brief
copies as `proof_shared`; never auto-publish a decision or expose a workspace
record to a recipient who lacks access.

## Definition of done

The phase is complete when:

- Every core route has one clear primary action.
- Empty, no-results, error, and unavailable states use the same interaction
  model.
- Audit supports triage without requiring architecture knowledge.
- Runs prioritizes unresolved work.
- Settings exposes configuration by job, not implementation detail.
- Analytics can answer whether users found and completed the next action.
- User testing shows fewer wrong turns and lower time-to-completion than the
  pre-change baseline.
