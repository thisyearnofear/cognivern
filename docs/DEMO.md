# Live Demo

## Goal

Run a **live** OWS-hackathon-style demo against the actual Cognivern server.

This flow avoids internal mock controller calls. It uses real HTTP requests against:

- `POST /api/governance/evaluate`
- `POST /api/governance/policies`
- `POST /ingest/runs`
- `GET /api/audit/logs`
- `GET /api/cre/runs`

## What The Demo Proves

1. A custom spend policy can be created live.
2. A low-value spend request can be approved.
3. A high-value spend request can be denied.
4. A paused-for-approval run can appear in the run ledger.
5. A completed spend run can appear in the run ledger.
6. Audit and run views update from real requests, not seeded UI state.

## Prerequisites

Start the backend with live-friendly local credentials.

Minimum environment:

```bash
export API_KEY=development-api-key
export COGNIVERN_PROJECTS="default:Default Project"
export COGNIVERN_INGEST_KEYS="default=dev-ingest-key"
```

If your local config validation requires additional variables, set the compatibility values already documented in [README.md](../README.md).

Then run the app:

```bash
pnpm build
pnpm start
```

## Run The Live Demo Scenario

In another terminal:

```bash
export COGNIVERN_URL=http://localhost:3000
export COGNIVERN_API_KEY=development-api-key
export COGNIVERN_PROJECT_ID=default
export COGNIVERN_INGEST_KEY=dev-ingest-key

pnpm demo:live
```

## Screens To Show Judges

Open these pages in order:

1. `/agents`
2. `/audit`
3. `/runs`

## Recommended Talk Track

1. Start on `/agents` and explain the product in one sentence:
   Cognivern is SpendOS for OWS wallets.
2. Show that different agents operate under different governance boundaries.
3. Move to `/audit` and show:
   - one allowed spend decision
   - one denied spend decision
   - the recorded reason
4. Move to `/runs` and show:
   - one paused-for-approval run
   - one completed run
5. Close with the product thesis:
   OWS handles wallets and signing; Cognivern handles oversight, approvals, and forensics.

## Important Honesty Constraint

This demo uses **live Cognivern APIs** and real UI surfaces.

It does **not** yet prove an OWS-native signing path. That remains the main Part A dependency.

The truthful framing is:

- policy, audit, and run-ledger behavior are live today
- OWS wallet execution is the wallet-layer workstream in progress
