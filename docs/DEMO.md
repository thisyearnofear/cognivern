# Live Demo

## Goal

Run a **live** OWS-hackathon-style demo against the actual Cognivern server.

This flow avoids internal mock controller calls. It uses real HTTP requests against:

- `POST /api/ows/bootstrap`
- `POST /api/ows/api-keys`
- `POST /api/governance/policies`
- `POST /api/spend`
- `GET /api/spend/status`
- `GET /api/audit/logs`
- `GET /api/cre/runs`

## What The Demo Proves

1. A custom spend policy can be created live.
2. A local OWS wallet can be bootstrapped into encrypted storage.
3. A scoped OWS API key can be issued for one agent.
4. A low-value spend request can be approved.
5. A mid-range spend request can be held for approval.
6. A high-value spend request can be denied.
7. Both held and approved spend runs appear in the run ledger automatically.
8. Audit and run views update from real spend requests, not seeded UI state.

## Prerequisites

Start the backend with live-friendly local credentials.

Minimum environment:

```bash
export API_KEY=development-api-key
export COGNIVERN_PROJECTS="default:Default Project"
export OWS_VAULT_SECRET=development-ows-vault-secret
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
3. Call out that the agent is using a scoped OWS API key rather than a raw env private key.
4. Move to `/audit` and show:
   - one allowed spend decision
   - one held spend decision
   - one denied spend decision
   - the recorded reason
5. Move to `/runs` and show:
   - one paused-for-approval run
   - one completed approved run
6. Close with the product thesis:
   OWS handles wallets and signing; Cognivern handles oversight, approvals, and forensics.
7. If asked about execution, point to the encrypted local vault, the delegated OWS API key, and the signed spend authorization created by `/api/spend`.
