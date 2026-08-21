# Sponsored Inference Credits

A sponsor (e.g. a hackathon organiser) funds one upstream account; Cognivern
mints per-participant `cvk_` keys against it and enforces per-participant
budgets, metering every call into an append-only ledger with a full audit
trail. Participants use any OpenAI SDK pointed at `https://your-host/v1`.

> Strategy context for why this rail is free and where revenue lives instead:
> [`GO_TO_MARKET.md`](./GO_TO_MARKET.md).

The default backend is the **0G Compute Router** (`ZEROG_ROUTER_BASE_URL`),
but the gateway is provider-agnostic: see `services/inference/backendRegistry.ts`
for how to add provider #2.

Money lives in **two layers** and it is worth keeping them apart:

1. **Layer 1 — funding the upstream account** (outside our system). The sponsor
   deposits once (e.g. at pc.0g.ai), creates one `sk-` API key for
   `ZEROG_ROUTER_API_KEY`, and **one `mk-` management key with `account:read`**
   for `ZEROG_ROUTER_MANAGEMENT_KEY`. The mk- key is what lets the funding
   banner (`GET /api/credit-programs/:id/funding`) show the *real* deposit next
   to the ledger pool — ask for it up front; `sk-` keys are 403 on
   `/v1/account/*` by design.
2. **Layer 2 — allocating credits** (our ledger, nano-USD integers). Everything
   below.

## Sponsor surfaces (under `/api`, workspace auth)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/credit-programs` | Create a program (pool, base allocation, allowlist, window, multiplier mode). |
| `PATCH /api/credit-programs/:id` | Edit; `status: closed` anchors a final commitment. |
| `POST /api/credit-programs/:id/participants` | Provision the cohort — returns `cvk_` keys **once** (only a scrypt hash is stored). |
| `POST /api/credit-programs/:id/top-up` | Bulk top-up every active participant. |
| `PATCH .../participants/:pid/allocation` | Per-person adjustment. |
| `GET .../report`, `.../activity`, `.../reconcile` | Money view, per-call feed, ledger re-derivation with drift. |
| `GET .../funding` | Layer 1↔2 reconciliation: upstream balance vs pool vs worst-case commitment. |
| `GET/POST .../commitments` | Anchored-commitment history and anchor-now. |
| `PATCH .../participants/:pid/status`, `.../rotate-key`, `GET .../ledger` | Suspend/revoke, re-issue keys, line-by-line history. |

## Participant surfaces (under `/v1`, `cvk_` key)

- `POST /v1/chat/completions`, `GET /v1/models` (allowlist-filtered) — the OpenAI surface.
- `GET /v1/credits` — balance + tier options.
- `GET /v1/credits/activity` — their calls, exactly what judges see.
- `GET /v1/credits/verification` — their **receipt**: leaf + proof + anchored root.
- `PUT /v1/credits/disclosure` — participant-only tier change (deliberately no sponsor equivalent).

## Disclosure tiers

`private` / `standard` / `detailed` / `open` control what content is stored
(excerpts, task class, project tag) and the allocation multiplier. Private-tier
calls contribute to totals only; credentials are stripped at every tier.

**Multiplier mode** (per program): `bonus` (default) rewards open tiers with a
higher allocation, `ceiling` caps every tier at the base. For a fixed pool,
`ceiling` is the honest arithmetic — "50 × $20" only needs $1000 when $20 is a
ceiling, not a floor.

## Dashboard

`/sponsor/credits` (nav: **Configure → Sponsored Credits**): create programs,
provision and manage participants, top-up, rotate keys, and view report /
activity / reconcile / commitments. No emailing — key distribution is the
sponsor's job.

## Verifiable anchoring

Periodically (hourly; also on close and on demand) the backend builds a Merkle
root over every participant's balance state and anchors it to 0G Storage +
Filecoin. The anchored payload contains **only leaf hashes** — never handles or
balances. A third party can verify a participant's receipt with the public,
unauthenticated `POST /verify/credit-commitment` (pure hash math), and can
fetch the root from the anchors to check Cognivern itself. See
[`DATA_OWNERSHIP.md`](./DATA_OWNERSHIP.md) for the trust model and per-domain
ownership map.

## Env vars

`ZEROG_ROUTER_BASE_URL`, `ZEROG_ROUTER_API_KEY` (sk-, spend),
`ZEROG_ROUTER_MANAGEMENT_KEY` (mk-, account:read), `ZEROG_ZG_USD_RATE`,
`ZEROG_NATIVE_DECIMALS`, `GATEWAY_STATIC_PRICES`, `GATEWAY_HOLD_SAFETY_FACTOR`,
`GATEWAY_DEFAULT_MAX_OUTPUT_TOKENS`, `GATEWAY_EXCERPT_MAX_CHARS`,
`GATEWAY_CATALOG_*`, `GATEWAY_UPSTREAM_TIMEOUT_MS`,
`CREDIT_COMMITMENT_INTERVAL_MS`. All documented in `.env.example`.

## Known caveats

- Layer 1 and Layer 2 are only *reported* side by side, never automatically
  reconciled — the funding banner warns when commitments exceed the deposit,
  but nothing blocks a call on it.
- Task classification is a heuristic; private-tier participants contribute to
  totals only.
- No program cancellation without bids: don't create probe programs against a
  live Devnet (see `AGENTS.md`).
