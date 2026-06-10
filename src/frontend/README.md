# Cognivern Frontend

Next.js dashboard for the Cognivern AI Agent Governance Platform.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **State:** Zustand stores (`auth-store`, `demo-store`, `preferences-store`)
- **Data Fetching:** SWR with custom hooks (`use-api.ts`)
- **UI Components:** Custom `shadcn/ui` component library (`@/components/ui/*`)
- **Charts:** Recharts (`activity-chart`, `decision-chart`, `agent-status-chart`)
- **Auth:** SIWE (Sign-In with Ethereum) via RainbowKit/wagmi + email auth
- **Styling:** Tailwind CSS
- **WebSocket:** Real-time events via `use-socket.ts` hook

## Project Structure

```
src/frontend/
├── app/                          # Next.js App Router pages
│   ├── (dashboard)/              # Authenticated dashboard layout
│   │   ├── layout.tsx            # Sidebar + banner + error boundary
│   │   ├── dashboard/            # Main dashboard page
│   │   ├── audit/                # Audit log page
│   │   ├── governance/check/     # Governance check page
│   │   ├── policies/             # Policy management
│   │   ├── agents/               # Agent management
│   │   ├── settings/             # Workspace settings & API keys
│   │   ├── os/                   # Command Center terminal UI
│   │   ├── demo/spend/           # Spend flow demo
│   │   └── runs/                 # Run ledger
│   ├── onboarding/               # Onboarding wizard
│   └── landing/                  # Public landing page
├── src/
│   ├── components/
│   │   ├── audit/                # AuditPage, decision detail panel
│   │   ├── dashboard/            # Dashboard, stat cards, charts, quick check
│   │   ├── governance/           # GovernanceCheck (NL input, voice, results)
│   │   ├── demo/                 # SpendFlowDemo (governed/ungoverned toggle)
│   │   ├── layout/               # AppSidebar, DemoBanner, CommandPalette
│   │   ├── onboarding/           # OnboardingWizard
│   │   ├── settings/             # SettingsPage, API key management
│   │   ├── policies/             # Policy CRUD
│   │   └── ui/                   # shadcn/ui primitives (button, card, etc.)
│   ├── hooks/
│   │   ├── use-api.ts            # SWR hooks for agents, audit logs, policies
│   │   ├── use-auth.ts           # Auth login/logout/session management
│   │   ├── use-socket.ts         # SSE event stream hook
│   │   ├── use-demo-simulator.ts # Demo mode real-time simulation
│   │   └── use-voice-input.ts    # Web Speech API voice input
│   ├── lib/
│   │   ├── api-client.ts         # Typed fetch wrapper for all API endpoints
│   │   ├── normalizers.ts        # Data normalization (audit logs, decisions)
│   │   ├── nav-items.ts          # Sidebar navigation structure
│   │   ├── demo-data.ts          # Static demo data (agents, logs, policies)
│   │   └── swr-config.ts         # SWR global configuration
│   └── stores/
│       ├── auth-store.ts         # Authentication state (persisted)
│       ├── demo-store.ts         # Demo mode state
│       └── preferences-store.ts  # User preferences (persisted)
└── public/
```

## Key User Journeys

### The Evaluator ("Is this real?")
1. Lands on homepage → hits demo
2. Watches SpendFlowDemo governed/ungoverned toggle (`/demo/spend`)
3. Runs a GovernanceCheck with preset values (`/governance/check`)
4. Sees approved/denied with per-rule breakdown
5. Understands the product in under 5 minutes

### The Integration Engineer ("Ship governance this week")
1. Signs in with wallet or email
2. Creates a policy in 3 clicks (`/policies`)
3. Registers an agent (`/agents/workshop`)
4. Gets an API key (`/settings`)
5. Calls `/api/governance/evaluate` via the curl example on `/integrate`
6. Sees the decision appear in the audit trail (`/audit`)

### The Operator ("Prove my agents stay within bounds")
1. Logs into dashboard — sees approval rate, blocked actions, latency trend
2. Drills into a denied decision in audit — reads exactly why it was blocked
3. Adjusts the policy that blocked it (`/policies`)
4. Sees the FHE shield badge on confidential decisions
5. Views evidence chain for cryptographic proof

## Working with Audit Data

Audit logs flow from the backend through a normalization pipeline:

```
Backend response → normalizeAuditLogs() → NormalizedAuditLog[]
                                                  ↓
                                           AuditPage (expandable rows)
                                                  ↓
                                     Decision Detail Panel
                                       ├─ Per-rule breakdown
                                       ├─ FHE shield badge (confidential)
                                       ├─ ChainGPT audit badge
                                       ├─ Latency, decision ID, timestamp
                                       └─ Fhenix explorer link (when available)
```

The `normalizers.ts` module is the single source of truth for data transformation — always use it rather than ad-hoc mapping.

## Components of Note

### GovernanceCheck (`governance-check.tsx`)
- Self-contained NL-powered spend evaluation
- Supports voice input via Web Speech API
- Handles NO_ACTIVE_POLICY error with guided recovery (Create a Policy link)
- Shows confidential FHE evaluation details when applicable
- Suggest lower amounts on denial

### AuditPage (`audit-page.tsx`)
- Expandable rows with click-to-reveal decision details
- FHE shield badge on confidential evaluations
- ChainGPT audit badge on contract-scanned decisions
- Per-rule breakdown with pass/fail indicators
- Latency displayed prominently in expanded panel

### SpendFlowDemo (`demo/spend/spend-flow-demo.tsx`)
- Animated step-by-step visualization
- Governed/ungoverned toggle — the most effective explanation of the product's value
- Encrypted steps highlighted with lock icons
- Summary card with duration, policies checked, audit status

### Dashboard (`dashboard/dashboard.tsx`)
- Stat cards: agents online, active policies, approval rate, decisions, blocked, avg latency
- DecisionChart (donut), ActivityChart (area), AgentStatusChart (bar)
- Quick Check widget for rapid policy testing
- Get Started checklist for new users
- Focus mode for reduced density

## State Management

- **Auth state** (`auth-store.ts`): Persisted via zustand/middleware. Stores token, user, workspace, workspace mode.
- **Demo state** (`demo-store.ts`): Controls demo flag independently of auth. Demo data is loaded from `demo-data.ts`.
- **Preferences** (`preferences-store.ts`): Persisted onboarding completion state.

## Adding a New Page

1. Create the route in `app/(dashboard)/<route>/page.tsx`
2. Create the component in `src/components/<area>/<component>.tsx`
3. Add the nav item in `src/lib/nav-items.ts`
4. Add the API call in `src/lib/api-client.ts` (if needed)
5. Add the SWR hook in `src/hooks/use-api.ts` (if needed)

## Development

```bash
# Install dependencies
pnpm install

# Run dev server (uses backend at localhost:3087 by default)
pnpm dev

# TypeScript check
npx tsc --noEmit

# Lint
pnpm lint

# Run tests
pnpm test
```

The frontend expects the backend API to be running. For local development, start the backend from the project root with `pnpm start`.
