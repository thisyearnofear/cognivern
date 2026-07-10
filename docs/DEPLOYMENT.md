# Deployment

Generic deployment guide for Cognivern. Server-specific operational details
(incident playbooks, internal paths, rollback procedures) are kept in a
private `OPS.md` that is not committed to the repository.

## Architecture

```text
Internet → Vercel (Frontend) → Express API (VPS / PM2) → optional Filecoin / LLMs
                                    ↕
                          Canton JSON API v2 (DevNet)
```

The frontend deploys to Vercel automatically on push to `main`. The Express backend runs as a PM2 fork-mode process on a VPS (`api.thisyearnofree.com` / `157.180.36.156:3000`). The optional local/Hetzner Daml sandbox is used only for staging and regression; final submission targets the shared HackCanton S2 Canton DevNet node directly.

## Deploy

### Artifact Deploy (Recommended)

Builds locally, ships a tarball to the server, restarts PM2:

```bash
pnpm deploy:hetzner
```

This runs two scripts:
1. `scripts/deploy/build-backend-artifact.sh` — compiles backend, bundles `dist/` + `config/` + `package.json` into a `.tgz`
2. `scripts/deploy/deploy-backend-artifact-hetzner.sh` — SCPs tarball, extracts, installs prod deps, restarts PM2, runs health check

No build happens on the server — it just extracts and restarts.

### Quick Restart

```bash
ssh <server> "pm2 restart cognivern-backend --update-env"
```

## Required Environment Variables

See `.env.example` for the full list. Minimum for production:

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | `production` |
| `PORT` | API port (must match nginx `proxy_pass`) |
| `API_KEY` | API authentication key |
| `JWT_SECRET` | JWT signing secret — authMiddleware throws if missing |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault |

Optional integrations: `FILECOIN_PRIVATE_KEY`, `FHENIX_PRIVATE_KEY`, `MONGODB_URI`, `CHAINGPT_API_KEY`, `OPENAI_API_KEY`. See `.env.example` for the complete list.

Canton (Daml) backend for confidential sealed-bid rounds — all optional, backend simply isn't registered if `CANTON_JSON_API_URL` is absent. For HackCanton final submission this must point at a Canton DevNet participant; `http://127.0.0.1:7575` / Hetzner sandbox is useful for staging but does not satisfy the DevNet deployment requirement.

| Variable | Purpose |
| -------- | ------- |
| `CANTON_JSON_API_URL` | Daml JSON API URL (`http://127.0.0.1:7575` for local staging; `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443` for final submission) |
| `CANTON_APPLICATION_ID` | Any string; embedded in JWT `applicationId` claim |
| `CANTON_LEDGER_ID` | `sandbox` for the bundled sandbox; `hackcanton-01` for the shared DevNet node |
| `CANTON_LEDGER_USER_ID` | Daml user ID (Keycloak `sub` UUID on the shared DevNet node) |
| `CANTON_BEARER_TOKEN` | Static Bearer token from the NODERS Keycloak password grant |
| `CANTON_OIDC_*` | OIDC password-grant config; preferred for production because the client refreshes tokens automatically |
| `CANTON_TEMPLATE_AUCTION` | `#daml:Main:SealedBidAuction` on DevNet; `<pkgId>:Main:SealedBidAuction` on sandbox |
| `CANTON_TEMPLATE_BID` | `#daml:Main:Bid` on DevNet; `<pkgId>:Main:Bid` on sandbox |
| `CANTON_TEMPLATE_RESULT` | `#daml:Main:AuctionResult` on DevNet; `<pkgId>:Main:AuctionResult` on sandbox |
| `CANTON_DEMO_MANAGER_NAME` | Demo manager party name (`auctioner-cognivern` on the shared node) |
| `CANTON_DEMO_BIDDER_NAMES` | Comma-separated demo bidder names (`alice-cognivern,bob-cognivern,charlie-cognivern`) |
| `CANTON_DEMO_PARTY_IDS` | Static `name=partyId` map; required on shared DevNet nodes where the user cannot list/allocate parties |

See [`.env.example`](../.env.example) for the exact DevNet values and [`docs/CANTON.md`](./CANTON.md) for the model-change and DevNet-migration runbooks.

## Production DevNet cutover

The backend runs on the VPS; the Canton env vars must be set there and the process restarted. If you also need to update frontend-only Vercel env vars (e.g. `VITE_BACKEND_URL`), use the Vercel dashboard/CLI.

1. SSH into the backend server.
2. Update the backend `.env` file with the Canton DevNet values from `.env.example`.
3. Restart PM2 with `--update-env`:
   ```bash
   pm2 restart cognivern-backend --update-env
   ```
4. Verify the startup logs show `Canton: JSON Ledger client bound to ... (mode=v2)` and `SealedBid: backend registered — canton`.
5. Run `pnpm canton:proof` against the production URL and copy the evidence into `HACKATHON_SUBMISSION.md`.

## Canton Sandbox Process (Hetzner)

The Daml sandbox that backs the Canton sealed-bid path runs as its own pm2 process alongside `cognivern-backend`:

```bash
# Launcher (in repo): daml/start-sandbox.sh — deployed to /opt/cognivern/daml/
pm2 start /opt/cognivern/daml/start-sandbox.sh --name cognivern-canton --interpreter bash
pm2 save
```

The launcher runs `daml start --start-navigator=no` from `/opt/cognivern/daml/`. It binds `127.0.0.1:7575` (JSON API) and `:6865` (gRPC ledger API) — localhost-only, not exposed publicly. Consumes roughly 500 MB RSS.

**In-memory ledger** — a `pm2 restart cognivern-canton` wipes on-chain state, and the Daml `Main:setup` script re-populates Auctioneer/Alice/Bob/Charlie parties + a demo auction on each start. For persistent deployments, swap `daml start` for a Canton participant configured with PostgreSQL storage.

To deploy a Daml model change: sync `daml/` to the server, `daml build` on the server to produce a new `.dar`, extract the new pkgId, update the three `CANTON_TEMPLATE_*` env vars, and `pm2 restart cognivern-canton && pm2 restart cognivern-backend --update-env`.

## PM2 Management

```bash
pm2 list
pm2 describe cognivern-backend
pm2 logs cognivern-backend --lines 50
pm2 logs cognivern-backend --err
pm2 restart cognivern-backend --update-env
pm2 save
```

PM2 must run in `fork` mode (not cluster) — SQLite requires single-process access.

## Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Reverse Proxy (nginx)

The backend listens on `$PORT`. nginx must `proxy_pass` to the same port.
A reference config is at `deploy/nginx/cognivern.conf`:

```bash
sudo cp deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

A port mismatch between `$PORT` and nginx makes every public endpoint return 502.

## Health Checks

```bash
curl http://127.0.0.1:<PORT>/health           # from server
curl https://<your-domain>/health?deep=true    # from outside
curl -s https://<your-domain>/api/health/slo   # SLO metrics
```

## SQLite Tables

Auto-created on first boot via idempotent `CREATE TABLE IF NOT EXISTS`:
`users`, `workspaces`, `nonces`, `api_keys`, `workspace_agents`, `workspace_policies`, `policy_versions`, `workspace_members`, `copilot_runs`, `copilot_events`.

No manual migration step required.

## Security Notes

- Never commit `.env` files or private keys
- API keys hashed with scrypt before storage
- JWT tokens revocable via server-side blacklist
- Rate limiting persistent across restarts (file-backed stores)
- SIWE authentication uses nonce replay protection
- Helmet CSP, CORS, body size limits, trust-proxy configured for production

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design, integrations, data flows
- [Developer Guide](./DEVELOPER.md) — Local setup, APIs, testing
