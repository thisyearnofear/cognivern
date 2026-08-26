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

The frontend deploys to Vercel automatically on push to `main`. The Express backend runs as a PM2 fork-mode process on a VPS (`api.cognivern.persidian.com`, nginx → port `3087`). The optional local/Hetzner Daml sandbox is used only for staging and regression; final submission targets the shared HackCanton S2 Canton DevNet node directly.

## Deploy

### Artifact Deploy (Recommended)

Builds locally, ships a versioned tarball to the server, and activates it through
an atomic release switch:

```bash
pnpm deploy:hetzner
```

This runs two scripts:

1. `tooling/scripts/deploy/build-backend-artifact.sh` — compiles backend, bundles `dist/` + `config/` + `package.json` into a `.tgz`
2. `tooling/scripts/deploy/deploy-backend-artifact-hetzner.sh` — uploads the tarball to an immutable timestamp/SHA-named release, installs production dependencies with `pnpm install --prod --frozen-lockfile`, validates the candidate, atomically switches `/opt/cognivern/app`, restarts PM2, and verifies liveness/readiness

The artifact's dependency manifest is `ops/deploy/package.backend.json` with the
committed lockfile `ops/deploy/pnpm-lock.backend.yaml` (regenerate with
`tooling/scripts/deploy/regen-backend-lockfile.sh` after any manifest change).
Frozen installs fail loudly if the manifest drifts from the lockfile. The
security bar is `pnpm audit --prod` against the artifact manifest — currently
zero advisories. See [`ops/deploy/README.md`](../ops/deploy/README.md) for the
full dependency discipline.

No build happens on the server — it only installs and validates the uploaded
artifact. The active app path remains stable for PM2 and nginx, while the
release directory is immutable.

Persistent state is kept outside releases:

```text
/opt/cognivern/shared/.env
/opt/cognivern/shared/data
/opt/cognivern/shared/logs
```

The first atomic deployment migrates a legacy `/opt/cognivern/app` directory
into `/opt/cognivern/releases/legacy-<timestamp>` after candidate validation,
so it remains available as a rollback target.

### Inspect and roll back releases

```bash
# Show the active release and retained rollback targets
pnpm deploy:releases

# Roll back to the newest non-active release
pnpm deploy:rollback

# Or select a named release shown by deploy:releases
pnpm deploy:rollback -- cognivern-backend-<timestamp>-<sha>
```

Rollback switches the stable app symlink atomically, restarts the single PM2
process, requires both `/health` and `/health/ready` to pass, and persists the
PM2 process list. Failed candidate health checks automatically restore the
previous target when one is available. Deployments retain the active release,
the immediate previous target, and a bounded history (five by default).

No database or ledger data is stored in release directories, and rollback does
not rewind SQLite, Canton, or any external transaction state; it only restores
application code and dependencies.

### Quick Restart

```bash
ssh <server> "pm2 restart cognivern-backend --update-env"
```

## Required Environment Variables

See `.env.example` for the full list. Minimum for production:

| Variable           | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| `NODE_ENV`         | `production`                                          |
| `PORT`             | API port (must match nginx `proxy_pass`)              |
| `API_KEY`          | API authentication key                                |
| `JWT_SECRET`       | JWT signing secret — authMiddleware throws if missing |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault            |

Optional integrations: `FILECOIN_PRIVATE_KEY`, `FHENIX_PRIVATE_KEY`, the Galileo V1 `ZEROG_PRIVATE_KEY` / `ZEROG_RPC_URL` / `ZEROG_CHAIN_ID` / `ZEROG_PROOF_CONTRACT`, the separate 0G Mainnet V2 `ZEROG_PROOF_VERSION` / `ZEROG_MAINNET_*` settings, `MONGODB_URI`, `CHAINGPT_API_KEY`, `OPENAI_API_KEY`. See `.env.example` for the complete list.

### 0G GovernanceProof V2 — deployed mainnet rail

The commitment-only V2 contract is deployed on 0G Mainnet / Aristotle
(chain ID `16661`) at
`0xAAe217e0893934F7434bdDB27ce87C6e3246D960`.

- Deployment transaction: `0x93837e5e7c599093065300b50823d80f95b6522ecbd16f03deeb9da1f74f15a4`
- Explorer: https://chainscan.0g.ai/address/0xAAe217e0893934F7434bdDB27ce87C6e3246D960
- Admin: `0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77`
- Dedicated poster: `0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43`

The deployer, admin, and poster are deliberately distinct. The poster key is
an environment-only secret; the admin is not used for routine proof posting.
To enable the rail on a backend release, set the following in the active
`/opt/cognivern/shared/.env` and restart through the artifact deploy flow:

```env
ZEROG_PROOF_VERSION=v2
ZEROG_MAINNET_RPC_URL=https://evmrpc.0g.ai
ZEROG_MAINNET_CHAIN_ID=16661
ZEROG_MAINNET_PROOF_CONTRACT=0xAAe217e0893934F7434bdDB27ce87C6e3246D960
ZEROG_MAINNET_ADMIN=0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77
ZEROG_MAINNET_POSTER=0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43
ZEROG_MAINNET_POSTER_PRIVATE_KEY=<secret — never commit>
```

Verify after rollout with:

```bash
curl -sS https://api.cognivern.persidian.com/api/governance/proof-info \
  | jq '.data | {enabled, version, chainId, network, contractAddress, explorerUrl}'
```

Keep the existing Galileo V1 variables unchanged; V2 is a separate opt-in
mainnet rail. See [`ZEROG_PROOF_V2.md`](./ZEROG_PROOF_V2.md) for canonical
preimages, trust boundaries, and read-only receipt verification.

Canton (Daml) backend for confidential sealed-bid rounds — all optional, backend simply isn't registered if `CANTON_JSON_API_URL` is absent. For HackCanton final submission this must point at a Canton DevNet participant; `http://127.0.0.1:7575` / Hetzner sandbox is useful for staging but does not satisfy the DevNet deployment requirement.

| Variable                   | Purpose                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANTON_JSON_API_URL`      | Daml JSON API URL (`http://127.0.0.1:7575` for local staging; `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443` for final submission) |
| `CANTON_APPLICATION_ID`    | Any string; embedded in JWT `applicationId` claim                                                                                                                       |
| `CANTON_LEDGER_ID`         | `sandbox` for the bundled sandbox; `hackcanton-01` for the shared DevNet node                                                                                           |
| `CANTON_LEDGER_USER_ID`    | Daml user ID (Keycloak `sub` UUID on the shared DevNet node)                                                                                                            |
| `CANTON_BEARER_TOKEN`      | Static Bearer token from the NODERS Keycloak password grant                                                                                                             |
| `CANTON_OIDC_*`            | OIDC password-grant config; preferred for production because the client refreshes tokens automatically                                                                  |
| `CANTON_TEMPLATE_AUCTION`  | `#daml:Main:SealedBidAuction` on DevNet; `<pkgId>:Main:SealedBidAuction` on sandbox                                                                                     |
| `CANTON_TEMPLATE_BID`      | `#daml:Main:Bid` on DevNet; `<pkgId>:Main:Bid` on sandbox                                                                                                               |
| `CANTON_TEMPLATE_RESULT`   | `#daml:Main:AuctionResult` on DevNet; `<pkgId>:Main:AuctionResult` on sandbox                                                                                           |
| `CANTON_TEMPLATE_DEPOSIT`  | Optional `#daml:Main:PaymentDeposit` on DevNet (required for value settlement); unset on the sandbox DAR (v0.0.1, no deposit template), which disables settlement safely |
| `CANTON_DEMO_MANAGER_NAME` | Demo manager party name (`auctioner-cognivern` on the shared node)                                                                                                      |
| `CANTON_DEMO_BIDDER_NAMES` | Comma-separated demo bidder names (`alice-cognivern,bob-cognivern,charlie-cognivern`)                                                                                   |
| `CANTON_DEMO_PARTY_IDS`    | Static `name=partyId` map; required on shared DevNet nodes where the user cannot list/allocate parties                                                                  |
| `CANTON_FEATURED_ROUNDS`   | Comma-separated roundIds pinned for the public list; omit to list everything hydrated (currently `demo-round-open,demo-round-closed,demo-round-revealed`)                   |

> **Status (Aug 25 2026):** the shared HackCanton S2 DevNet node is **currently unreachable** (TCP reset since Aug 21), so production has been cut over to the local Hetzner sandbox (`CANTON_JSON_API_URL=http://127.0.0.1:7575`, v1 mode, templates with the `b0b4084a…` pkgId, bearer/OIDC and `CANTON_DEMO_PARTY_IDS` commented out). The live list now returns the three seeded demo rounds with `backend: "canton"`. See `docs/CANTON.md` -> "Production state" for the applied cutover and revert path. A sandbox does not satisfy the final-submission DevNet requirement — that must be re-validated when a DevNet node is reachable again.

See [`.env.example`](../.env.example) for the exact DevNet values and [`docs/CANTON.md`](./CANTON.md) for the model-change and DevNet-migration runbooks.

## Production DevNet cutover

The backend runs on the VPS; the Canton env vars must be set there and the process restarted. If you also need to update frontend-only Vercel env vars (e.g. `NEXT_PUBLIC_API_URL`), use the Vercel dashboard/CLI.

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
A reference config is at `ops/deploy/nginx/cognivern.conf`:

```bash
sudo cp ops/deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

A port mismatch between `$PORT` and nginx makes every public endpoint return 502.

## Health Checks

```bash
curl http://127.0.0.1:<PORT>/health           # liveness from server
curl http://127.0.0.1:<PORT>/health/ready      # readiness from server
curl https://<your-domain>/health?deep=true    # dependency health from outside
curl -s https://<your-domain>/health/slo       # public SLO metrics (application-rate-limited)
```

The deploy gate uses the lightweight `/health` and `/health/ready` endpoints so
optional integrations cannot block a release. Deep health is for diagnosis and
may report degraded optional services such as 0G or Filecoin without making the
core API unready.

## 0G Storage staging round-trip

The optional 0G Storage adapter uses the official TypeScript SDK. Validate it
against the Galileo **Turbo** testnet before changing any production
`ZEROG_INDEXER_URL` value:

```bash
NODE_ENV=staging \
ZEROG_ROUNDTRIP_CONFIRM=staging \
ZEROG_PRIVATE_KEY=<staging-galileo-key> \
ZEROG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai \
ZEROG_RPC_URL=https://evmrpc-testnet.0g.ai \
ZEROG_CHAIN_ID=16602 \
pnpm zerog:roundtrip
```

The harness uploads a disposable JSON payload, downloads it with proof
verification, and compares SHA-256 hashes. It refuses production mode,
non-Galileo URLs, and non-16602 chain IDs. It spends testnet gas and must only
use a staging wallet. Do not run it with the production `.env` or production
wallet. A passing staging round-trip is required before promoting Turbo to
production; the core ledger remains fail-open if 0G Storage is unavailable.

### 0G rollout boundary

The SDK migration and the production endpoint promotion are separate releases.
Deploying the SDK does **not** authorize changing the production indexer URL.
Until the staging round-trip passes:

- keep the production `ZEROG_INDEXER_URL` unchanged;
- treat a degraded 0G Storage deep-health result as optional and non-blocking;
- do not use the production wallet with `pnpm zerog:roundtrip`;
- keep 0G on-chain governance proofs separate from Storage availability.

After a staging pass, promote the indexer URL through the secure VPS environment
workflow, restart PM2 with `--update-env`, and verify `/health`,
`/health/ready`, and deep health before considering the Storage rail restored.
A code rollback does not rewind Storage uploads, proof transactions, or other
external ledger state.

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

## Cleanverse verified-capital demo operations

For the optional Cleanverse CVI/CVA rail, use Monad testnet (chain ID `10143`)
and the configured Access USDC/aUSDC contract:

```text
RPC:      https://testnet-rpc.monad.xyz
Access USDC/aUSDC:   0xaC0893567D43C3E7e6e35a72803df05416C1f20D
Decimals: 6
```

The current disposable demo wallet is:

```text
0x2FeE0208c0d1598104f52fb55Dcc2811707c8879
```

It has MON for gas but still needs Access USDC/aUSDC. Do not send Circle USDC directly to the A-Pass wallet: resolve the Cleanverse USDC deposit address with `GET /api/cleanverse/deposit-address?address=0x...`, fund that deposit address from the Monad testnet faucet, and let Cleanverse credit Access USDC. Never fund the shared deployer wallet
for this demo, and never commit or share private key material. Before recording,
run the read-only acceptance check:

```bash
pnpm tsx tooling/scripts/acceptance/cleanverse-live-negative-paths.ts
```

This checks the active country rule, an unregistered-address denial, and the
known US-tagged demo pair without creating wallets, rounds, or transactions.

## Final submission — proof artifact and demo

### Generate the proof artifact

After production points at DevNet:

```bash
COGNIVERN_URL=https://cognivern.persidian.com \
COGNIVERN_API_KEY=<your-api-key> \
CANTON_PROOF_MANAGER=auctioner-cognivern \
CANTON_PROOF_BIDDERS=alice-cognivern,bob-cognivern,charlie-cognivern \
CANTON_DEVNET_PARTICIPANT="https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443" \
CANTON_DEVNET_PACKAGE_ID="d62e13ab174d8da690a44c6dd354a223f8c70e43a0ac7e17b8385bfd8b291fad" \
CANTON_TEMPLATE_AUCTION="#daml:Main:SealedBidAuction" \
CANTON_TEMPLATE_BID="#daml:Main:Bid" \
CANTON_TEMPLATE_RESULT="#daml:Main:AuctionResult" \
pnpm canton:proof
```

This writes `.artifacts/canton-devnet-proof-latest.json` and `.artifacts/canton-devnet-proof-<timestamp>.json`. Copy the round ID, bid contract IDs, winner, winning amount, package ID, and template IDs into the hackathon submission.

### Record the 3-minute demo

Minimum demo beats:

1. Show public product URL.
2. Create a Canton-backed sealed-bid RFP round.
3. Submit Alice/Bob/Charlie bids.
4. Toggle party visibility: each bidder cannot see competitors' amounts.
5. Close and reveal: Bob wins; losing bids remain undisclosed/archived.
6. Show evidence JSON / package ID / DevNet note.

### Final submission package checklist

- Public GitHub repo.
- Live product URL.
- Hackathon submission with DevNet proof fields filled.
- Pitch deck PDF or hosted deck link.
- 3-minute demo video MP4 or hosted video link.
- Optional: `.artifacts/canton-devnet-proof-latest.json` included or linked.

## Related Docs

- [Architecture](./DEV.md) — System design, integrations, data flows
- [Developer Guide](./DEV.md) — Local setup, APIs, testing
