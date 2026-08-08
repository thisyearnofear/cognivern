# Backend

The backend is the root Cognivern application. It exposes the HTTP API, evaluates governance policies, coordinates wallets and integrations, and records audit/run evidence.

## Start here

| Concern                            | Location                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Application entry point            | `src/index.ts`                                                               |
| Server composition                 | `src/server.ts`                                                              |
| API module                         | `src/backend/modules/api/`                                                   |
| Routes                             | `src/backend/modules/api/routes/`                                            |
| Controllers                        | `src/backend/modules/api/controllers/`                                       |
| Domain and integration services    | `src/backend/services/`                                                      |
| Governance policy logic            | `src/backend/services/governance/` and policy services                       |
| CRE workflows and run ledger       | `src/backend/cre/`                                                           |
| Persistence and database           | `src/backend/persistence/`, `src/backend/db/`, `src/backend/shared/storage/` |
| Middleware                         | `src/backend/middleware/`                                                    |
| Shared backend configuration/types | `src/backend/shared/`                                                        |
| Blockchain and wallet adapters     | `src/backend/services/blockchain/` and `src/backend/canton/`                 |

For feature-oriented pointers, use the [Repository Map](../../docs/REPOSITORY_MAP.md).

## Request flow

```text
HTTP request
  → middleware
  → route
  → controller
  → domain service / adapter
  → persistence or external integration
  → typed response + audit/run evidence where applicable
```

Controllers should remain focused on transport concerns. Put reusable business behavior in a service, and keep external providers behind an existing interface or adapter where one exists.

## Run locally

From the repository root:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The backend uses optional integrations wherever possible. Start with the minimum environment in `.env.example`; add Fhenix, Canton, wallet, AI, database, or telemetry configuration only for the workflow you are working on.

## Validate backend changes

```bash
pnpm typecheck
pnpm vitest run
pnpm test:integration
pnpm build
```

Use a focused test file while iterating, for example:

```bash
pnpm vitest run tests/unit/PolicyService.test.ts
```

Do not point local experiments at production credentials or create persistent rounds on the live Canton DevNet. See [AGENTS.md](../../AGENTS.md) and [Canton](../../docs/CANTON.md) before working on ledger-backed behavior.
