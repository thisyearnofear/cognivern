# Canton Backend

Cognivern's sealed-bid vendor selection runs on a pluggable backend interface. The **Canton** backend uses a Daml sandbox to give sealed-bid auctions structural sub-transaction privacy and atomic multi-party reveal — capabilities the FHE backend can't provide.

## Why Canton

The pre-existing FHE sealed-bid path ships bids as CoFHE ciphertext handles but can't complete the reveal — threshold decryption of live ciphertexts was never wired. The Canton backend rewrites the settlement layer so the reveal actually works, in a single atomic transaction:

- **Sub-transaction privacy** — bidders never see each other's bids. Enforced by the Daml disclosure model (`Bid.signatory bidder + observer manager`), not by encryption.
- **Atomic reveal** — auction + all bids archived + `AuctionResult` created in one transaction. Losing amounts are never disclosed to anyone but the auctioneer.
- **Verifiable end-to-end** — see `tests/integration/canton-sealed-bid.test.ts` for the privacy invariants asserted against a live sandbox.

## Architecture

```
POST /api/vendor/sealed-bid/rounds  { backend: "canton" }
     |
     v
SealedBidService (dispatcher, src/backend/services/blockchain/)
     |
     v
CantonSealedBidBackend (sealed-bid/CantonSealedBidBackend.ts)
     |
     v
CantonLedgerClient (canton/CantonLedgerClient.ts)  ---HTTP--->  Daml JSON API :7575
                                                                       |
                                                                       v
                                                                Canton participant
                                                                (SealedBidAuction / Bid /
                                                                 AuctionResult templates)
```

Every lifecycle step (create, submit, close, reveal) also fires `AuditLogService.logEvent` so the CRE run ledger has a hash-signed evidence record.

## Files

| Path | Purpose |
|---|---|
| `daml/daml/Main.daml` | Daml model — `SealedBidAuction`, `Bid`, `AuctionResult` templates |
| `daml/daml.yaml` | SDK version + project name |
| `daml/start-sandbox.sh` | pm2 launcher on Hetzner |
| `src/backend/canton/CantonLedgerClient.ts` | JWT + `/v1/{query,create,exercise,parties}` client |
| `src/backend/canton/CantonPartyRegistry.ts` | cognivern name → Daml party mapping |
| `src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts` | Backend impl |
| `src/backend/services/blockchain/sealed-bid/SealedBidBackend.ts` | Interface all backends satisfy |
| `src/frontend/src/components/sealed-bid/` | UI: create form, round list, party viewer |
| `tests/integration/canton-sealed-bid.test.ts` | Live-sandbox privacy invariants |

## Runtime layout

**Local (Mac)** — Daml SDK at `~/.daml/`, `daml start --start-navigator=no` from `/Users/…/Dev/cognivern/daml/`. Binds `:7575` (JSON API) and `:6865` (gRPC). Auto-runs `Main:setup` — allocates Auctioneer, Alice, Bob, Charlie parties.

**Hetzner** — Daml SDK at `/home/deploy/.daml/`, `daml/` project synced to `/opt/cognivern/daml/`, launched via `pm2 start /opt/cognivern/daml/start-sandbox.sh --name cognivern-canton --interpreter bash`. Localhost-bound.

## Environment variables

All optional — omit `CANTON_JSON_API_URL` and the backend simply isn't registered, and cognivern behaves as it did pre-Canton:

```env
CANTON_JSON_API_URL=http://127.0.0.1:7575
CANTON_APPLICATION_ID=cognivern       # any string; goes in JWT applicationId
CANTON_LEDGER_ID=sandbox              # matches the sandbox default
CANTON_JWT_SECRET=                    # empty for sandbox (HS256 with empty secret)
CANTON_TEMPLATE_AUCTION=<pkgId>:Main:SealedBidAuction
CANTON_TEMPLATE_BID=<pkgId>:Main:Bid
CANTON_TEMPLATE_RESULT=<pkgId>:Main:AuctionResult
```

The `<pkgId>` is the deterministic hash of the compiled `.dar`. Rebuild changes it; `daml damlc inspect-dar daml/.daml/dist/daml-0.0.1.dar` prints the current value.

## Runbook — Daml model change

1. Edit `daml/daml/Main.daml`
2. `cd daml && daml build` — verifies compilation
3. Local test: `daml damlc inspect-dar .daml/dist/daml-0.0.1.dar | grep -oE "daml-0\.0\.1-[a-f0-9]{60,}" | head -1` — copy the new pkgId
4. Update `tests/integration/canton-sealed-bid.test.ts` (`const PKG = ...`) and run `pnpm exec vitest run tests/integration/canton-sealed-bid.test.ts`
5. Deploy to Hetzner:
   ```bash
   rsync -azP --delete daml/ snel-bot:/opt/cognivern/daml/ --exclude .daml --exclude log
   ssh snel-bot 'cd /opt/cognivern/daml && daml build'
   ```
6. Update env vars: `ssh snel-bot 'sed -i "s/<oldPkg>/<newPkg>/g" /opt/cognivern/shared/.env'` (backs up automatically via `sed -i.bak`)
7. Restart both processes: `ssh snel-bot 'pm2 restart cognivern-canton && pm2 restart cognivern-backend --update-env'`
8. Health check: `curl -sf http://cognivern.thisyearnofear.com/api/vendor/sealed-bid/rounds -H "x-api-key: ..."`

## Runbook — sandbox restart

The sandbox uses an in-memory ledger, so restarting `cognivern-canton` wipes on-chain state. The `Main:setup` script re-populates Auctioneer/Alice/Bob/Charlie + a demo auction on each start, but any prod-created rounds' contract IDs become stale.

For a longer-lived deployment, swap `daml start` for a Canton participant configured with PostgreSQL persistence. See the Daml Canton docs on production configuration.

## Runbook — DevNet migration

For a Canton Network DevNet participant (real network, not sandbox) instead of the local sandbox:

1. Request sponsor allowlisting via `https://canton.foundation/validator-request/` — 2–7 day wait for SV IP whitelist. Requires corporate-domain email and pre-arranged SV contact (e.g. Global Synchronizer Foundation via Canton Foundation Discord).
2. Install Splice release bundle:
   ```bash
   curl -L https://github.com/hyperledger-labs/splice/releases/latest/download/splice-node.tar.gz -o splice-node.tar.gz
   ```
3. Configure participant + validator per Splice docs (JSON API config, PostgreSQL, OIDC).
4. Upload `.dar` via the JSON API `/v1/packages` endpoint.
5. Update env vars to point at the DevNet participant's JSON API URL and new pkgId.

The cognivern backend code is participant-agnostic — swapping from sandbox to DevNet is an env change, not a code change.
