# Data Ownership & Verifiable Trust

Why this document exists: we run several external services (SigNoz, HydraDB,
0G Storage, Filecoin, Canton DevNet). The rule that keeps us free of vendor
lock-in and honest with users is simple —

> **Primary data is always owned by us. External services are consumers
> (projections, evidence sinks, or configured receivers), never sources of
> truth.**

If an external service disappeared tomorrow, we would lose a *view*, a
*backup*, or a *dashboard* — never data, and never the ability to prove what
happened. This page records that invariant per domain so it survives
contributors who were not here when it was set.

---

## Per-domain ownership map

| Domain | Source of truth | External sinks (consumers only) | Toggle / config |
|---|---|---|---|
| Sponsored credits (ledger) | SQLite: `credit_programs`, `credit_participants`, `credit_ledger`, `inference_records` | Merkle commitments anchored to 0G + Filecoin (`credit_ledger_commitments`); HydraDB knowledge projection | `HYDRADB_ENABLED`, `ZEROG_*`, `FILECOIN_*` |
| Governance / agent actions | SQLite audit trail (`AuditLogService`) | 0G Storage + Filecoin anchoring (CIDs / txHashes recorded back onto the run) | `ZEROG_*`, `FILECOIN_*` (always fail open) |
| CRE runs (agent cycle ledger) | SQLite + 0G Storage | HydraDB app-knowledge projection | `HYDRADB_ENABLED` |
| Observability | OTel standard instruments in-process (meters/spans) | SigNoz via OTLP **or** Prometheus scrape port — same instruments, either receiver | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_PROMETHEUS_PORT` |
| Sealed-bid auctions | Canton DevNet (external by design — the point is a third party holds the state) | — | see `docs/CANTON.md` |

Notes that keep the invariant honest:

- **HydraDB is a projection, twice over.** It ingests copies of ledger/run data
  for cross-source retrieval. Nothing is ever written *only* to HydraDB, and
  every service no-ops when disabled. Losing it loses retrieval features, not
  data. Do not add a write path that treats HydraDB as primary.
- **SigNoz is a configured receiver, not a dependency.** The code emits through
  the OpenTelemetry standard API. Any OTLP-compatible backend works by changing
  one env var, and the Prometheus port (`OTEL_PROMETHEUS_PORT`) needs no vendor
  at all. The only SigNoz-flavored artifacts are `docs/signoz-dashboards.json`
  (a declarative manifest) and the observability page's optional embeds.
- **Storage anchoring is evidence, not a runtime dependency.** 0G/Filecoin
  uploads are fire-and-forget and fail open; the CIDs/txHashes are written back
  onto the local record. A failed anchor degrades provability, never
  functionality.

---

## How users verify us (the trust surfaces)

Operators see dashboards; users must be able to check us. These are the
surfaces that let a third party verify without trusting the server:

1. **`GET /reconcile`** — re-derives every participant balance from the
   append-only ledger and reports drift. The books can be audited by anyone
   with sponsor access; corrections are compensating ledger lines, never
   UPDATEs.
2. **Anchored ledger commitments** (`credit_ledger_commitments`) — a Merkle
   root over every participant's balance state, anchored to 0G + Filecoin.
   - A participant fetches their **receipt** via `GET /v1/credits/verification`
     (leaf + index + path + root + anchor CIDs).
   - Anyone checks it with `POST /verify/credit-commitment` (public, no auth,
     pure hash math) — and can additionally fetch the root itself from the
     Filecoin/0G anchor, bypassing us entirely.
   - Privacy: the anchored payload contains only leaf **hashes**, never
     handles or balances. Leaf content is served per-participant on demand.
3. **Content digests** — sha256 of prompt/response stored per inference record
   (all tiers); excerpts only at the participant's chosen disclosure tier.
4. **TEE verification** — `tee_verified` / `trust_tier` per call where the
   upstream backend reports an attested execution.
5. **Audit anchoring** — every governed action carries 0G root hash and
   Filecoin CID/txHash, so the evidence trail is content-addressed and
   immutable even if our DB were compromised.

---

## Rules for future work

- **Never write primary data to an external store first.** Write to SQLite,
  then project/anchoring is optional.
- **Never make a request path depend on a projection.** HydraDB ingest,
  anchoring, and metric export are fire-and-forget with local logging.
- **New external services** get a toggle env, a no-op-when-disabled mode, and
  an entry in this table before they ship.
- **Metrics stay low-cardinality.** Participant handles are never metric
  labels (high cardinality, and a privacy leak at the `private` disclosure
  tier).
