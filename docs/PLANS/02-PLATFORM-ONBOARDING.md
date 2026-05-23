# Phase 2: Platform Onboarding & Multi-Tenant Auth

> **Status:** Planned — not started
> **Depends on:** Phase 1 (Next.js migration — complete)
> **Goal:** Turn a single-user demo into a platform that real humans and agents can use, with proper auth, workspace isolation, and a demo experience that reflects the real product.

---

## The Problem

Cognivern currently has no concept of users, authentication, or data isolation:

| Current State | Target State |
|---|---|
| Demo data hardcoded in 10+ frontend components | Backend serves demo data for trial workspaces |
| `mode === "demo" ? DEMO_DATA : liveData` ternaries everywhere | Components are mode-agnostic — they just call the API |
| No signup, no login, no session | Wallet-based auth (SIWE) for humans, API keys for agents |
| Single global API key in env | Per-workspace API keys scoped to user/agent |
| All callers see the same data | Data isolated by `workspace_id` |
| Onboarding wizard simulates wallet connection | Real wallet connection + workspace provisioning |

## Why This Matters

Cognivern's primary users are **autonomous agents** making blockchain transactions. But the humans who deploy those agents need:

1. A way to evaluate the product before committing (demo workspace)
2. A workspace to manage their agents, policies, and audit logs
3. API keys to give their agents
4. Confidence that their data is isolated from other teams

The current architecture has none of this. It's a single-user demo with a speculative API wrapper — fine for hackathon demos, not for onboarding real teams.

---

## Approach

The key insight: **demo should be a workspace tier, not a client-side toggle**. The backend decides what data to return based on whether the workspace is trial or live. Components never know the difference.

```
                    ┌──────────────────┐
                    │   Frontend       │
                    │                  │
                    │  Component       │
                    │     ↓            │
                    │  DataService     │
                    │  (HTTP to API)   │
                    └────────┬─────────┘
                             │ POST /api/* with JWT or API key
                             │ (workspace_id extracted from auth)
                             ▼
                    ┌──────────────────┐
                    │   Backend        │
                    │                  │
                    │  Auth middleware │
                    │     ↓            │
                    │  workspace_id    │
                    │     ↓            │
                    │  Controller      │
                    │     ↓            │
                    │  ┌──────┬──────┐ │
                    │  │ Demo │ Live │ │
                    │  │Data  │ DB   │ │
                    │  │Service│     │ │
                    │  └──────┴──────┘ │
                    └──────────────────┘
```

---

## Phases

### Phase 0 — Auth & Workspace Isolation (foundation)

Everything depends on this. No point building features without knowing who the user is.

**Backend:**
- Add `siwe` middleware: `POST /api/auth/siwe/nonce`, `POST /api/auth/siwe/verify`, `POST /api/auth/logout`
- Create workspace model with `tier: "demo" | "live"` and `workspace_id`
- `POST /api/workspaces` creates a new workspace (auto-provisioned as "demo" on signup)
- Auth middleware extracts `workspace_id` from JWT (humans) or API key (agents)
- All existing queries filter by `workspace_id`

**Frontend:**
- Add `useLogin()`, `useLogout()`, `useSession()` hooks
- Landing page: "Connect Wallet" (SIWE) replaces "Try Live Demo" as primary CTA
- On wallet connect → auto-create workspace → redirect to dashboard
- Remove `proxy.ts` cookie gateway — replace with session check
- Add `useAuth` store that replaces `useAppStore`'s mode

**Types to add to `packages/shared`:**
- `User`, `Session`, `Workspace`

**New backend files:**
- `src/backend/modules/api/routes/authRoutes.ts`
- `src/backend/modules/api/routes/workspaceRoutes.ts`
- `src/backend/middleware/authMiddleware.ts`
- `src/backend/middleware/workspaceMiddleware.ts`

### Phase 1 — Demo Data Service

Remove demo data from frontend components. Backend serves it instead.

**Backend:**
- Create `src/backend/services/DemoDataService.ts`
  - Factory functions: `demoAgent()`, `demoAuditLog()`, `demoPolicy()`, `demoRun()`
  - Deterministic but varied (seeded random, time-aware)
- Wire into controllers: if `workspace.tier === "demo"`, return demo data from `DemoDataService`
- All `/api/*` endpoints Just Work for both tiers

**Frontend:**
- Delete all `DEMO_AGENT`, `DEMO_LOGS`, `DEMO_*` constants from component files
- Remove all `mode === "demo" ? DEMO_DATA : liveData` ternaries
- Components just call API — they never know the data source
- No `useAgent("" )` key-gating — always pass the real ID

### Phase 2 — Remove Client-Side Mode Awareness

The frontend no longer needs to know about "demo mode".

- Remove `mode`, `setMode`, `toggleMode`, `enterDemoMode` from `app-store.ts`
- Remove the SSR stub (was only needed for the mode hack)
- Remove "Demo Mode / Live Mode" switch from sidebar and settings
- Settings page → replace with real settings (API key management, workspace config)
- Landing page → wallet connect → workspace created → dashboard

### Phase 3 — Real Onboarding

- Replace simulated wallet connection in `onboarding-wizard.tsx` with real SIWE flow
- First workspace gets pre-seeded demo data (agents, policies, sample runs)
- Guide: Connect Wallet → Name Workspace → Explore Dashboard → Configure Real Chains → Invite Agents via API Key
- "Go Live" = upgrade workspace tier from `demo` to `live` + configure blockchain RPCs

### Phase 4 — Agent API Key Management

- Settings page → "API Keys" tab
- Humans create/revoke API keys scoped to their workspace
- Agents present these keys in `x-api-key` header
- Backend `apiKeyMiddleware` already exists — wire it to workspace scope
- `setApiKey()` in frontend `apiClient` becomes meaningful (operators test agent calls from UI)

---

## File Change Summary

| File | Action |
|---|---|
| `packages/shared/src/types/index.ts` | Add `User`, `Session`, `Workspace` types |
| `src/backend/modules/api/routes/authRoutes.ts` | **New** — SIWE auth endpoints |
| `src/backend/modules/api/routes/workspaceRoutes.ts` | **New** — Workspace CRUD |
| `src/backend/services/DemoDataService.ts` | **New** — Centralized demo data |
| `src/backend/middleware/authMiddleware.ts` | **New** — JWT verification |
| `src/backend/middleware/workspaceMiddleware.ts` | **New** — Workspace context |
| `src/frontend/src/stores/app-store.ts` | Remove mode, add auth store |
| `src/frontend/src/hooks/use-auth.ts` | **New** — SIWE hooks |
| `src/frontend/src/lib/api-client.ts` | Add auth methods |
| `src/frontend/src/hooks/use-api.ts` | Remove mode-gating logic |
| `src/frontend/src/components/` (10+ files) | Remove DEMO constants, remove ternaries |
| `src/frontend/src/components/landing/` | Wallet connect replaces "Try Demo" |
| `src/frontend/src/components/onboarding/` | Real wallet + workspace flow |
| `src/frontend/src/proxy.ts` | Remove — replaced by session middleware |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Wallet-gating excludes non-crypto users | Medium | Offer email+password as secondary auth option |
| Breaking existing demo flow | Low | Demo still works — just served from backend instead of frontend |
| Backend migration complexity | Medium | `workspace_id` filter is a well-known pattern; phased rollout |
| Frontend component rewrites | Medium | 10+ files to touch, but each change is mechanical (delete DEMO, remove ternary) |
