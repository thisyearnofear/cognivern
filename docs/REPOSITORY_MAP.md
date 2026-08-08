# Repository Map

Cognivern is a multi-surface system and the economic control plane for agentic
work. You can work effectively in one area without understanding every
integration. The strategic product sequence is funded mandate → governed action
→ attributable spend → evidenced outcome → allocation decision.

## Start by intent

For the product thesis and planned sequence, read
[`AGENTIC_CAPITAL_THESIS.md`](./AGENTIC_CAPITAL_THESIS.md) before introducing
new mandate, attribution, outcome, or allocation concepts.

| If you want to change…          | Start here                                                                                                                      | Usually also inspect                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Governance decisions            | `src/backend/modules/api/controllers/GovernanceController.ts` and `src/backend/services/governance/PolicyEnforcementService.ts` | `src/backend/services/governance/`, `tests/unit/`, `tests/integration/`     |
| Policies and policy persistence | `src/backend/services/governance/PolicyService.ts` and `src/backend/services/governance/PolicyEnforcementService.ts`            | `src/backend/policies/`, `src/backend/persistence/`, policy tests           |
| Spend preview or execution      | `src/backend/modules/api/controllers/SpendController.ts` and `src/backend/services/blockchain/`                                 | wallet services, signing providers, spend tests                             |
| HTTP routes                     | `src/backend/modules/api/routes/`                                                                                               | matching controller in `src/backend/modules/api/controllers/`               |
| API response shapes             | `src/backend/modules/api/response.ts` and shared types                                                                          | route/controller tests                                                      |
| Auth and workspaces             | `src/backend/modules/api/controllers/AuthController.ts`, auth middleware, and workspace middleware                              | `src/frontend/src/lib/auth.ts`, `src/frontend/src/stores/auth-store.ts`     |
| Frontend dashboard              | `src/frontend/src/app/(dashboard)/` and `src/frontend/src/components/`                                                          | matching `hooks/`, `lib/`, and frontend tests                               |
| Frontend navigation or layout   | `src/frontend/src/components/layout/` and `src/frontend/src/lib/nav-items.ts`                                                   | dashboard route layout                                                      |
| Audit trail                     | `src/backend/services/governance/AuditLogService.ts`, `src/backend/modules/api/controllers/AuditLogController.ts`               | `src/frontend/src/components/audit/`, audit tests                           |
| CRE runs and event streams      | `src/backend/cre/` and `src/backend/modules/api/controllers/CreController.ts`                                                   | `src/frontend/src/components/runs/`, run tests                              |
| Observability                   | `src/backend/observability/`, `src/backend/modules/api/controllers/ObservabilityController.ts`                                  | `src/frontend/src/components/observability/`, `docs/signoz-dashboards.json` |
| Native trading agents           | `src/backend/modules/agents/`                                                                                                   | `tooling/scripts/agents/`, agent tests                                      |
| External Copilot example        | `examples/copilot/`                                                                                                             | [Agent README](../examples/copilot/README.md)                               |
| Canton sealed bids              | `src/backend/services/blockchain/sealed-bid/`, `src/backend/canton/`, and `daml/`                                               | `tests/integration/canton-sealed-bid.test.ts`, [Canton guide](./CANTON.md)  |
| Fhenix confidential policy      | `contracts/fhenix/` and `src/backend/services/blockchain/FhenixPolicyService.ts`                                                | `contracts/fhenix/test/`, `src/backend/cre/workflows/`, FHE tests           |
| Solidity contracts              | `contracts/src/`                                                                                                                | `contracts/scripts/`, deployment scripts                                    |
| Shared types                    | `packages/shared/src/`                                                                                                          | backend and frontend importers                                              |
| Database schema and migrations  | `src/backend/db/`, `drizzle.config.ts`                                                                                          | `tooling/scripts/db/`, `docs/DEV.md`                                        |
| Demo behavior                   | `src/frontend/src/components/demo/` and `tooling/scripts/demo/`                                                                 | demo stores and `docs/TESTER_GUIDE.md`                                      |
| Deployment                      | `tooling/scripts/deploy/`, `ops/deploy/`, and `docs/DEPLOYMENT.md`                                                              | `.github/workflows/`, environment examples                                  |
| Production operations           | `docs/DEPLOYMENT.md` and `docs/OPS.md`                                                                                          | `ops/monitoring/`, `tooling/scripts/monitoring/`                            |
| HydraDB integration             | `src/backend/services/hydradb/` and `tooling/scripts/hydradb/`                                                                  | [HydraDB guide](./HYDRADB.md)                                               |

## Runtime boundaries

```text
Agent / browser / external client
              │
              ▼
       src/backend/modules/api
              │
              ▼
       src/backend/services
       ├── governance and policy
       ├── persistence and storage
       ├── blockchain and wallet adapters
       ├── CRE workflows and run ledger
       └── optional AI / telemetry integrations

src/frontend  ─────── calls the backend API and renders product workflows
packages/shared ───── types used across the backend and frontend
contracts       ───── on-chain execution and proof primitives
 daml           ───── Canton sealed-bid settlement model
```

## Directory ownership

### `src/backend/`

The root backend application. `modules/api` owns HTTP composition, controllers, and routes. `services` owns domain and integration behavior. `cre` owns workflow/run recording. `db`, `persistence`, and `shared` provide storage, configuration, and reusable backend infrastructure.

### `src/frontend/`

The Next.js application. Route entry points live under `src/app`; reusable product components live under `src/components`; API/session behavior lives under `src/hooks` and `src/lib`; client state lives under `src/stores`.

### `contracts/` and `daml/`

These are protocol projects, not ordinary application packages. Solidity and Fhenix work has its own Hardhat configuration. The Daml project has a two-package layout: the root package is the deployable Canton model, while `daml/scripts` contains local setup and tests.

### `tests/`, `.testsprite/`, and frontend test directories

- `tests/unit/` — canonical backend/unit coverage.
- `tests/integration/` — backend integration and ledger-backed coverage.
- `tests/e2e/` — checked-in Playwright smoke coverage.
- `src/frontend/tests/` — frontend Vitest coverage.
- `contracts/fhenix/test/` — Hardhat/Fhenix contract coverage.
- `.testsprite/` and `src/frontend/testsprite_tests/` — external/generated TestSprite assets; use only when working on that test system.

### `tooling/scripts/`, `ops/`, and `examples/`

Tooling rather than application runtime code. `tooling/scripts/` contains development, demo, verification, deployment, data, and research utilities. `ops/` contains deployment configuration and monitoring helpers. `examples/` contains standalone integrations such as the Copilot runtime. Read the local README before running an operational script.

## The package model

This is a pnpm workspace, but not every repository boundary is a workspace package:

| Boundary           | Package status                                           | Purpose                                      |
| ------------------ | -------------------------------------------------------- | -------------------------------------------- |
| Repository root    | Root application, not listed under `pnpm-workspace.yaml` | Backend API and services                     |
| `src/frontend`     | Workspace package                                        | Next.js frontend                             |
| `packages/shared`  | Workspace package                                        | `@cognivern/shared` types and shared helpers |
| `contracts`        | Hardhat project                                          | Solidity contracts                           |
| `daml`             | Daml project                                             | Canton templates and scripts                 |
| `examples/copilot` | Root-managed TypeScript example                          | Standalone Copilot runtime                   |

When a change crosses boundaries, update the narrowest owning package and its consumers rather than introducing a new package by default.
