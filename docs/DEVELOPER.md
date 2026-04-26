# Developer Guide

## Local Setup

### Requirements

- Node.js v20.14+
- pnpm

### Install & Run

```bash
pnpm install
pnpm build
pnpm start
```

### Environment

Create `.env` from `.env.example`. Minimum for local dev:

```env
API_KEY=development-api-key
FILECOIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
GOVERNANCE_CONTRACT_ADDRESS=
STORAGE_CONTRACT_ADDRESS=
RECALL_API_KEY=
OPENAI_API_KEY=
```

Contract addresses (`GOVERNANCE_CONTRACT_ADDRESS`, `STORAGE_CONTRACT_ADDRESS`) and `RECALL_API_KEY` can be left empty for local dev — they default to empty strings. `OPENAI_API_KEY` is required if using OpenAI models.

### Smart Contracts

The project includes Solidity contracts in `contracts/src/`:
- **GovernanceContract** — Policy management and agent governance
- **AIGovernanceStorage** — Specialized AI governance data storage

To deploy contracts (e.g. to Filecoin Calibration testnet):

```bash
# Set FILECOIN_PRIVATE_KEY and FILECOIN_RPC_URL in .env
npx hardhat compile
npx hardhat run scripts/deploy-hardhat.cjs --network calibration
```

The deployment script outputs contract addresses to add to your `.env`. See [Deployment](./DEPLOYMENT.md) for details.

### Workspace Structure

This is a pnpm monorepo with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| Root (backend) | `.` | Express API, agents, services |
| Frontend | `src/frontend` | React dashboard |
| Contracts | `contracts` | Hardhat Solidity contracts |

## Core Services

| Service | Responsibility |
|---------|---------------|
| `PolicyService` | Loads and stores local policies |
| `PolicyEnforcementService` | Evaluates actions against policy rules, returns allow/deny decisions |
| `AuditLogService` | Maps events into CRE-backed evidence records |
| `IngestController` | Validates and stores BYO-agent runs, enforces ingest keys |
| `CreController` | Exposes run ledger, event streams, retries, approvals |
| `OwsLocalVaultService` | Encrypted local wallet storage, API-key issuance |
| `OwsWalletService` | Spend execution, policy enforcement, signed authorizations |

## API Reference

### Data Plane — Run Ingestion

**`POST /ingest/runs`**

Headers: `Authorization: Bearer <ingestKey>`, `X-PROJECT-ID: <projectId>`

```json
{
  "runId": "string",
  "workflow": "string",
  "mode": "local",
  "startedAt": "2026-01-01T00:00:00.000Z",
  "finishedAt": "2026-01-01T00:00:01.000Z",
  "ok": true,
  "steps": [],
  "artifacts": []
}
```

Related: `GET /api/projects`, `GET /api/projects/:projectId/usage`

### Governance Control Plane

**`POST /api/governance/evaluate`**

```json
{
  "agentId": "string",
  "action": { "type": "string", "metadata": {} }
}
```

Returns `approved`, `reason`, and per-rule `policyChecks`.

Related: `GET/POST /api/governance/policies`, `GET /api/governance/health`

### OWS Wallet

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ows/bootstrap` | POST | Bootstrap OWS wallet |
| `/api/ows/wallets` | GET | List wallets |
| `/api/ows/api-keys` | GET, POST | API key management |

### Spend Execution

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/spend` | POST | Execute governed spend |
| `/api/spend/encrypted` | POST | Execute confidential-policy spend with encrypted amount payload |
| `/api/spend/preview` | POST | Simulate spend (dry-run) |
| `/api/spend/status` | GET | Execution status |

### Audit & Run Ledger

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/audit/logs` | GET | Audit trail |
| `/api/audit/insights` | GET | Audit insights |
| `/api/audit/permits` | POST | Issue confidential audit decryption permits |
| `/api/cre/runs` | GET | Run ledger |
| `/api/cre/runs/:runId` | GET | Run details |
| `/api/cre/runs/:runId/events/stream` | GET | SSE event stream |

## Testing

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Production Readiness

### Completed

- [x] Error boundaries for frontend resilience
- [x] Circuit breakers for external services (Recall, Sapience, Contract)
- [x] Code splitting and adaptive loading
- [x] Sensitive data redaction in public proofs
- [x] Unit tests for core services (PolicyEnforcement, TradingHistory, Sapience)
- [x] Integration tests for CRE controller
- [x] CI pipeline for backend and frontend builds
- [x] `.env.example` synced with required keys

### Remaining

- [ ] Rate limiting on public endpoints
- [ ] Sentry integration for frontend error tracking
- [ ] 80%+ test coverage for core business logic
- [ ] Automated versioning and changelog
- [ ] Staging environment

### Progress: ~82%

See the full checklist in [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) (archived).

## Platform Enhancements (Completed 2026-03-30)

All planned enhancements have been implemented:

- **Caching** — `BaseService.withCache()` for TTL-based caching
- **BaseStore** — Unified lazy loading, persistence, and TTL patterns
- **Error Boundaries** — Global and section-level error handling
- **Collapsible Dashboard** — Information density with collapsible cards
- **Accessibility** — ARIA labels, focus management, role attributes
- **Circuit Breakers** — External service call protection

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (archived) for details.

## Related Docs

- [Hackathon Brief](./HACKATHON.md) — Demo story and submission
- [Architecture](./ARCHITECTURE.md) — System design and data flows
- [Deployment](./DEPLOYMENT.md) — Production deployment and operations
