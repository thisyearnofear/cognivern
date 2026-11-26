# Visual, Motion & Anti-Verbosity UX Master Plan

> **Status:** Planned (Baseline Audit Complete — 2026-11-26)
> **Companion docs:** [`UX_IA_REVIEW.md`](./UX_IA_REVIEW.md) (information architecture) · [`ADAPTIVE_UX.md`](./ADAPTIVE_UX.md) (state-adaptation contract) · [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) (glossary & loop)
> **Purpose:** Durable design system specification and trackable execution plan to replace Cognivern's prose-heavy UI with differentiated visual, spatial, illustrative, and motion primitives.

---

## Master Progress Tracker

Update this table as PRs land. Follow `AGENTS.md`: **one concern per PR**, before/after screenshots or short video in every UI PR, and note the rails touched.

| Phase | Track | PR Scope | Status | Verification Gate |
| --- | --- | --- | --- | --- |
| **0** | Motion & Token Foundation | Remove `framer-motion`, add `<MotionConfig>`, fix `PageTransition`, unify RainbowKit theme, add `motion-tokens.ts` | `[x]` Done | typecheck+lint pass; route transition 120ms, non-blocking; zero `framer-motion` refs |
| **1** | Copy Diet & Ambient Mode Chrome | Collapse 5× Sandbox banners to `AmbientModeChrome`, kill idle loops/count-ups/typewriter, trim `DecisionPreview` & page headers | `[x]` Done | typecheck+lint pass; 40/40 scoped vitest pass (decision-preview, budget-format, guided/agent round-create, workspace+sealed-bid state); zero `pulse-bg`/`animate-ping`/`useCountUp` (hook file removed). Playwright e2e blocked by a pre-existing occupied dev server — run `tests/e2e/landing.spec.ts` + `sealed-bid.spec.ts` when port is free |
| **2A** | Primitive: `BoundaryBar` | Build calibrated 3-zone ruler + semantic stamp; wire into Landing Hero, Policies, Onboarding, QuickCheck, GovernanceCheck | `[x]` Done | typecheck+lint pass; 7/7 `boundary-scale` vitest pass + existing decision-preview suite pass; no `Drag past` copy remains. Playwright drag/reduced-motion check still blocked by occupied dev port |
| **2B** | Primitive: `DisclosureLens` & `SealedEnvelope` | Build tactile envelopes + security-hatch redaction + Canton vs FHE visual diff; wire into `PartyView`, `RevealComparison`, `VisibilityReplay` | `[x]` Done | typecheck+lint pass; 5/5 new `party-lens` vitest pass + existing visibility-replay/sealed-bid suites green. Disclosure driven purely by real participant responses/replay evidence (amounts reach cards only when disclosed). Playwright party-toggle screenshot matrix still blocked by occupied dev port |
| **2C** | Primitive: `EvidenceFlow` & `NotaryReceipt` | Upgrade `EvidenceChain` into branching SVG gate + `pathLength` flow + compact inline audit chain; upgrade `DecisionReceipt` | `[ ]` Not started | SpendFlowDemo + FHE SSE + Audit timeline verification |
| **2D** | Primitive: `MandateReservoir` | Build stacked budget/escrow/impact-delta bar; wire into `InboxPage`, `CapitalPage`, `ProgramDetail`, `Sponsored Credits` | `[ ]` Not started | Inbox before→after impact diff screenshot |
| **3** | Illustration System (`SchematicPlate`) | Author 6 architectural 1.5px-stroke SVG plates; replace generic `HelpCircle` empty states + `EmptyAuditState` + Onboarding hero icons | `[ ]` Not started | Light + dark mode contrast & crisp 1x/2x SVG audit |
| **4** | Landing Page Compression & Interactive Loop | Compress 9 prose bands → 5 visual bands; merge Loop/How-it-works/Jobs into 1 interactive explorer; visual `Alone → Governed` flip card | `[ ]` Not started | Full-page height cut ≥35% + word count cut ≥45% |
| **5** | Delight Layer (Optional Polish) | Opt-in synthesized Web Audio micro-detents (`TactileFeedback`), reactive `NumberFlow` digits on live deltas, optional Rive hero showcase | `[ ]` Not started | Muted by default + zero CLS + bundle budget check |

---

## 1. Baseline Audit: Why Reviewers Call Cognivern "Well Made, But Supremely Verbose"

Cognivern's engineering and UX architecture are genuinely strong: single-source state adaptation (`deriveWorkspaceState`), URL-synced filters, honest provenance, and `prefers-reduced-motion` awareness. The friction is **modality imbalance** — almost every invisible-infrastructure concept (policy bounds, FHE encryption, Canton sub-transaction privacy, escrow holds, mandate budgets) is explained in *paragraphs* instead of perceived through *visual and kinetic instruments*.

### Verified Baseline Metrics (2026-11-26)

| Signal | Baseline Measurement | Target After Plan |
| --- | --- | --- |
| Custom `<svg>` / `<img>` / `<canvas>` files in `src/frontend/src` | **6 files total** (2 chevrons/arrows, 2 bare sparklines, 1 shield logo, 1 static 3-envelope strip) | **15+ purposeful visual primitives & plates** across all core flows |
| `text-muted-foreground` / `CardDescription` / `app-page-description` occurrences | **1,121** | **≤ 650** (≥40% reduction in explanatory prose) |
| Simultaneous "Demo / Sandbox" prose reminders on Dashboard | **5** (`AppSidebar`, `DemoBanner`, `Dashboard` subtitle, `WorkspaceNextAction`, `WelcomeOverlay`) | **1** (`AmbientModeChrome` top hairline + pill) |
| Redundant outcome statements inside `DecisionPreview` | **4 stacked lines** (`Approved` + blurb + reasoning + footer) | **2 compact signals** (Verdict stamp + BoundaryBar + 1 specific rule reason) |
| Landing page vertical sections (`landing-page.tsx`, 1,334 LOC) | **9 full bands** (with 12 text cards across 3 consecutive sections repeating the same loop) | **5 distinct, variegated bands** (≤ 750 LOC, ≥45% fewer words) |
| Motion packages in `src/frontend/package.json` | **2** (`framer-motion@12.40.0` + `motion@13.1.0`) | **1** (`motion` only, wrapped in root `<MotionConfig>`) |
| `layoutId` shared-element transitions across app | **0** | All segmented controls, party lenses, filter pills, and inbox resolutions |
| Route transition blocking latency (`AnimatePresence mode="wait"`) | **~500ms** (250ms exit + 250ms enter) | **≤ 120ms** (non-blocking settle; zero exit lock) |
| Idle continuously repainting animations | **2** (`AppSidebar` ping+sweep, `LandingPage` `"Checking policy"` pulse) | **0** (strict compliance with `AGENTS.md` Taste rule) |
| Operational KPI mount count-up delay (`DashboardStats`) | **2,000ms** (`useCountUp(..., 2000)`) | **0ms on mount** (instant render; ≤250ms odometer roll only on *live deltas*) |

---

## 2. Research Synthesis: A Variegated, Differentiated Craft Strategy

A common trap when "making a B2B app more visual" is picking **one** trendy aesthetic (e.g., cloning Linear's monochrome dark mode or dropping generic flat-vector SaaS characters everywhere). That produces visual monotony.

Instead, Cognivern's domain — **governing autonomous agents with real money, cryptographic privacy, and provable receipts** — sits at the intersection of **financial instruments, cryptographic security, and operational control planes**. Drawing from eight best-in-class design lineages gives Cognivern a **variegated yet unified** toolkit where each modality earns its place by matching the *job of the surface*:

| Lineage / Reference | Core Principle | How Cognivern Adapts It (Differentiated Application) | Where It Applies |
| --- | --- | --- | --- |
| **1. Dieter Rams / Braun / Teenage Engineering** *(Industrial Instruments)* | Controls communicate limits, zones, and state through proportion, tick marks, and color bands — *without instruction text*. | **Calibrated Instruments:** Color-banded `BoundaryBar` rails with physical threshold notches and spring pins replace prose descriptions of limits. | Landing Hero, Policies, Onboarding, QuickCheck, GovernanceCheck |
| **2. Bret Victor & Bartosz Ciechanowski** *(Explorable Explanations)* | Let users manipulate a single parameter and watch linked visual representations respond causally in real time. | **Reactive Proof Toys:** Drag an amount → rail, stamp, and receipt update together; click a Canton party → envelopes physically seal/redact; pick a policy tier → boundary zones resize live. | Landing Hero & Loop, `/verify`, `PartyView`, `RevealComparison`, Onboarding |
| **3. Benji Taylor / Family Wallet** *(Fluid Spatial Continuity)* | Elements morph rather than teleport; trays, pills, and submission states preserve spatial identity across state transitions. | **Shared-Element Continuity (`layoutId`):** Active filter/party lenses glide smoothly; submit buttons morph cleanly from `Evaluate → Checking → Verdict`; resolved Inbox rows collapse cleanly into stamped receipts. | Filters, Tabs, PartyView, Inbox, QuickCheck |
| **4. Emil Kowalski & Rauno Freiberg** *(Motion With Restraint)* | Motion earns its place only to orient, prove causality, or confirm state. Zero `bounce > 0` on utility chrome; spring weight reserved for physical moments; `tabular-nums` on every shifting figure. | **Two-Tier Physics:** Critically damped, crisp curves (`120–180ms`) for navigation/chrome; tactile weighted springs reserved strictly for semantic **Stamps** and **Seals**. | Global `motion-tokens.ts`, `PageTransition`, `DashboardStats` |
| **5. Physical Accountability Artifacts** *(Notary Seals, Banknotes, Security Envelopes, Perforated Receipts)* | Financial trust feels visceral when digital proofs echo physical tamper-evident artifacts (not generic SaaS cards). | **Institutional Tactility:** `NotaryReceipt` with serrated/notched proof top-edge and ink stamp; `SealedEnvelope` with security cross-hatch redaction and shield seal. | `DecisionReceipt`, `SealedBid`, `AuditPage`, `/verify` |
| **6. Stripe & Architectural Blueprints** *(Technical Schematics)* | Resolution-independent, ultra-lightweight inline SVG schematics (1.5px stroke, orthographic/isometric precision) beat heavy videos and generic corporate illustrations. | **Architectural Plates (`SchematicPlate`):** Six crisp, token-colored SVG schematics that sit naturally on Cognivern's `.app-surface` 48px grid in both light and dark modes. | Empty states (`PageState`), Onboarding, Landing Proof & Use Cases |
| **7. 2026 HITL Escalation Craft** *(Anti-Automation-Bias / OWASP ASI09)* | Avoid rubber-stamping by replacing raw JSON/monospace dumps with before→after visual diffs, reversibility badges, and <60s decision scannability. | **Impact-First Queue Cards:** `MandateReservoir` shows exact treasury shift (`62% → 84%`), explicit `Irreversible on-chain` vs `Reversible` badge, and 1-line trigger highlight. | `InboxPage`, `AuditPage` batch approvals, `CapitalPage` |
| **8. Josh Comeau / Native Sensory Craft** *(Optional Micro-Sound & Haptics)* | Web apps engage only 1 of 5 senses. Subtle, opt-in tactile audio cues (~15ms synthesized detents) turn interactive demos and high-stakes approvals into memorable moments. | **Opt-In Synthesized Detents:** Off by default (toggleable in Settings / interactive demos); zero external audio assets (Web Audio API oscillators/envelopes); subtle detent on crossing a boundary threshold and soft seal thud on approval. | Landing Demo (opt-in icon), Governance Check, Sealed-Bid Reveal, Inbox Approve |

### Why Variegation Matters Here
Notice that **no two adjacent sections or tasks use the same visual device**:
- **Threshold decisions** use a *horizontal calibrated instrument* (`BoundaryBar`).
- **Privacy & bidding** use *tactile envelopes + redaction masks* (`DisclosureLens` / `SealedEnvelope`).
- **Execution pipelines** use *branching architectural schematics* (`EvidenceFlow`).
- **Capital & treasury** use *proportional reservoir bars* (`MandateReservoir`).
- **Audit records** use *physical notary receipts* (`NotaryReceipt`).
- **Empty states** use *blueprint line-art plates* (`SchematicPlate`).

A user moving through Cognivern immediately recognizes *where they are* and *what mental model applies* from the visual primitive alone, before reading a single sentence.

---

## 3. Design System Contract

### 3.1 Aesthetic Direction: "Precision Governance Instrument"
Cognivern already has the right bones in <ref_file file="/Users/udingethe/Dev/cognivern/src/frontend/src/app/globals.css" />:
- **Typography:** `Space Grotesk` (display/headers), `Geist` (UI copy), `JetBrains Mono` (hashes, amounts, code — always with `tabular-nums` when values change or align in columns).
- **Color Grammar (Strict Semantic Discipline):**
  - **Sky Blue (`--primary`, `oklch(0.62 0.19 250)`):** Governance control plane, active selection, interactive rail focus.
  - **Emerald (`emerald-500/600`):** Approved / auto-pass / verified integrity / production live.
  - **Amber (`amber-500/600`):** Held for human judgment / sandbox mode / FHE confidential boundary / escrow pending.
  - **Crimson (`destructive` / `red-500/600`):** Hard stop / denied / blocked / irreversible warning.
  - **Fix Brand Drift:** Replace the hardcoded purple `#7c3aed` dark-only RainbowKit theme in <ref_snippet file="/Users/udingethe/Dev/cognivern/src/frontend/src/components/providers.tsx" lines="21-22" /> with dynamic light/dark theme synced to `next-themes` using Cognivern's sky-blue accent (`#0284c7` / `#38bdf8`).

### 3.2 Motion Grammar (`src/frontend/src/lib/motion-tokens.ts`)
Centralize every spring, curve, and duration into one typed module. No magic numbers scattered across components.

```ts
// Proposed: src/frontend/src/lib/motion-tokens.ts
export const MOTION_EASE = {
  /** Crisp deceleration for utility chrome (accordions, drawers, reveals). Never overshoots. */
  out: [0.22, 1, 0.36, 1] as const,
  /** Symmetric curve for SVG path travel and continuous scrub interpolation. */
  inOut: [0.4, 0, 0.2, 1] as const,
} as const;

export const MOTION_SPRING = {
  /** Shared-element pills (layoutId), segmented controls, filter tabs. Zero bounce. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const,
  /** BoundaryBar pin glide, MandateReservoir fill shifts, envelope sliding. Crisp settle. */
  instrument: { type: "spring", stiffness: 360, damping: 30, mass: 0.85 } as const,
  /** Semantic Decision Stamp & Wax/Shield Seal ONLY. Controlled physical weight. */
  stamp: { type: "spring", stiffness: 460, damping: 24, mass: 0.75 } as const,
} as const;

export const MOTION_DURATION = {
  micro: 0.12,     // hover/press/route settle
  fast: 0.18,      // tab swap, tooltip, chip toggle
  medium: 0.28,    // card expand, envelope redact/unseal
  flow: 0.55,      // SVG packet traversal between two gate nodes
} as const;
```

**Hard Motion Laws (enforced in PR review):**
1. **Wrap the app root in `<MotionConfig reducedMotion="user">`** inside `src/frontend/src/components/providers.tsx`.
2. **Zero `bounce > 0` on utility UI** (dropdowns, popovers, tabs, panels, drawers).
3. **Zero `AnimatePresence mode="wait"` on full-page route transitions** (`(dashboard)/layout.tsx`). Route switches must never block input or hold exit frames.
4. **Zero idle infinite animations** (`animate-ping`, `animate-pulse`, infinite sweeps) on static status labels. Animate *only* during active network/SSE/prover work or direct user interaction.
5. **GPU-composited properties only** (`transform`, `opacity`, `clip-path`, SVG `stroke-dashoffset`/`pathLength`). Never animate `width`/`height` directly except via Motion `layout` transforms.
6. **Interruptible by default:** Springs naturally re-target mid-flight when a user rapidly clicks parties, drags the slider, or filters audit logs.

### 3.3 Copy Budget & Anti-Verbosity Laws
Every PR touching UI copy must pass these quantitative ceilings:

| Element | Hard Ceiling | Rule |
| --- | --- | --- |
| `PageHeader` description | **≤ 12 words** (1 line max) | Never stack a second `<p>` or `<aside>` essay directly below `PageHeader`. |
| Card without a visual primitive | **Banned for conceptual cards** | Every informational card must pair a visual primitive (bar, schematic, sparkline, envelope, matrix) or direct control — never `icon + title + 2 sentences`. |
| Ambient mode indicator (Sandbox / Demo / Production) | **1 chrome surface** | Zero page-level `"Nothing here moves real funds"` disclaimers once `AmbientModeChrome` is active. |
| Decision outcome block | **Verdict + 1 concrete reason** | Never repeat a generic blurb (`"This action is within the boundary"`) above a specific reason (`"Under $100 auto-approve limit"`). |
| Tooltips (`HelpIcon`, hover lore) | **Opt-in contextual only** | Remove etymology/marketing hover tooltips from permanent nav chrome (`AppSidebar`). Keep `HelpIcon` strictly for genuinely non-obvious cryptographic/policy terms (`FHE`, `Idempotency`). |
| Technical endpoints / `wei` / raw hashes | **Hidden behind disclosure or formatted** | Format `wei` into human token/USD units; tuck raw `GET /rounds/...` queries behind a compact `"Ledger proof ▸"` toggle. |

### 3.4 Architectural Illustration Spec (`SchematicPlate`)
To avoid generic AI-slop illustrations while staying lightweight and theme-native:
- **Geometry:** Orthographic or 30° isometric technical line-art on a 240×140 `viewBox` (scaled cleanly to any container).
- **Stroke system:**
  - Structural wireframe: `stroke="var(--border)"` or `color-mix(in oklab, var(--muted-foreground) 45%, transparent)`, `strokeWidth="1.25"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
  - Focal mechanism: `stroke="var(--primary)"` (or semantic emerald/amber/red), `strokeWidth="1.75"`.
  - Subtle surface depth: faint `fill="var(--muted)"` at `0.35–0.5` opacity + crisp SVG `<pattern>` diagonal security hatch (4px spacing, 45°, 1px line) for sealed/redacted/escrowed zones.
- **No gradients that muddy in light/dark mode; no cartoon anatomy; zero external image fetches.** Every plate works identically in light mode, dark mode, high-contrast, and SSR.

---

## 4. Detailed Specification of the 8 Core Visual Primitives

### Primitive 1: `BoundaryBar` (Calibrated Policy Threshold Instrument)
- **File:** `src/frontend/src/components/primitives/boundary-bar.tsx`
- **Replaces:** Plain gray `<input type="range">` + `"Drag past $100..."` text (`landing-page.tsx`), emoji template cards & raw `wei` text (`policies-page.tsx`), static policy text in `onboarding-wizard.tsx`, redundant blurbs in `decision-preview.tsx`, text-only results in `quick-check.tsx` and `governance-check.tsx`.
- **Visual Anatomy:**
  ```text
  $0              $100                           $3,000         $5,000
  ├──── AUTO ─────┼──────────── HOLD ────────────┼──── STOP ────┤
  [███████████████][▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓][▒▒▒▒▒▒▒▒▒▒▒▒▒▒]
                         ▲ $420 (spring pin + pulse ring on zone cross)
  ```
  - Supports **interactive mode** (accessible range slider overlaid transparently on the calibrated 3-zone track with tactile zone-crossing detents) AND **display mode** (compact 8px-tall read-only bar for Policy Cards & QuickCheck results).
  - Supports **logarithmic or piecewise-linear scale** so `$0–$100` (auto), `$100–$3,000` (hold), and `$3,000–$5,000` (stop) each get readable visual real estate (on a naive linear `$0–$5,000` track, `$0–$100` is only 2% wide — almost impossible to drag into!). **Piecewise zoning (`[0–30%]`, `[30–70%]`, `[70–100%]`) makes all three bands effortlessly explorable.**
  - **Paired `DecisionStamp` sub-component:** Stamped in semantic ink (`APPROVED` emerald / `HELD` amber / `STOPPED` crimson) using `MOTION_SPRING.stamp` with `-6deg` calibrated tilt, subtle double-border notary frame, and instant update when crossing a boundary.
- **Props Interface:**
  ```ts
  export interface BoundaryBarProps {
    approveLimit: number;
    hardLimit: number;
    maxDisplay?: number;
    value?: number;              // current spend or marker position
    unit?: string;               // default "$"
    interactive?: boolean;
    onChange?: (value: number) => void;
    onZoneChange?: (zone: "approved" | "held" | "denied") => void;
    confidential?: boolean;      // renders frosted/hatched FHE lock overlay on thresholds
    compact?: boolean;           // slim bar for policy cards & inline rows
  }
  ```
- **Confidential (FHE) variant:** When `confidential={true}` (for FHE-encrypted policies on `/policies` or `/governance/check`), the zone boundary dividers render as **frosted amber lock pins** (`🔒 protected`) with a subtle hatch mask over the exact threshold numbers — visually demonstrating *what FHE protects* without writing a paragraph!
- **Reduced Motion:** Pin jumps directly to position; stamp renders settled without scale/rotation bounce.

---

### Primitive 2: `DisclosureLens` & `SealedEnvelope` (Canton & FHE Privacy Made Visible)
- **Files:**
  - `src/frontend/src/components/primitives/sealed-envelope.tsx`
  - `src/frontend/src/components/primitives/disclosure-lens.tsx`
- **Replaces:** Text-only `PartyView` readout (`party-view.tsx`), two 60-word prose blocks in `RevealComparison` (`reveal-comparison.tsx`), static decorative SVGs in `VisibilityReplay` (`visibility-replay.tsx`).
- **Visual Anatomy (`SealedEnvelope`):**
  - Each vendor bid is a crisp, structured card shaped with a **top envelope fold SVG hairline** + status seal badge.
  - **Three distinct visual states** animated with `MOTION_SPRING.instrument`:
    1. `open` (visible to active party): Crisp card surface, clear vendor name + `tabular-nums` quote amount, open flap fold, subtle emerald/primary accent.
    2. `redacted` (not disclosed on Canton ledger to active party): Card dims to muted surface with a **45° diagonal security-hatch SVG pattern**, envelope flap closes downward (`path` / `scaleY`), amount becomes an etched cipher bar (`████████`), lock seal stamps center, micro-label `"Not on party's ledger"`.
    3. `archived` (losing bid post-reveal on Canton): Envelope shrinks slightly to `opacity: 0.55`, dashed border, diagonal `ARCHIVED` ghost watermark, price permanently absent (`$ —`).
    4. `exposed` (losing bid post-reveal on FHE Option B): Envelope flips open with amber warning border + `"Exposed to manager"` micro-tag.
- **Visual Anatomy (`DisclosureLens`):**
  - Top bar: `"Viewing ledger as"` + `SegmentedControl` (`Auctioneer | Alice | Bob | Charlie`) with gliding `layoutId="party-lens"` highlight pill.
  - Body: Responsive row of `SealedEnvelope` cards that simultaneously open/redact as you click each party.
  - Footer: Single compact status strip (`"1 of 3 contracts returned by participant"`) + collapsible `"Inspect ledger query ▸"` containing the raw `GET /rounds/...` proof string.
- **`RevealComparison` Upgrade:**
  - Replace the two paragraphs with a **live 2-stage mini-animation** controlled by a `layoutId` toggle (`Canton` vs `FHE (Fhenix)`):
  - **Row of 3 envelopes (`Alice`, `Bob`, `Charlie`) → arrow → Result slot (`Winner: Bob $12,400`) + remaining 2 cards**.
  - On **Canton**: Alice & Charlie transition into `archived` ghosts (`$ —`); 1-line caption: *"Losing bids archive on reveal — absent from the result."*
  - On **FHE (Fhenix)**: Alice & Charlie flip to `exposed` amber cards (`$14,200`, `$13,800` visible in Manager pane); 1-line caption: *"Manager decrypts all bids off-chain to pick a winner."*

---

### Primitive 3: `EvidenceFlow` (Live Branching Gate Schematic)
- **File:** `src/frontend/src/components/primitives/evidence-flow.tsx` (absorbs & evolves `components/brand/evidence-chain.tsx`)
- **Replaces:** Static 4-dot `EvidenceChain`, 5-row `setTimeout` vertical text stepper in `SpendFlowDemo` (`spend-flow-demo.tsx`), 4-row spinner checklist during FHE SSE evaluation (`onboarding-wizard.tsx`, `governance-check.tsx`), verbose evidence tag lists in `TimelineNode` (`timeline-node.tsx`).
- **Three Composable Variants:**
  1. **`variant="gate"` (Interactive / Live Pipeline — for `SpendFlowDemo`, `GovernanceCheck` FHE SSE, and Landing Loop):**
     - Clean horizontal SVG schematic (collapses gracefully to vertical on mobile):
       - Node 1: **Intent** (Agent + amount chip)
       - Rail 1→2: animated SVG `motion.path` pulse (`pathLength`) carrying the request into the gate
       - Node 2: **Policy Gate** (Shield octagon; when `fhe={true}`, displays an amber encrypted-lock ring while prover runs; when `governed={false}`, gate opens/dims to dashed outline and packet bypasses straight to `"No audit record"`)
       - Branching Rails 2→3:
         - Top branch (emerald): **Approved → Execute → Receipt**
         - Middle branch (amber): **Held → Operator Inbox**
         - Bottom branch (crimson): **Stopped** (terminates cleanly at a solid vertical stop-bar)
       - Active branch illuminates with `pathLength` draw (`MOTION_DURATION.flow`); inactive branches stay quiet at `20%` opacity.
  2. **`variant="micro-chain"` (Inline Audit Row Strip — for `TimelineNode` & `RecentActivity`):**
     - Compact 120px horizontal node-and-wire indicator showing the 4 evidence stages as crisp 14px glyph nodes (`Policy` → `Privacy/FHE` → `On-chain` → `Receipt`) — filled/colored when proven, hollow/muted when absent, with instant hover tooltip per node. Replaces 4 wordy text badges per audit row.
  3. **`variant="loop"` (5-Stage Interactive Mandate Loop — for Landing Page):**
     - Interactive connected schematic (`Fund → Act → Spend → Outcome → Allocate` with a subtle return arc from `Allocate` back to `Fund`), where `Live` stages use solid rails and `Building` stages use crisp dashed rails (`stroke-dasharray="4 4"`). Clicking any stage glides a `layoutId` active ring and swaps the live visual preview canvas below.

---

### Primitive 4: `MandateReservoir` (Treasury, Escrow & HITL Impact Bar)
- **File:** `src/frontend/src/components/primitives/mandate-reservoir.tsx`
- **Replaces:** Monospace `EvidencePacket` text dumps in `InboxPage` (`inbox-page.tsx`), dense numeric lists in `CapitalPage` (`capital-page.tsx`), `ProgramDetail` (`program-detail.tsx`), and `Sponsored Credits`.
- **Visual Anatomy:**
  ```text
  Treasury: Northwind Procurement          62% ──▶ 84% if approved (+$2,200)
  [███████████████][▓▓▓▓▓][░░ +$2,200 ░░][··········]  $10,000 cap
     Consumed       Held    This request    Available
  ```
  - **Stacked proportional bar** with 4 distinct visual fills:
    - `consumed`: Solid `--primary` fill.
    - `pendingOther`: Muted amber diagonal hatch.
    - `proposedDelta` (HITL Inbox mode): Highlighted pulsing-border or high-contrast amber/emerald segment showing the *exact incremental impact* of clicking Approve right now (prevents rubber-stamping!).
    - `remaining`: Quiet `--muted` track.
  - Optional vertical `softCap` tick line with hover readout.
  - All numbers formatted with `tabular-nums` and human currency units.

---

### Primitive 5: `NotaryReceipt` (Tactile Cryptographic Proof Artifact)
- **File:** Upgrades `src/frontend/src/components/ui/decision-receipt.tsx`
- **Replaces:** Flat card layout of `DecisionReceipt` and prose-heavy `ProofSummary` headers on `/verify` (`proof-replay.tsx`).
- **Visual Upgrades:**
  - Subtle **perforated / notched paper-stub header edge** (pure CSS radial-gradient mask or crisp 6px SVG sawtooth/ticket notch on the top/bottom seam) — immediately differentiates a *tamper-evident receipt* from a regular settings card.
  - **Embossed verdict stamp** (`APPROVED` / `HELD` / `STOPPED`) in the top-right corner with `MOTION_SPRING.stamp`.
  - Replaces the 5 boxed text tiles (`Request / Policy / Decision / Evidence / Record`) with a sleek horizontal **5-node connected timeline wire** (`EvidenceFlow` mini-strip) so the lifecycle reads in one eye-sweep instead of 5 micro-cards.
  - Monospace proof hash + **morphing Copy button** (`Copy icon → Checkmark` via `AnimatePresence` + `scale`) + deep-link explorer pill.

---

### Primitive 6: `SchematicPlate` (6 Cohesive Architectural SVG Illustrations)
- **Directory:** `src/frontend/src/components/illustrations/`
  - `plate-frame.tsx` (shared responsive 240×140 canvas, subtle faint blueprint crosshair ticks in corners, optional subtle `pathLength` draw-in on mount)
  - `empty-audit-plate.tsx` — Open evidence chain with 3 faint ghost links waiting for Link #1 to snap into the shield socket. Replaces the 10-second `curl` typewriter in `EmptyAuditState` (move `curl` behind a compact `"Or send via curl ▸"` toggle!).
  - `empty-inbox-plate.tsx` — Calm balanced gate beam / cleared tray with an emerald equilibrium dot ("Queue clear — nothing waiting on judgment").
  - `empty-policy-plate.tsx` — Open horizontal ruler with floating unpinned guard brackets waiting for their first threshold.
  - `empty-sealed-bid-plate.tsx` — Three isometric folded envelopes orbiting a central shield lock.
  - `empty-spend-plate.tsx` — Unfunded mandate reservoir vessel connected by a dotted conduit to an agent node.
  - `onboarding-plate.tsx` — Reactive 4-state schematic driven by `step` (`0: Keycard → 1: Live BoundaryBar responding to Strict/Moderate/Relaxed → 2: Agent Identity Node linking to Key → 3: Live Shield Gate`), replacing static 48px Lucide icons in `OnboardingWizard`.
- **Integration with `PageState` (<ref_file file="/Users/udingethe/Dev/cognivern/src/frontend/src/components/ui/error-state.tsx" />):** Add optional `illustration?: ReactNode` prop to `PageState`, retiring the ubiquitous gray `HelpCircle` circle on every empty state.

---

### Primitive 7: `AmbientModeChrome` (Spatial Mode Framing Replacing 5× Banners)
- **File:** Upgrades `src/frontend/src/components/layout/demo-banner.tsx` + `src/frontend/src/components/layout/app-sidebar.tsx`
- **How It Works:**
  - **One unified top hairline + slim 36px chrome bar** across the dashboard shell:
    - **Demo / Sandbox:** Crisp **2px amber top hairline** across the entire viewport (`bg-amber-500/80`) + subtle amber-tinted 36px bar with a single `FlaskConical` icon, compact label `Sandbox`, a 3-word cue (`Sample data only`), and one `Switch to Production →` button.
    - **Production:** Quiet **2px emerald/sky top hairline** (no bulky bar taking vertical space; mode switch lives cleanly in the sidebar `ModeSwitch`).
  - **Deleted redundancy:**
    - Remove the infinite-shimmer `Demo Mode` animated box in `AppSidebar` (<ref_snippet file="/Users/udingethe/Dev/cognivern/src/frontend/src/components/layout/app-sidebar.tsx" lines="123-138" />).
    - Remove the `"Demo workspace · Sample data · No real funds can move"` subtitle in `Dashboard` (<ref_snippet file="/Users/udingethe/Dev/cognivern/src/frontend/src/components/dashboard/dashboard.tsx" lines="160-165" />).
    - Remove the `"Nothing in demo mode moves real funds"` disclaimer in `WorkspaceNextAction`.
    - Convert `WelcomeOverlay` (<ref_file file="/Users/udingethe/Dev/cognivern/src/frontend/src/components/ui/welcome-overlay.tsx" />) from an auto-popping modal on load to an explicit `"Take interactive tour"` trigger in Help / Demo bar so visitors land immediately in the live product.
    - Remove the redundant `WorkspaceStatusLine` prose banner on `SealedBidPage` when already covered by `AmbientModeChrome` (keep only a compact inline `Canton live` / `Settlement pending` dot-badge beside the header).

---

### Primitive 8: `TactileFeedback` (Shared Motion & Sensory Micro-Primitives)
- **Files:**
  - `src/frontend/src/components/primitives/segmented-control.tsx` — Reusable `layoutId` segmented toggle (used across `PartyView`, `RevealComparison`, `SealedBidPage` filters, `AuditPage` filters, `VisibilityReplay` role/phase selectors, `ModeSwitch`).
  - `src/frontend/src/components/primitives/animated-value.tsx` — Thin wrapper around `@number-flow/react` (or `motion-number`, +2.6KB on top of `motion`) with `tabular-nums`, configured to **skip mount animation** (`willChange` off by default, instant first paint) and roll smoothly *only* when values change interactively (slider drags, live SSE updates, budget impact previews).
  - `src/frontend/src/lib/tactile-sound.ts` — Optional, **off-by-default** Web Audio API synthesizer (~45 LOC, zero media assets):
    - `playDetent()`: 12ms filtered soft click when dragging `BoundaryBar` across a threshold tick.
    - `playStamp(outcome)`: subtle low-pass thud (approved/stopped) or soft double-chime (held).
    - `playSeal()`: crisp 20ms latch click when sealing a bid or toggling Canton party lens.
    - Persisted in `preferences-store` (`soundEnabled: boolean`, default `false`); respects user gesture & reduced-motion; exposed as a subtle mute/unmute icon in Settings and on the Landing interactive demo card.

---

## 5. Surface-by-Surface Transformation Matrix

Every major surface in `src/frontend/src`, mapped from its exact current files to its target visual/motion architecture and copy budget:

### 5.1 Landing Page (`/`)
- **Files:** `src/frontend/src/components/landing/landing-page.tsx`, `src/frontend/src/components/governance/decision-preview.tsx`
- **Current Problems:** 1,334 LOC, 9 vertical bands, 42-word hero subtitle, permanently pulsing `"Checking policy"` badge, unbanded slider with instruction sentence, `"Decision updated"` generic blue stamp, 4 redundant lines in `DecisionPreview`, and **12 text cards across 3 consecutive sections** (`The loop`, `How it works`, `Jobs to be done`) repeating the same concept.
- **Target Architecture (5 Variegated Bands):**
  1. **Band 1 — Hero + Interactive Boundary Instrument:**
     - Headline kept sharp (`Delegate consequential work. Keep judgment in the loop.`).
     - Subtitle trimmed to **≤ 16 words**: *"Set the limits once. Agents handle routine spend; exceptions pause for your call — with public proof."*
     - Primary CTA (`Try a governed request`) + Secondary (`Inspect a live run → /verify`). Move `"How it works"` ghost button out (sticky nav already handles it).
     - **Interactive Card:** Remove permanent `"Checking policy"` amber pulse (show live verdict dot instead). Replace plain range input with **piecewise `BoundaryBar`** (`$0–$100` green | `$100–$3,000` amber | `$3,000+` red) + `AnimatedValue` dollar readout + semantic **`DecisionStamp`** (`APPROVED` / `HELD` / `STOPPED`) + 1-line rule reason. Optional mute/sound toggle in card corner for tactile threshold detents.
  2. **Band 2 — Proof, Not Promise (Visual Decision-Flip Showcase):**
     - Keep live fetched `/evidence/diligence/supplier-diligence.json` stats, but replace the 3 plain text stat boxes + single inline link with a **side-by-side visual split card**:
       - Left pane (`Model alone`): Supplier card (`Viktor Anatolyevich Bout`) + `reject` chip.
       - Center animated gate arrow (`+ specialist evidence + policy`).
       - Right pane (`Governed`): Same supplier + `hold` stamp + compact `NotaryReceipt` hash strip + `Inspect full replay → /verify`.
     - Visitors *see* governance changing a real decision visually before clicking.
  3. **Band 3 — One Interactive Loop Explorer (Merges *The loop* + *How it works* + *Jobs to be done*):**
     - **Kills 12 repetitive text cards** and replaces them with `EvidenceFlow variant="loop"`:
       - Top: Interactive 5-stage connected rail (`01 Fund` · `02 Act` · `03 Spend` · `04 Outcome` · `05 Allocate`) with `layoutId` active ring and solid (`live`) vs dashed (`building`) rails.
       - Bottom: Single live visual canvas that swaps smoothly (`AnimatePresence`) to show the actual primitive for that stage:
         - *Fund* → Mini `MandateReservoir` bar
         - *Act* → Mini `BoundaryBar` + Policy Gate
         - *Spend* → Mini `NotaryReceipt` stub
         - *Outcome* → Mini verified-signal confidence gauge
         - *Allocate* → Mini tranche-unlock schematic
     - Zero walls of text; 1 short caption per stage.
  4. **Band 4 — Developer API & Interactive Use-Case Switcher:**
     - Merge *For developers* and *Use cases* into a split 2-column showcase:
       - Left: `SegmentedControl` (`Payments | Procurement | Ops | Treasury`) switching a crisp live mini-artifact (e.g., Procurement shows 3 mini `SealedEnvelope` cards; Payments shows a held `BoundaryBar`; Treasury shows a blocked stop-bar) + 1-line description.
       - Right: Live synced `curl` snippet + compact verdict JSON (updates when you switch the use-case tab!) with morphing Copy button.
     - Retire the redundant `"What you can count on"` 3-number band and `"Who it's for"` 3-text-card grid (the 4 use-case tabs already answer who it's for).
  5. **Band 5 — Compact Audience Doors (`/sponsor`, `/procure`) + Final CTA:**
     - Two sleek side-by-side cards (each with a tiny 48×48 schematic icon + 1-line pitch + link) instead of two full-width stacked banners, followed by a tight Final CTA.

### 5.2 Dashboard (`/dashboard`)
- **Files:** `dashboard.tsx`, `dashboard-stats.tsx`, `quick-check.tsx`, `workspace-next-action.tsx`, `setup-checklist.tsx`, `operating-insights.tsx`, `recent-activity.tsx`
- **Changes:**
  - **Kill the 5× Demo/Sandbox text stack** (handled by `AmbientModeChrome`; remove `WelcomeOverlay` auto-modal).
  - **`DashboardStats`:** Remove `useCountUp(..., 2000)` and `IntersectionObserver` delay — render numbers immediately with `tabular-nums`, and surface a **thin inline decision-mix proportion bar** (emerald / amber / red segments right inside the KPI strip) so visual posture is visible *above the fold* even while the heavy Recharts charts remain cleanly collapsed in `OperatingInsights`.
  - **`QuickCheck`:** Embed a compact `BoundaryBar` showing where `$50`, `$500`, or `$5,000` lands on the workspace's active limits; animate the Check button through `Checking → Verdict`.
  - **`SetupChecklist`:** Replace static 4-row vertical list with a sleek horizontal **4-node visual progress rail** (`Boundary → Identity → Key → First Check`) with `pathLength` progress fill, showing only the *active* step's 1-line action card below (cutting vertical height by ~45%).
  - **`RecentActivity`:** Add compact `EvidenceFlow variant="micro-chain"` icons on each row so operators spot on-chain / FHE / held status visually at a glance.

### 5.3 Private Vendor Selection (`/sealed-bid`) & Public Proof (`/verify`)
- **Files:** `sealed-bid-page.tsx`, `party-view.tsx`, `reveal-comparison.tsx`, `round-detail.tsx`, `visibility-replay.tsx`, `diligence-verify.tsx`, `proof-replay.tsx`
- **Changes:**
  - **`SealedBidPage` header diet:** Cut the 5 stacked prose blocks above the rounds list down to **1 compact `PageHeader` (≤10 words) + 1 inline status pill** (`Canton connected` / `Sandbox` + `Get bidding identity` chip when unauthenticated). Move the `Agent round vs Manual` explanation inside the creation drawer/popover at the moment of choice.
  - **`PartyView` & `VisibilityReplay`:** Replace static envelopes and raw API-request lead-in with **`DisclosureLens` + `SealedEnvelope`**. Every party toggle visibly opens/redacts the bid cards in place.
  - **`RevealComparison`:** Replace the two 60-word paragraphs with the **Canton vs FHE animated 3-envelope reveal diff**.
  - **`DiligenceVerify` (`/verify?report=supplier-diligence`):** Replace text-heavy summary envelope with `NotaryReceipt`-styled header, add `layoutId` to `ChipGroup`, and add a subtle animated highlight connecting `Alone` verdict → `Governed` verdict when auto-stepping (`"Watch the story"`).
  - **Empty rounds state:** Render `EmptySealedBidPlate` schematic + 1 CTA (`New agent round`) + secondary (`Replay sample round`).

### 5.4 Escalation Inbox (`/inbox`)
- **Files:** `src/frontend/src/components/inbox/inbox-page.tsx`
- **Changes:**
  - Replace the dashed monospace `EvidencePacket` dump with **`MandateReservoir`** showing exact before→after treasury commitment (`62% → 84%`) + explicit **Reversibility Badge** (`Irreversible on-chain broadcast` in amber/crimson vs `Reversible`) + compact trigger tag (`Exceeded $100 soft limit`).
  - Wrap inbox items in `<AnimatePresence>` with `layout` so approving/rejecting stamps the item (`APPROVED` / `REJECTED`), smoothly collapses it out of the queue, and updates the header counter with `AnimatedValue`.
  - Empty inbox state: `EmptyInboxPlate` ("Queue clear — all agent actions are within policy").

### 5.5 Policies (`/policies`) & Governance Check (`/governance/check`)
- **Files:** `policies-page.tsx`, `governance-check.tsx`, `confidential-spend-try.tsx`
- **Changes:**
  - **Remove raw emojis** (`🔒`, `⚖️`, `📋`, `👤`) from `POLICY_TEMPLATES`; use crisp Lucide icons + mini preview `BoundaryBar` on every template card.
  - **Format `wei` thresholds** to human units (e.g. `$500` / `0.1 ETH`) and render a **compact `BoundaryBar`** on every active policy card (`confidential={policy.confidential}` activates the frosted FHE lock mask on thresholds).
  - **`GovernanceCheck`:** Wire `BoundaryBar` into the request form so typing/speaking an amount moves the pin live *before* clicking Check, and wire `EvidenceFlow variant="gate"` to live FHE SSE progress steps.

### 5.6 Audit Trail (`/audit`)
- **Files:** `audit-page.tsx`, `timeline-node.tsx`, `empty-audit-state.tsx`, `event-timeline.tsx`
- **Changes:**
  - **`EmptyAuditState`:** Replace the 10-second `curl` typewriter with `EmptyAuditPlate` + instant `"Run a check"` CTA + collapsible `"Or send via curl ▸"` code block.
  - **`AuditPage` filter bar:** Upgrade status & group-by tabs to `SegmentedControl` (`layoutId`).
  - **`TimelineNode`:** Add compact `EvidenceFlow variant="micro-chain"` to collapsed rows; render expanded proof in the upgraded `NotaryReceipt` visual format; use smooth height/opacity disclosure (`MOTION_EASE.out`, `180ms`).
  - **`EventTimeline`:** Animate the active playhead ring using `layoutId="timeline-playhead"` so stepping/playing through replay events glides smoothly down the list.

### 5.7 Spend & Outcomes (`/spend`), Programs (`/programs/[id]`), & Sponsored Credits (`/sponsor/credits`)
- **Files:** `capital-page.tsx`, `program-detail.tsx`, `programs-page.tsx`, `credit-program-detail.tsx`
- **Changes:**
  - Replace dense numeric allocation text rows with **`MandateReservoir`** proportional bars.
  - Add a compact visual **`SpendPathStrip`** upgrade (`src/frontend/src/components/ui/spend-path-strip.tsx`) using connected schematic nodes with semantic status dots instead of 4 flat gray boxes with ASCII `→` arrows.
  - Empty states use `EmptySpendPlate`.

### 5.8 Verified Signals (`/telegraph`), Onboarding (`/onboarding`), & App Shell
- **Files:** `telegraph-page.tsx`, `onboarding-wizard.tsx`, `app-sidebar.tsx`, `providers.tsx`, `(dashboard)/layout.tsx`, `page-transition.tsx`
- **Changes:**
  - **`TelegraphPage`:** Merge header + `-mt-4` footnote + `<aside>` worked example into 1 crisp `PageHeader` (≤12 words) + a compact visual **Confidence Gate Bar** (`0% ─── threshold ─── 100%`) beside the worked-example chip (`Northwind: held at 42% confidence → Inspect`).
  - **`OnboardingWizard`:** Add reactive `OnboardingPlate` at the top of the card; on Step 2, clicking *Strict / Moderate / Relaxed* animates a live `BoundaryBar` showing the exact auto/hold/stop split; replace raw FHE step spinner list on Step 4 with `EvidenceFlow variant="gate"`.
  - **`AppSidebar`:** Remove hover-only etymology tooltip (`Cogni-vern: ...`), move `"Powered by OWS"` out of the brand lockup into Settings/About, remove the continuously repainting `Demo Mode` shimmer chip, and add subtle `layoutId="sidebar-active-indicator"` (2px vertical primary bar) on active nav items.
  - **`Providers` & `PageTransition`:** Remove `framer-motion`, wrap root in `<MotionConfig reducedMotion="user">`, sync RainbowKit theme to light/dark + sky-blue primary, and drop `mode="wait"` exit blocking from `(dashboard)/layout.tsx`.

---

## 6. Phased Execution Checklists (PR-by-PR)

### Phase 0 — Motion & Token Foundation (1 PR)
> **Rails touched:** Frontend only (`src/frontend`) · **Goal:** Clean dependency graph, zero route lag, unified motion tokens & brand color alignment.

- [ ] Remove `"framer-motion"` from `src/frontend/package.json` and update lockfile (verify zero remaining `framer-motion` imports via `grep`).
- [ ] Create `src/frontend/src/lib/motion-tokens.ts` with `MOTION_EASE`, `MOTION_SPRING`, and `MOTION_DURATION`.
- [ ] Wrap root tree in `<MotionConfig reducedMotion="user">` in `src/frontend/src/components/providers.tsx`.
- [ ] Sync `RainbowKitProvider` theme in `providers.tsx` to `next-themes` (`lightTheme` / `darkTheme`) with Cognivern sky-blue accent (`#0284c7` / `#38bdf8`) instead of hardcoded `#7c3aed`.
- [ ] Update `src/frontend/src/app/(dashboard)/layout.tsx` and `src/frontend/src/components/ui/page-transition.tsx`: remove `<AnimatePresence mode="wait">` exit blocking; use fast non-blocking `120ms` opacity + `4px` settle (respecting reduced motion).
- [ ] Create `src/frontend/src/components/primitives/segmented-control.tsx` (`layoutId` spring pill with `MOTION_SPRING.snappy`, full `role="group"` / `aria-pressed` keyboard accessibility).
- [ ] Add `layoutId="sidebar-active-indicator"` to active nav items in `app-sidebar.tsx`.
- [ ] **Verify:** `pnpm --filter cognivern-frontend typecheck && pnpm --filter cognivern-frontend lint`; confirm route switching across 5 sidebar items feels instant (<150ms) and zero `framer-motion` remains in bundle.

---

### Phase 1 — Copy Diet, Idle-Loop Purge & `AmbientModeChrome` (1–2 PRs)
> **Rails touched:** Frontend only (`src/frontend`) · **Goal:** Immediate 40% reduction in visual noise and prose clutter before adding a single new visual widget.

- [ ] Upgrade `demo-banner.tsx` into `AmbientModeChrome`: crisp 2px amber top hairline + single slim 36px Sandbox bar; quiet 2px emerald/sky top hairline in Production.
- [ ] Delete the 4 redundant Sandbox/Demo disclaimers:
  - [ ] Remove infinite-ping/shimmer `Demo Mode` box in `app-sidebar.tsx` (lines 123–138) and unused `@keyframes pulse-bg` in `globals.css`.
  - [ ] Remove `"Demo workspace · Sample data · No real funds can move"` subtitle in `dashboard.tsx` (lines 160–165).
  - [ ] Trim `"Nothing in demo mode moves real funds"` from `workspace-next-action.tsx`.
  - [ ] Disable auto-opening `WelcomeOverlay` on mount (`welcome-overlay.tsx`); expose as an optional `"Interactive tour"` action only.
- [ ] Clean `AppSidebar` header: remove hover etymology tooltip (`Cogni-vern: ...`) and `"Powered by OWS"` essay tooltip (move OWS note to Settings).
- [ ] Fix `DashboardStats` (`dashboard-stats.tsx`): remove 2,000ms `useCountUp` mount delay and `IntersectionObserver` `—` blanking; render final values immediately with `tabular-nums`, plus add a 6px inline emerald/amber/red decision-mix proportion bar inside the strip.
- [ ] Remove permanent amber pulsing `"Checking policy"` badge in `landing-page.tsx` (lines 533–536); replace with static live-outcome indicator dot.
- [ ] Collapse `DecisionPreview` (`decision-preview.tsx`) from 4 stacked lines to `Verdict + 1 specific reason` (drop generic `OUTCOME_COPY[resolved].blurb` when `reasoning` is present).
- [ ] Trim stacked prose headers on:
  - [ ] `sealed-bid-page.tsx` (collapse 5 blocks above list → 1 `PageHeader` ≤10 words + compact inline Canton status chip; move Agent-vs-Manual copy into creation flow).
  - [ ] `telegraph-page.tsx` (collapse header + `-mt-4` footnote + `<aside>` → 1 `PageHeader` ≤12 words + compact single-line worked-example strip).
- [ ] Clean `policies-page.tsx`: replace raw Unicode emojis (`🔒`, `⚖️`, `📋`, `👤`) with Lucide icons; format raw `wei` approval thresholds into human-readable units.
- [ ] **Verify:** Visual screenshot sweep of `/`, `/dashboard`, `/sealed-bid`, `/policies`, `/telegraph` in light + dark mode; confirm 0 infinite idle animations; confirm Playwright smoke specs pass.

---

### Phase 2A — `BoundaryBar` & `DecisionStamp` Primitive (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Turn policy thresholds from prose into an unmistakable calibrated instrument.

- [ ] Build `src/frontend/src/components/primitives/boundary-bar.tsx`:
  - [ ] Piecewise 3-zone track (`approved` emerald / `held` amber / `denied` crimson) with calibrated tick notches.
  - [ ] Interactive slider overlay (`aria-label`, `aria-valuetext`, keyboard step support) + spring pin (`MOTION_SPRING.instrument`).
  - [ ] Compact read-only mode (`compact`) for Policy Cards & QuickCheck.
  - [ ] `confidential` FHE variant with frosted amber lock pins + diagonal hatch mask over hidden threshold numerals.
- [ ] Build `src/frontend/src/components/primitives/decision-stamp.tsx` (`APPROVED` / `HELD` / `STOPPED` semantic notary stamp with `MOTION_SPRING.stamp`, zero bounce under reduced motion).
- [ ] Wire `BoundaryBar` + `DecisionStamp` into:
  - [ ] `landing-page.tsx` hero live demo (delete `"Drag past $100..."` helper sentence; replace `"Decision updated"` stamp).
  - [ ] `policies-page.tsx` (template cards + active policy cards).
  - [ ] `onboarding-wizard.tsx` (Step 2 policy picker — animates live across Strict / Moderate / Relaxed).
  - [ ] `quick-check.tsx` and `governance-check.tsx` (live marker glides as user types/picks an amount).
- [ ] **Verify:** Unit test piecewise mapping & zone resolution; Playwright drag test on `/` verifying all 3 zones + stamp labels; light/dark + reduced-motion screenshots.

---

### Phase 2B — `DisclosureLens` & `SealedEnvelope` Primitive (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Make Canton sub-transaction privacy and Canton-vs-FHE reveal differences perceptible in 2 seconds.

- [ ] Build `src/frontend/src/components/primitives/sealed-envelope.tsx` with 4 animated states (`open`, `redacted`, `archived`, `exposed`), SVG top-flap geometry, diagonal security-hatch SVG pattern, and lock/seal badge.
- [ ] Build `src/frontend/src/components/primitives/disclosure-lens.tsx` combining `SegmentedControl` (`layoutId="party-lens"`) + grid of `SealedEnvelope` cards + collapsible `"Ledger query proof ▸"` drawer.
- [ ] Refactor `src/frontend/src/components/sealed-bid/party-view.tsx` to render `DisclosureLens` driven by real live Canton participant responses (preserving exact backend disclosure semantics — zero UI faking!).
- [ ] Refactor `src/frontend/src/components/verify/visibility-replay.tsx` to render `DisclosureLens` + `SealedEnvelope` (retiring the 3 static 74×48 envelopes).
- [ ] Refactor `src/frontend/src/components/sealed-bid/reveal-comparison.tsx` into the animated 3-envelope Canton-vs-FHE reveal diff (cutting ~110 words to ~15 words).
- [ ] **Verify:** Playwright test clicking through `Auctioneer / Alice / Bob / Charlie` on `/verify?round=sandbox-replay` and `/sealed-bid`; screenshot matrix verifying redacted vs open vs archived vs exposed states.

---

### Phase 2C — `EvidenceFlow` & `NotaryReceipt` Primitives (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Upgrade `EvidenceChain` and `DecisionReceipt` into live causal & physical-proof primitives.

- [ ] Build `src/frontend/src/components/primitives/evidence-flow.tsx` supporting:
  - [ ] `variant="gate"` (Intent → Policy Gate [with FHE lock pulse or ungoverned bypass] → 3 branching outcome rails with `pathLength` packet traversal).
  - [ ] `variant="micro-chain"` (compact 4-node inline evidence wire for Audit & Recent Activity rows).
  - [ ] `variant="loop"` (5-stage interactive Mandate Loop with solid `live` vs dashed `building` rails and `layoutId` active node).
- [ ] Wire `EvidenceFlow`:
  - [ ] Replace `SpendFlowDemo`'s vertical text stepper (`spend-flow-demo.tsx`) with `variant="gate"` (Governed vs Ungoverned toggle visibly removes/engages the shield gate).
  - [ ] Wire `variant="gate"` to FHE SSE step progress in `governance-check.tsx` and `onboarding-wizard.tsx`.
  - [ ] Add `variant="micro-chain"` to collapsed rows in `timeline-node.tsx` and `recent-activity.tsx`.
  - [ ] Upgrade `setup-checklist.tsx` to a horizontal 4-node connected progress rail.
- [ ] Upgrade `src/frontend/src/components/ui/decision-receipt.tsx` into `NotaryReceipt` style (subtle serrated/notched proof seam, semantic `DecisionStamp`, horizontal 5-node wire replacing 5 nested boxes, morphing Copy button).
- [ ] Upgrade `src/frontend/src/components/ui/spend-path-strip.tsx` to use connected node-and-wire visual rail instead of gray boxes + ASCII arrows.
- [ ] Upgrade `src/frontend/src/components/shared/event-timeline.tsx` with `layoutId="timeline-playhead"` smooth stepping highlight.
- [ ] **Verify:** Run `/demo/spend` (Governed + Ungoverned × Approve/Hold/Deny), inspect `/audit` collapsed + expanded nodes, and verify reduced-motion static states.

---

### Phase 2D — `MandateReservoir` Primitive & HITL Inbox Upgrade (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Eliminate monospace dumps in approvals and make treasury/budget state spatially legible.

- [ ] Build `src/frontend/src/components/primitives/mandate-reservoir.tsx` (stacked `consumed` + `pendingOther` + highlighted `proposedDelta` + `remaining` bar, optional soft-cap tick, `tabular-nums` before→after percentage readout).
- [ ] Refactor `src/frontend/src/components/inbox/inbox-page.tsx`:
  - [ ] Replace monospace `EvidencePacket` with `MandateReservoir` delta preview + Reversibility Badge (`Irreversible on-chain` vs `Reversible`) + 1-line trigger chip.
  - [ ] Animate approval/rejection with `<AnimatePresence>` + `layout` smooth collapse into stamped confirmation.
- [ ] Wire `MandateReservoir` into `capital-page.tsx`, `program-detail.tsx`, and `credit-program-detail.tsx`.
- [ ] **Verify:** Screenshot `/inbox` with pending escalation showing before→after treasury shift; verify approve/reject animation and empty-queue transition.

---

### Phase 3 — Architectural Illustration System (`SchematicPlate`) (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Give Cognivern a distinctive visual signature on every empty state and onboarding step without heavy assets or generic cartoon art.

- [ ] Create `src/frontend/src/components/illustrations/plate-frame.tsx` (shared 240×140 SVG blueprint frame with subtle corner registration ticks and optional reduced-motion-safe `pathLength` draw-in).
- [ ] Author the 6 token-native 1.5px-stroke plates:
  - [ ] `empty-audit-plate.tsx` (open chain awaiting Link #1)
  - [ ] `empty-inbox-plate.tsx` (calm balanced gate — "Queue clear")
  - [ ] `empty-policy-plate.tsx` (open threshold rail awaiting pins)
  - [ ] `empty-sealed-bid-plate.tsx` (three folded envelopes + shield lock)
  - [ ] `empty-spend-plate.tsx` (mandate reservoir + agent conduit)
  - [ ] `onboarding-plate.tsx` (4-step reactive schematic)
- [ ] Add `illustration?: ReactNode` to `PageState` (`src/frontend/src/components/ui/error-state.tsx`) and retire the default `HelpCircle` circle on all empty states.
- [ ] Replace the 10-second `curl` typewriter in `src/frontend/src/components/audit/empty-audit-state.tsx` with `EmptyAuditPlate` + instant CTA + collapsible `"Or send via curl ▸"` code snippet.
- [ ] Wire `OnboardingPlate` into `onboarding-wizard.tsx`.
- [ ] **Verify:** Light mode + dark mode visual check across all 6 empty states & all 4 onboarding steps; verify zero raster bloat and clean SVG scaling at 1x/2x DPI.

---

### Phase 4 — Landing Page Compression & Interactive Loop (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Cut landing page length and verbosity in half while turning it into an interactive explorable showcase.

- [ ] Compress `src/frontend/src/components/landing/landing-page.tsx` from 9 bands → 5 bands:
  - [ ] **Band 1:** Trimmed hero copy (≤16-word subtitle) + upgraded `BoundaryBar` / `DecisionStamp` demo.
  - [ ] **Band 2:** Visual `Alone → Governed` decision-flip card pulling live `/evidence/diligence/supplier-diligence.json` data + compact `NotaryReceipt` teaser.
  - [ ] **Band 3:** Single interactive `EvidenceFlow variant="loop"` explorer replacing *The loop* (5 cards) + *How it works* (4 nodes) + *Jobs to be done* (3 cards).
  - [ ] **Band 4:** Tabbed Use-Case + Live API split (`Payments | Procurement | Ops | Treasury`) syncing a visual mini-primitive with live `curl` + JSON response (replaces alternating rows + `"What you can count on"` + `"Who it's for"`).
  - [ ] **Band 5:** Side-by-side compact `/sponsor` and `/procure` cards + Final CTA.
- [ ] Update sticky header anchor links to match the compressed 5-band spine (`#proof`, `#the-loop`, `#use-cases`, `/verify`).
- [ ] **Verify:** Measure desktop + mobile full-page height (target ≥35% shorter) and rendered word count (target ≥45% fewer words); verify zero horizontal overflow on 375px mobile; verify `/verify` deep links and auth redirect intact.

---

### Phase 5 — Optional Delight Layer: Kinetic Digits & Opt-In Micro-Audio (1 PR)
> **Rails touched:** Frontend (`src/frontend`) · **Goal:** Tactile polish that differentiates Cognivern from static dashboards without sacrificing enterprise restraint.

- [ ] Evaluate & add `@number-flow/react` (or `motion-number`, checking npm release age ≥7 days per security policy) wrapped in `src/frontend/src/components/primitives/animated-value.tsx` — strictly disabled on initial mount, active *only* on live/interactive numeric changes (hero slider `$amount`, live SSE counters, Inbox treasury delta).
- [ ] Implement `src/frontend/src/lib/tactile-sound.ts` (pure Web Audio API synthesized micro-detents, ~45 LOC, 0KB media) gated behind `preferences-store.soundEnabled` (default `false`) + subtle speaker toggle in Settings and Landing Hero demo card.
- [ ] Upgrade `AuditPage` (`audit-page.tsx`), `SealedBidPage`, and `DiligenceVerify` filter groups to `SegmentedControl` (`layoutId`).
- [ ] *(Optional future spike)* Evaluate a single <60KB `.riv` Rive state machine *only* if the landing hero or sealed-bid reveal later wants articulated mechanical animation beyond inline SVG + `motion/react`. Do **not** add `@rive-app/react-canvas` unless a bespoke `.riv` asset is authored first.
- [ ] **Verify:** Verify sound stays completely silent unless explicitly toggled on; verify zero CLS on `AnimatedValue`; check frontend production build bundle delta (`next build`).

---

## 7. Verification & Anti-Slop Quality Gates

Run this checklist before closing any phase PR:

1. **The "Mute the Copy" Test:** Blur all paragraph text on a screenshot at 6px. Can a new visitor still tell (a) which mode they are in, (b) whether the workspace is healthy or needs attention, (c) where the policy thresholds sit, and (d) which bids are private vs visible? If not, the visual primitive isn't carrying enough weight.
2. **The Word-Budget Gate:** No `PageHeader` > 12 words; no stacked prose banners; zero `"Nothing here moves real funds"` copies outside `AmbientModeChrome`.
3. **The Restraint & Physics Gate:** Zero `bounce > 0` on menus/tabs/filters/drawers; zero `mode="wait"` route exits; zero 2s mount count-ups; zero idle infinite pulses/shimmers (`AGENTS.md`).
4. **The `prefers-reduced-motion` Gate:** Toggle `Emulate CSS media feature prefers-reduced-motion: reduce` in DevTools / Playwright — every primitive must still communicate state clearly via static color, hatch, lock, and spatial position.
5. **The Dual-Theme Optical Gate:** Inspect every new SVG primitive (`BoundaryBar`, `SealedEnvelope`, `EvidenceFlow`, `MandateReservoir`, `SchematicPlate`, `NotaryReceipt`) in both **Light** and **Dark** mode on `.app-surface` to verify stroke legibility and contrast.
6. **The Contract Alignment Gate:** Confirm `deriveWorkspaceState` (`docs/ADAPTIVE_UX.md`) remains the single adaptive source of truth on `/dashboard` and all existing Playwright / TestSprite specs stay green.
