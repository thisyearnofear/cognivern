# Cognivern Frontend

Next.js dashboard for the Cognivern AI Agent Governance Platform.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **State:** Zustand stores (`auth-store`, `demo-store`, `preferences-store`)
- **Data Fetching:** SWR with custom hooks (`use-api.ts`)
- **UI Components:** Custom `shadcn/ui` component library (`@/components/ui/*`)
- **Charts:** Recharts (`activity-chart`, `decision-chart`, `agent-status-chart`)
- **Auth:** SIWE (Sign-In with Ethereum) via RainbowKit/wagmi + email auth
- **Styling:** Tailwind CSS 4
- **Real-time:** SSE event stream via `use-event-stream.ts` (used by notifications provider)

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
│   │   ├── agents/               # API identity management
│   │   ├── sealed-bid/           # Confidential vendor RFPs (Canton)
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
│   │   ├── sealed-bid/           # Canton/FHE sealed-bid UI + party view
│   │   ├── demo/                 # SpendFlowDemo (governed/ungoverned toggle)
│   │   ├── layout/               # AppSidebar, DemoBanner, CommandPalette
│   │   ├── onboarding/           # OnboardingWizard
│   │   ├── settings/             # SettingsPage, API key management
│   │   ├── policies/             # Policy CRUD
│   │   └── ui/                   # shadcn/ui primitives (button, card, etc.)
│   ├── hooks/
│   │   ├── use-api.ts            # SWR hooks for identities, audit logs, policies
│   │   ├── use-auth.ts           # Auth login/logout/session management
│   │   ├── use-event-stream.ts   # SSE event stream hook
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
3. Registers an API identity (`/agents/workshop`)
4. Gets an API key (`/settings`)
5. Calls `/api/governance/evaluate` via the curl example on `/integrate`
6. Sees the decision appear in the audit trail (`/audit`)

### The Operator ("Prove my agents stay within bounds")
1. Logs into dashboard — sees approval rate, blocked actions, latency trend
2. Drills into a denied decision in audit — reads exactly why it was blocked
3. Adjusts the policy that blocked it (`/policies`)
4. Sees the FHE shield badge on confidential decisions
5. Views evidence chain for cryptographic proof

### The Procurement Lead ("Run a confidential vendor RFP")
1. Opens Sealed Bids from the dashboard or `/sealed-bid`
2. Creates a Canton-backed round and submits bids as demo parties
3. Uses Party View to see role-based disclosure (auctioneer vs bidders)
4. Closes and reveals the winner atomically on-ledger

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
                                       ├─ On-chain tx links
                                       └─ Evidence chain
```

## Development

```bash
cd src/frontend
pnpm dev        # Start dev server (port 3000)
pnpm build      # Production build
pnpm lint       # ESLint
```

The frontend proxies API requests to the backend in development. See the root [Developer Guide](../../docs/DEVELOPER.md) for full setup.
