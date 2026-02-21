# Cognivern Roadmap

Cognivern is evolving from a single-purpose forecasting bot into an **Agent Reliability + Proof Layer**.

The wedge is simple: **keep your existing agent runtime**, and send runs to Cognivern for durable traceability, governance, and (optionally) verifiability.

---

## Current Status (Shipped)

### Product
- **Run Ledger UI**: list runs, view details, copy link / copy JSON.
- **Projects**: runs scoped by `projectId`.

### Data Plane
- `POST /ingest/runs` (ingest-only auth)
  - `Authorization: Bearer <ingestKey>`
  - `X-PROJECT-ID: <projectId>`

### Security + Commercial Primitives
- Project-scoped ingest keys (`COGNIVERN_INGEST_KEYS`), rotation support via `|`.
- Per-project quotas + usage headers.
- Token-level telemetry (stable `ingestKeyId`, last seen, counts).

### Persistence
- Runs persisted locally (`data/cre-runs.jsonl`).
- Quota usage persisted (`data/usage.json`).
- Token telemetry persisted (`data/token-telemetry.json`).

---

## Roadmap (Next)

### 1) DX + Adoption (fastest path to real users)
- SDKs: TypeScript + Python client helpers.
- Ingest formats:
  - accept span/event streams (OpenTelemetry-ish) and normalize into `CreRun`.
- Better errors: structured error codes for ingestion.

### 2) Governance + Safety
- Per-project policies for data-plane ingestion:
  - max artifact size
  - allowed workflow names
  - schema validation profiles
- Redaction hooks for sensitive fields (secrets, API keys).

### 3) Commercialization
- Plan model:
  - Free / Pro / Team / Enterprise
  - quotas + retention by plan
- Usage reporting endpoints and UI.

### 4) Multi-tenancy (when you have traction)
- Org → Projects → Environments (`dev|staging|prod`).
- RBAC and project membership.

### 5) Verifiability (differentiator)
- Optional “proof packs”:
  - Chainlink Data Feeds as verified inputs
  - CRE-style confidential steps
  - on-chain attestations for high-stakes actions

---

## Guiding Principles
- **One clean ingestion surface**: `/ingest/*`.
- Control plane is separate: `/api/*`.
- Prefer boring, observable defaults; add cryptography/proof only where it increases trust.
