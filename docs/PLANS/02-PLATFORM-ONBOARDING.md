# Phase 2: Platform Onboarding & Multi-Tenant Auth

> **Status:** Phases 0–2 complete, Phase 3 in progress
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

---

## Approach

The key insight: **demo should be a workspace tier, not a client-side toggle**. The backend decides what data to return based on whether the workspace is trial or live. Components never know the difference.

```
                    ┌──────────────────┐
                    │   Frontend       │
                    │                  │
                    │  Component       │
                    │     ↓            │
                    │  SWR hooks       │
                    │  (HTTP to API)   │
                    └────────┬─────────┘
                             │ GET/POST /api/* with JWT
                             │ (workspace_id extracted from auth)
                             ▼
                    ┌──────────────────┐
                    │   Backend        │
                    │                  │
                    │  demoInterceptor │
                    │     ↓            │
                    │  authMiddleware  │
                    │     ↓            │
                    │  Controller      │
                    │     ↓            │
                    │  ┌──────┬──────┐ │
                    │  │ Demo │SQLite│ │
                    │  │Data  │  DB  │ │
                    │  │Service│     │ │
                    │  └──────┴──────┘ │
                    └──────────────────┘
```

---

## Phases

### Phase 0 — Auth & Workspace Isolation ✅

**Backend (done):**
- [x] SIWE middleware: `POST /api/auth/nonce`, `POST /api/auth/verify`
- [x] Workspace model with `tier: "demo" | "live"`
- [x] Auto-provisioned "demo" workspace on first sign-in
- [x] Auth middleware extracts `workspace_id` from JWT
- [x] SQLite persistence via better-sqlite3 (users, workspaces, nonces survive restarts)

**Frontend (done):**
- [x] RainbowKit + wagmi 2.x for wallet connection (WalletConnect, Coinbase, injected)
- [x] `useAuth` hook: signIn, logout, loading, error, isConnected, address
- [x] Landing page: "Connect Wallet" (SIWE) as primary CTA
- [x] On wallet connect → auto-create workspace → redirect to dashboard
- [x] `app-store.ts` stripped of mode state, keeps auth state

**Files created/modified:**
- `src/backend/db/index.ts` — SQLite setup + auto-migration
- `src/backend/middleware/authMiddleware.ts` — JWT verification
- `src/backend/middleware/workspaceMiddleware.ts` — tier lookup from DB
- `src/backend/modules/api/controllers/AuthController.ts` — SIWE + JWT issuance
- `src/backend/modules/api/controllers/WorkspaceController.ts` — workspace CRUD
- `src/backend/modules/api/routes/authRoutes.ts`
- `src/backend/modules/api/routes/workspaceRoutes.ts`
- `src/frontend/src/lib/wagmi.ts` — wagmi config
- `src/frontend/src/lib/auth.ts` — fetchNonce, verifySignature
- `src/frontend/src/hooks/use-auth.ts` — hook wrapping wagmi + SIWE
- `src/frontend/src/components/providers.tsx` — WagmiProvider + RainbowKit

### Phase 1 — Demo Data Service ✅

**Backend (done):**
- [x] `src/backend/services/DemoDataService.ts` with agents, policies, audit logs, runs
- [x] `src/backend/middleware/demoInterceptor.ts` intercepts API requests for demo-tier workspaces
- [x] All `/api/*` endpoints Just Work for both tiers

**Frontend (done):**
- [x] All `DEMO_AGENT`, `DEMO_LOGS`, `DEMO_*` constants deleted from components
- [x] All `mode === "demo" ? ...` ternaries removed
- [x] Components call API via SWR hooks — they never know the data source

### Phase 2 — Remove Client-Side Mode Awareness ✅

- [x] Removed `mode`, `setMode`, `toggleMode`, `enterDemoMode` from `app-store.ts`
- [x] Removed "Demo Mode / Live Mode" switch from sidebar and settings
- [x] Settings page shows workspace info (name, tier) instead
- [x] Landing page → wallet connect → workspace created → dashboard
- [x] Sidebar shows wallet address + workspace tier for authenticated users

### Phase 3 — Real Onboarding (in progress)

- [x] Onboarding wizard uses RainbowKit ConnectButton (real wallet)
- [x] Auto-triggers SIWE signIn when wallet connects
- [ ] Guide flow: Connect → Name Workspace → Explore Dashboard → Configure Chains → Invite Agents
- [ ] "Go Live" button in settings to upgrade workspace from `demo` → `live`

### Phase 4 — Agent API Key Management (not started)

- [ ] Settings page → "API Keys" tab
- [ ] Humans create/revoke API keys scoped to their workspace
- [ ] Agents present keys in `x-api-key` header
- [ ] Backend `apiKeyMiddleware` resolves workspace from API key
- [ ] `api_keys` table in SQLite (already designed in D1 schema)

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| RainbowKit over ConnectKit | ConnectKit required React 17/18 + wagmi 2.x. RainbowKit supports React >=18, wagmi 2.x, and has better multi-chain UX |
| better-sqlite3 over Turso | Local file-based, zero-config, synchronous API fits Express. Can migrate to Turso (libsql) later with same SQL schema |
| Demo as workspace tier | Single code path — components are mode-agnostic. Backend controls what data a workspace sees |
| JWT over sessions | Stateless auth fits serverless/edge deployment paths. 24h expiry. No session store needed |
| demoInterceptor middleware | Transparent — sits before controllers, serves demo data without touching controller logic |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Wallet-gating excludes non-crypto users | Medium | Offer email+password as secondary auth option later |
| Breaking existing demo flow | Low | Demo still works — just served from backend instead of frontend |
| SQLite single-writer bottleneck | Low | WAL mode handles reads concurrently; scale to Turso when needed |
| Frontend component rewrites | Low (done) | All 10+ files already updated — mechanical deletion of DEMO constants |
