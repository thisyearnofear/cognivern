# Canton Backend

Cognivern's sealed-bid vendor selection runs on a pluggable backend interface. The **Canton** backend uses a Daml sandbox to give sealed-bid auctions structural sub-transaction privacy and atomic multi-party reveal — capabilities the FHE backend can't provide.

## Why Canton

The FHE sealed-bid path now uses the CoFHE manager-decrypt-and-publish (Option B) flow, so the reveal works. However, that flow requires the round manager to decrypt every losing bid plaintext and then publish only the winner — the privacy guarantee from the auctioneer is lost at reveal time. The Canton backend sidesteps that entire workstream: losing bids are archived in flight inside the atomic `CloseAndReveal` transaction and are never decrypted by anyone. The reveal actually works, in a single atomic transaction, with no plaintext leakage to the manager:

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
CantonLedgerClient (canton/CantonLedgerClient.ts)  ---HTTP--->  Daml JSON API v2
                                                                       |
                                                                       v
                                                                Canton participant
                                                                (SealedBidAuction / Bid /
                                                                 AuctionResult templates)
```

The client speaks both JSON Ledger API v1 (local/Hetzner sandbox) and v2 (Canton DevNet / shared participants). v2 is selected automatically when a `CANTON_BEARER_TOKEN` or OIDC config is provided.


Every lifecycle step (create, submit, close, reveal) also fires `AuditLogService.logEvent` so the CRE run ledger has a hash-signed evidence record.

## Files

| Path | Purpose |
|---|---|
| `daml/daml/Main.daml` | Daml model — `SealedBidAuction`, `Bid`, `AuctionResult` templates |
| `daml/daml.yaml` | SDK version (**3.4.11**, LF 2.1) + project name |
| `daml/start-sandbox.sh` | pm2 launcher on Hetzner |
| `src/backend/canton/CantonLedgerClient.ts` | JWT + `/v1/{query,create,exercise,parties}` client |
| `src/backend/canton/CantonPartyRegistry.ts` | cognivern name → Daml party mapping |
| `src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts` | Backend impl |
| `src/backend/services/blockchain/sealed-bid/SealedBidBackend.ts` | Interface all backends satisfy |
| `src/frontend/src/components/sealed-bid/` | UI: create form, round list, party viewer, backend picker |
| `src/frontend/src/components/dashboard/dashboard.tsx` | Dashboard card linking agent spend governance ↔ sealed-bid |
| `tests/integration/canton-sealed-bid.test.ts` | Live-sandbox privacy invariants |

## UI surfaces

- **`/sealed-bid`** — create rounds, submit bids, close/reveal, and toggle the **Party view** (Auctioneer / Alice / Bob / Charlie) to see role-based disclosure.
- **Dashboard** — "Vendor spend governance" card links day-to-day agent spend policies to confidential vendor RFPs on the same control plane.
- **Backend picker** — Canton (recommended) for structural privacy; FHE for ciphertext bids with manager-publish reveal. Helper text on the create form explains the trade-off.

## Runtime layout

**Local (Mac)** — Daml SDK at `~/.daml/`, `daml start --start-navigator=no` from `/Users/…/Dev/cognivern/daml/`. Binds `:7575` (JSON API) and `:6865` (gRPC). Auto-runs `Main:setup` — allocates Auctioneer, Alice, Bob, Charlie parties.

**Hetzner** — Daml SDK at `/home/deploy/.daml/`, `daml/` project synced to `/opt/cognivern/daml/`, launched via `pm2 start /opt/cognivern/daml/start-sandbox.sh --name cognivern-canton --interpreter bash`. Localhost-bound.

**Canton DevNet** — the required final-submission target. We use the shared HackCanton S2 DevNet node (`https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443`). The DAR (`51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454`) was uploaded, demo parties were allocated with the `-cognivern` suffix, and the authenticated Daml user is `e6c5f9fc-98ed-491f-b228-00cf931a05cc`. The backend is participant-agnostic, but final judging requires contract/transaction evidence from a real DevNet round. A sandbox-only run is not enough.

## Demo state on boot

`Main:setup` seeds three auctions in distinct lifecycle stages on every sandbox start, so visitors and the demo video land on a state that shows the full flow at a glance:

| roundId | Description | Status | Notes |
|---|---|---|---|
| `demo-round-open` | Q1 penetration testing engagement | open, 2 of 3 bids in | invites the visitor to submit the third bid + toggle the party view |
| `demo-round-closed` | Q3 cloud-hosting RFP — 3-year commit | open on ledger, 3 bids in | visitor drives Close → Reveal to watch the atomic reveal |
| `demo-round-revealed` | Legal counsel retainer 2026 | revealed (Bob won @ $185k) | shows the completed lifecycle; losing bids archived and never disclosed |

Because the ledger is in-memory, restart guarantees a clean known state rather than accumulating cruft — a feature, not a bug, for hackathon-window demos.

**Demo freshness check:** the seeded deadlines are relative to process boot. Before recording or submitting, restart the ledger/backend or create a fresh round, then confirm the public API shows future deadlines and a Canton backend:

```bash
curl -sf https://cognivern.thisyearnofear.com/api/vendor/sealed-bid/rounds \
  | jq '.data[] | {roundId, backend, status, deadline, bidCount}'
```

If the displayed deadlines are in the past, the open demo round can no longer accept bids even though it still lists as `open`.

## Hydration on cognivern-backend startup

`CantonSealedBidBackend` runs `hydrateFromLedger()` once on construction. It queries all `SealedBidAuction` and `AuctionResult` contracts as the demo manager party (`Auctioneer`) and registers them in the off-ledger `rounds` Map, so any pre-seeded auctions become addressable through cognivern's public API without a manual re-index. Every public method awaits `this.ready` before touching the Map.

The `SealedBidService` dispatcher's `resolveBackend(roundId)` falls back to probing every backend on cache miss, memoizing the result. This makes hydrated rounds addressable through `submitBid` / `closeRound` / `revealWinner` too — not just `getRound`.

Startup log to confirm: `SealedBid[canton]: hydrated N open + M revealed round(s) from ledger`.

## Environment variables

All optional — omit `CANTON_JSON_API_URL` and the backend simply isn't registered, and cognivern behaves as it did pre-Canton.

### Local / Hetzner sandbox

```env
CANTON_JSON_API_URL=http://127.0.0.1:7575
CANTON_APPLICATION_ID=cognivern
CANTON_LEDGER_ID=sandbox
CANTON_JWT_SECRET=                    # empty for sandbox (HS256 with empty secret)
CANTON_TEMPLATE_AUCTION=<pkgId>:Main:SealedBidAuction
CANTON_TEMPLATE_BID=<pkgId>:Main:Bid
CANTON_TEMPLATE_RESULT=<pkgId>:Main:AuctionResult
```

The `<pkgId>` is the deterministic hash of the compiled `.dar`. Rebuild changes it; `daml damlc inspect-dar daml/.daml/dist/daml-0.0.1.dar` prints the current value.

### Canton DevNet (final submission)

Use the values in `.env.example`. The DevNet JSON Ledger API v2 accepts package-name references (`#daml:Main:*`) for commands and queries, so the template env vars use that form rather than the raw package hash:

```env
CANTON_JSON_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443
CANTON_LEDGER_ID=hackcanton-01
CANTON_LEDGER_USER_ID=e6c5f9fc-98ed-491f-b228-00cf931a05cc
CANTON_APPLICATION_ID=cognivern
CANTON_BEARER_TOKEN=<or use OIDC below>
CANTON_OIDC_TOKEN_URL=https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token
CANTON_OIDC_CLIENT_ID=web-app-ui-hackcanton-01-devnet
CANTON_OIDC_USERNAME=<keycloak-username>
CANTON_OIDC_PASSWORD=<keycloak-password>
CANTON_OIDC_AUDIENCE=https://hackcanton-01.devnet.naas.noders.services
CANTON_OIDC_SCOPE=openid daml_ledger_api offline_access
CANTON_TEMPLATE_AUCTION="#daml:Main:SealedBidAuction"
CANTON_TEMPLATE_BID="#daml:Main:Bid"
CANTON_TEMPLATE_RESULT="#daml:Main:AuctionResult"
CANTON_DEMO_MANAGER_NAME=auctioner-cognivern
CANTON_DEMO_BIDDER_NAMES=alice-cognivern,bob-cognivern,charlie-cognivern
CANTON_DEMO_PARTY_IDS=auctioner-cognivern=auctioner-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668,alice-cognivern=alice-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668,bob-cognivern=bob-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668,charlie-cognivern=charlie-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668
```

`CANTON_DEMO_PARTY_IDS` is required on shared DevNet nodes because the authenticated user typically lacks rights to list or allocate parties.

## HackCanton S2 — value settlement, bounty lanes & demo rails

### Value settlement — implemented in model, pending DevNet upload
`CloseAndReveal` now settles **value**, not just an informational record. A
`PaymentDeposit` template (bearer instrument pattern — issuer is sole signatory,
`owner` tracks the current holder) is escrowed before the auction opens and
atomically transferred to the winner inside the same `CloseAndReveal`
transaction that archives losing bids and emits the `AuctionResult`. The
`AuctionResult` carries a `settledAsset` reference to the new deposit —
on-ledger proof that value moved.

**Status:** The Daml source compiles and `SettlementProof.daml` passes all 9
assertions on the IDE ledger. The updated DAR (`daml-0.0.2.dar`) is pending
upload to the shared DevNet participant. The existing DevNet rounds continue to
work on the prior DAR (non-settlement path); settlement rounds will go live
once the new DAR is uploaded. The backend is backward-compatible — it omits the
`settlementAsset` field when no deposit is escrowed, so the old DAR accepts
non-settlement round creation without error.

The deposit is asset-agnostic: today it carries a `Decimal` amount and
`assetTag` ("USDC"). Swapping in **CBTC** (BitSafe) or **cETH** (OnRails
Finance) requires only replacing the `PaymentDeposit` template with the token
contract — the `CloseAndReveal` atomicity pattern is unchanged.

Verified by `daml/scripts/daml/SettlementProof.daml` — a Daml Script that
exercises the full flow (escrow → 3 bids → close → reveal → transfer) and
asserts: winner is Bob (lowest bid), deposit owner changed from auctioneer
to Bob, old deposit archived, losing bids archived, `AuctionResult.settledAsset`
is `Some`. All assertions pass on the Daml IDE ledger.

### Bounty-lane scoping (recommendation: CBTC private OTC)
- **CBTC (BitSafe) — best fit.** The sealed-bid vendor-selection / OTC flow is
  *literally* the "private OTC" lane the CBTC bounty names. Winner settlement =
  release the CBTC escrow (or transfer CBTC to the winning vendor) inside
  `CloseAndReveal`. Lowest conceptual lift; strongest narrative fit.
- **cETH (OnRails Finance) — also viable.** Maps to "private collateral / OTC
  settlement." Same atomic-settlement pattern, different asset package.
- **Decision:** pursue CBTC first; keep cETH as a drop-in second backend. The
  `PaymentDeposit` template is asset-agnostic — swap the deposit for the
  CBTC/cETH Daml package when its interface is available.

### Demo rails (PixelPlex)
- **Console Wallet** — sign `SubmitBid` / `CloseAndReveal` as a real party.
- **CC View** — show the atomic reveal (bid archival + result) in a live explorer.
- **CC Tag** — human-readable party names (Auctioneer / Alice / Bob / Charlie)
  instead of opaque party IDs, so judges can follow the flow.

---

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

The sandbox uses an in-memory ledger, so restarting `cognivern-canton` wipes on-chain state. `Main:setup` re-populates the four demo parties plus the three seeded auctions on each boot, so the demo state is always fresh — but any prod-created rounds' contract IDs become stale.

For a longer-lived deployment, swap `daml start` for a Canton participant configured with PostgreSQL persistence. See the Daml Canton docs on production configuration.

## Test coverage

Two suites cover the sealed-bid backends:

- **Vitest integration** — `tests/integration/canton-sealed-bid.test.ts` boots against a live sandbox on `localhost:7575` and asserts four invariants end-to-end against the Daml JSON Ledger API:
  - **(1) Atomic settlement + winner→winningProposal pass-through** — `create → SubmitBid × 3 → close → CloseAndReveal` picks the right winner, archives every losing `Bid` on-ledger, and the post-reveal ledger read returns zero active `Bid` contracts and exactly one `AuctionResult` whose `winningProposal` field equals the winning bid's `proposalHash` (a literal-value canary that locks the `CloseAndReveal` winner→winningProposal mapping against future Daml refactors).
  - **(2) FHE Option B invariants** — the FHE backend now uses the manager-decrypt-and-publish flow; tests assert the decryption proof requirement and the identity-gated `publishWinner` path on the contract.
  - **(3) Per-round visibility** — each individual bidder sees exactly their own bid for a round (matched by `payload.bidder === partyId`, not just count); manager sees all three.
  - **(4) Cross-leakage guard** — querying the `Bid` template as any individual bidder, at ledger-wide scope, returns only contracts where that bidder is the signatory.
  Round-table queries flow through a single describe-scoped `findRoundOn<T extends { roundId: string }>` helper so a Daml model change that drops `roundId` from a payload fails the file at typecheck. `expect.soft()` propagates per-bidder failures to teardown instead of truncating at the first failing assertion. Auto-skips when the sandbox isn't reachable so it's safe in the default suite.
- **TestSprite CLI** — `.testsprite/tests/sealed_bid_canton_backend.py` runs against the prod URL: full lifecycle with atomic reveal, `backend` field discoverability, reveal-before-close rejection, unknown-bidder rejection. Sits alongside `sealed_bid_endpoints.py` which covers the FHE path.

## Runbook — DevNet cutover (HackCanton S2 shared node)

The team used the shared HackCanton S2 DevNet node. The DAR was uploaded and parties were allocated by a NODERS helper; wallet onboarding created the authenticated Daml user. The remaining steps are:

1. **Build the DAR** with Daml SDK 3.x (LF 2.1):
   ```bash
   cd daml && daml build
   ```
2. **Upload** `daml/.daml/dist/daml-0.0.1.dar` to the participant. If you have admin rights:
   ```bash
   pnpm tsx scripts/hack/bootstrap-devnet.ts
   ```
   Otherwise send the `.dar` to a node admin and ask them to upload it + allocate the demo parties.
3. **Onboard the wallet user** at `https://wallet.validator.hackcanton-01.devnet.naas.noders.services` (Log In with OAuth2). The Daml user ID is the Keycloak `sub` UUID shown after login (e.g. `e6c5f9fc-98ed-491f-b228-00cf931a05cc`).
4. **Grant `actAs` rights** for that user ID to the four demo parties.
5. **Set the production env** from `.env.example` (DevNet section) and redeploy. The JSON Ledger API v2 client is selected automatically when `CANTON_BEARER_TOKEN` or OIDC config is present.
6. **Run the proof** against the live product:
   ```bash
   COGNIVERN_URL=https://cognivern.thisyearnofear.com \
   COGNIVERN_API_KEY=<your-api-key> \
   CANTON_PROOF_MANAGER=auctioner-cognivern \
   CANTON_PROOF_BIDDERS=alice-cognivern,bob-cognivern,charlie-cognivern \
   CANTON_DEVNET_PARTICIPANT='https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443' \
   CANTON_DEVNET_PACKAGE_ID='51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454' \
   CANTON_TEMPLATE_AUCTION='#daml:Main:SealedBidAuction' \
   CANTON_TEMPLATE_BID='#daml:Main:Bid' \
   CANTON_TEMPLATE_RESULT='#daml:Main:AuctionResult' \
   pnpm canton:proof
   ```

The cognivern backend code is participant-agnostic — swapping from sandbox to DevNet is an env change, not a code change.

### Final submission evidence checklist

Capture these before submitting so the deployment requirement is undeniable:

- DevNet participant / validator identifier and JSON API base URL used by the submitted backend.
- Uploaded DAR package ID and the four template IDs configured in production.
- One fresh DevNet lifecycle trace: `SealedBidAuction` create contract ID, three `Bid` contract IDs, `CloseAndReveal` exercise transaction, and resulting `AuctionResult` contract ID.
- A public product URL exercising the DevNet-backed API, plus a screenshot or clip showing create → bid privacy view → reveal.
- A fresh API response with non-expired deadlines or a newly-created round for the demo path.
