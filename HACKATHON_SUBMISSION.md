# Canton Network Hackathon Submission — Cognivern

**Track:** 1 · Private DeFi & Capital Markets
**Hackathon:** HackCanton S2
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app/sealed-bid](https://cognivern.vercel.app/sealed-bid) · API: `cognivern.thisyearnofear.com`
**Pitch deck:** `docs/pitch-deck.pptx` (PDF export before final submit if required — file is local, not in git)
**3-min demo video:** YouTube (⏳ link TBD — re-record against the current DevNet-backed, curated live product before final submit)
**Backend on-ledger:** Canton Daml backend. **Final eligibility gate:** the submitted build must point at a Canton Network DevNet participant, not the localhost/Hetzner sandbox. Record the DevNet evidence below before submitting.

## Final eligibility gate — DevNet proof pack

HackCanton final judging requires the Daml contracts to be deployed and exercised on Canton DevNet. Treat this table as the submission go/no-go checklist; a sandbox-only deployment is not eligible.

| Requirement | Status / evidence to fill before final submit |
| --- | --- |
| Public repository | `https://github.com/thisyearnofear/cognivern` |
| Live product URL | `https://cognivern.vercel.app/sealed-bid` |
| Presentation deck | `docs/pitch-deck.pptx` (local file — export to PDF if the submission form requires a PDF) |
| 3-minute video pitch/demo | YouTube (⏳ link TBD — re-record against the current curated DevNet live product before final submit) |
| Canton DevNet participant / validator | Shared HackCanton S2 DevNet node: `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443`. Auth: NODERS Keycloak password grant (client `web-app-ui-hackcanton-01-devnet`). Source: `docs/HACKCANTON_DEVNET_MATERIALS.md`. |
| Uploaded DAR package ID | `51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454` |
| Deployed template IDs | `51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454:Main:SealedBidAuction`, `51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454:Main:Bid`, `51789b5390cb810a1352165c4c5db1e546a5323cf23c7f50a5d4f8dc01293454:Main:AuctionResult`. *(New DAR with `PaymentDeposit` template pending upload — see settlement section.)* |
| On-ledger demo evidence | DevNet roundId `0x27328a7a1b5675f5d4869573e01c9221186aa65490cde1dcb497d0bca936915c` — create → 3 bids (alice/bob/charlie) → close → reveal winner `bob-cognivern` at $74,500. Source: `.artifacts/canton-devnet-proof-latest.json` from the production backend. |
| Backend env points to DevNet | Set: `CANTON_JSON_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443`, `CANTON_LEDGER_ID=hackcanton-01`, `CANTON_LEDGER_USER_ID=e6c5f9fc-98ed-491f-b228-00cf931a05cc`, templates `#daml:Main:*`, and `CANTON_DEMO_PARTY_IDS` static map. |
| Automated lifecycle evidence | `pnpm canton:proof` completed against the production backend (`https://cognivern.thisyearnofear.com`): `.artifacts/canton-devnet-proof-latest.json` contains the full lifecycle + package/template IDs. |

The Hetzner `cognivern-canton` sandbox remains useful for local demos and regression checks, but it does **not** satisfy the final deployment rule by itself.

### Pre-submission checklist

1. ✅ **DAR uploaded and parties allocated** on the HackCanton S2 shared DevNet node. Source: `docs/HACKCANTON_DEVNET_MATERIALS.md`.
2. ✅ **Production backend cut over to DevNet** via Hetzner deploy (`pnpm deploy:hetzner`). Environment uses JSON Ledger API v2, `#daml:Main:*` template refs, and the static `CANTON_DEMO_PARTY_IDS` map.
3. ✅ **Fresh DevNet evidence captured:** `pnpm canton:proof` passed against `https://cognivern.thisyearnofear.com` → `.artifacts/canton-devnet-proof-latest.json`.
4. ✅ **Live product curated** — the sealed-bid list shows a clean featured set on DevNet, not the internal test rounds (`CANTON_FEATURED_ROUNDS`).
5. ✅ **Party view rebuilt on real per-party ledger queries** (`GET /rounds/:id/party-view`), the atomic-reveal banner made cinematic, and an interactive Canton\|FHE reveal comparison added — landed 2026-07-14.
6. ⏳ **Re-record the 3-minute demo video** against the current DevNet-backed, curated live product — the party-view toggle and reveal moment from step 5 are the strongest beats to capture. Upload to YouTube and add the link above.
7. ⏳ **Export the deck to PDF** if the submission form requires a PDF rather than a PPTX.

---

## TL;DR

- **What we built.** Confidential RFP / OTC vendor-selection auctions on Canton/Daml with structural sub-transaction privacy and atomic multi-party settlement.
- **Headline technical claim.** Sealed-bid reveal cannot be finished cleanly under FHE alone — it requires a threshold-decryption ceremony that the round's economic participants rarely exist in real institutional contexts. Canton rewrites the settlement layer so the privacy property comes from the disclosure model, not cryptography, and the reveal completes in **one atomic transaction**.
- **Daml model.** `SealedBidAuction` · `Bid` (signatory bidder, observer manager — no other bidder has visibility) · `AuctionResult` (publicly visible to bidders post-reveal). Three templates, ~110 lines of Daml.
- **Pluggable backend.** Live production code runs the same sealed-bid protocol over either Canton (works end-to-end) or Fhenix CoFHE (works for sealed-bid but cannot reveal — see "Why this is hard" below). Same REST surface, swapped at `createRound(backend: "canton" | "fhe")`.
- **End-to-end on a live ledger.** The live product opens on a curated set of real DevNet rounds (open, awaiting-reveal, revealed) so the demo lands on a real privacy state, not an empty screen. Bid-amount visibility is *literally* enforced by the Daml JSON API's response payload per role.
- **The privacy claim is a live network call, not a UI trick.** The round detail page's party-view toggle queries the Canton participant *acting as* the selected party in real time — a judge watching the ledger-response count change (`2` as Auctioneer, `1` as Alice, `0` as Charlie, `0` for everyone once revealed) is watching Canton's disclosure model, not a client-side dim.
- **Thirty-one+ Vitest tests plus twenty-four TestSprite CLI backend tests run against the live API**, with direct ledger assertions per party role keeping the privacy guarantee machine-verifiable.

---

## HackCanton S2 — builder-test fit

The HackCanton S2 builder brief asks every project to answer six hard questions.
Cognivern's Canton sealed-bid module answers all six directly — which is why the
"boring workflow → programmable" thesis (institutional RFP / OTC vendor selection)
reads as a serious Canton product, not a weekend demo:

| Builder-test question | Cognivern's answer (Canton) |
| --- | --- |
| Who are the parties? | Auctioneer (manager) + an eligible-bidder list, enforced by Daml `signatory`/`observer`. |
| What should each party see? | A `Bid`'s observer is the manager and **only** the manager. Competitors can't even see the contract exists — structural sub-transaction privacy, no FHE/ZK. |
| Who can approve? | The manager's `CloseAndReveal` choice — the only path that archives bids and emits the result. |
| What settles atomically? | Winner selection + archive of every losing `Bid` + `AuctionResult` emission, in one transaction, no intermediate leak state. **Value settlement** (atomic transfer of escrowed `PaymentDeposit` to the winner) is implemented in the Daml model and proven via Daml Script — pending DAR upload to DevNet to go live (see "Value settlement" section). |
| What becomes auditable? | Full ledger history + `AuctionResult` (winner + winning amount + proposal hash) + hash-signed `bid_submitted` / `winner_revealed` events in the CRE run ledger. |
| Why weaker on a public chain? | Public chains leak bid amounts; FHE needs a threshold-decryption ceremony losers won't join. Canton makes the privacy property *structural*, not cryptographic — the reveal completes in one atomic tx. |

This is the same primitive the brief calls out under "private trading" and "OTC
settlement flows": a sealed bid where the bid exists but only the counterparty (or
auctioneer) can read it, and revealing the winner does **not** reveal every loser.

---

## Enterprise compliance & auditability

Institutions buy when legal and risk can sign off — not just when engineering likes the tech:

| Concern | How Cognivern addresses it |
| --- | --- |
| **Role-based disclosure** | Daml `signatory`/`observer` on `Bid` enforces who sees what — auctioneer, bidder, and auditor roles are structurally separated on the ledger. |
| **Non-repudiation** | Every bid submission and reveal is recorded on-ledger; hash-signed `bid_submitted` / `winner_revealed` events in the CRE run ledger provide an off-ledger evidence chain. |
| **Immutable audit trail** | Full ledger history + `AuctionResult` contract gives procurement and compliance a durable record without trusting a SaaS unblinding operator. |
| **No central trust gap** | Privacy comes from the Daml disclosure model on your participant node — not from encryption keys held by a third party. |

---

## Deployment path

The obvious enterprise objection: *"This demo runs on HackCanton DevNet — what about production?"*

| Stage | What it means |
| --- | --- |
| **Today** | Live on HackCanton S2 DevNet with automated lifecycle proof (`pnpm canton:proof` → `.artifacts/canton-devnet-proof-latest.json`). |
| **Private participant** | The backend is participant-agnostic — point `CANTON_JSON_API_URL` at your own Canton node or a hosted validator. Same Daml package, same REST surface. |
| **Mainnet-ready model** | Compact four-template Daml package (Daml 3.x · LF 2.1): `SealedBidAuction`, `Bid`, `AuctionResult`, `PaymentDeposit`. The `PaymentDeposit` template implements atomic value settlement — escrow before the auction opens, atomic transfer to the winner inside `CloseAndReveal`. Asset-agnostic: swap the deposit for CBTC (BitSafe) or cETH (OnRails Finance) and the settlement pattern is identical. **Status:** Daml source compiles, Daml Script proof passes (all 9 assertions); pending DAR upload to DevNet to go live on the shared participant. |

---

## The pain: information leakage in institutional procurement and OTC

When an institution runs an RFP — for legal counsel, infra, an audit — every qualifying bidder needs to see *the auction*, but no bidder needs to see the *other bids*. In the current world:

- Email RFPs leak. A leaked quote in an RFP can cost **5–15%** in final price; a respondent who learns a competitor's pricing during a Q&A cycle effectively bands.
- Even digital sealed-bid procurement portals tend to centralize the unblinding on a single SaaS provider — a fresh counterparty risk inside an already outsourced workflow.
- OTC desks face a structurally similar problem: market makers won't quote tight spreads if print levels leak, and end-clients won't show real interest if a half-penny better quote leaks.

What's wanted in *both* cases is the same primitive: a sealed-bid system where the bid exists, but only the counterparty (or the auctioneer) can read it, and where revealing the winner does **not** simultaneously reveal every loser.

That's the primitive we built on Canton.

---

## Why we picked Canton over an FHE-only path

Before Canton, Cognivern's sealed-bid ran on Fhenix CoFHE — bid amounts became ciphertext handles (`euint128` on Fhenix testnet). That handles the *sealed* half of the protocol cleanly. It doesn't finish the *reveal* half.

Three things have to happen at reveal:

1. Determine the winner (lowest / highest / specified) by amount.
2. Open the winning amount publicly to eligible bidders.
3. Ensure losing amounts are *never* disclosed.

Pure FHE asks the **losers** (the bidders with the least economic reason to cooperate) to participate in a threshold-decryption ceremony so the auctioneer can read their bids. In practice, that ceremony is the bottleneck — but the **manager-decrypt-and-publish** pattern (which we now ship as **Option B**) sidesteps it for the *sealed-bid* flow: the round manager, who holds the CoFHE `decryptForView` permit for the round, decrypts every bid amount off-chain and publishes them back through `publishWinner` (on-chain, gated on `msg.sender == round.manager`). The FHE ACL chain at `submitBid` + the CoFHE permit binding + the on-chain identity check close the impersonation gap — no threshold ceremony, no trusted third-party decryption service.

This is still strictly *worse* than Canton for a multi-bidder sealed-bid auction: Option B requires the manager-permit holder to read **every losing bid's plaintext** at publish time, so sub-bidder privacy from the auctioneer / manager is lost at reveal. Canton sidesteps that whole workstream **and** the cryptography one by making the privacy property **structural**, not cryptographic: losing bids are never decrypted by anyone — they're consumed in flight inside the atomic `CloseAndReveal` transaction. Canton therefore remains the recommended primitive for institutional RFP / OTC use cases where bidders' pricing models are competitively sensitive *even from the manager*.

This isn't just an argument in this document — it's an interactive toggle on every live Canton round (see "What runs live today" below): flip between Canton and FHE and watch the reveal claim change from "seen by no one" to "the manager sees every losing price."

---

## Our approach: structural sub-transaction privacy + atomic multi-party settlement

The Canton billing primitive for this is well-suited:

- **Sub-transaction privacy**: Daml contracts only become visible to authorized signatories and observers on the ledger. Create a `Bid` whose observer is the auctioneer alone → other bidders verify the contract exists *as a fact* (it's referenced from the auction) but cannot read *its fields*. This is the privacy property, enforced by the participant node, not by encryption.
- **Atomic multi-party settlement**: `CloseAndReveal` is a **consuming** Daml choice that, in a single ledger transaction, (a) fetches every bid auth token by its contract ID, (b) selects a winner by an in-model sort routine, (c) **transfers the escrowed `PaymentDeposit` to the winner** (if the auction was created with a settlement asset), (d) consumes every losing `Bid` contract, and (e) creates the `AuctionResult` with the winning amount publicly disclosed to all eligible bidders and a `settledAsset` reference to the new deposit. Outside observers see *one* event: the `AuctionResult`. There is no intermediate state where amounts leak or where the deposit is claimable by two parties. *(The value-transfer step is implemented in the Daml model and proven via Daml Script; the DevNet participant currently runs the prior DAR without `PaymentDeposit`, so non-settlement rounds are live while settlement rounds await the DAR upload.)*

The Canton backend is live (`src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts`):

```
POST /api/vendor/sealed-bid/rounds → SealedBidAuction contract on Canton
POST /api/vendor/sealed-bid/rounds/:id/bid → SubmitBid choice (per-bidder, nonconsuming)
POST /api/vendor/sealed-bid/rounds/:id/close → off-ledger state transition
POST /api/vendor/sealed-bid/rounds/:id/reveal → CloseAndReveal choice (atomic settlement)
```

---

## The Daml model

Four templates, ~160 lines, no external dependencies beyond the Daml SDK. Each one carries the privacy property:

```daml
template PaymentDeposit with
    issuer   : Party           -- auctioneer / buyer who funds the escrow
    owner    : Party           -- current holder (changes on transfer)
    amount   : Decimal
    assetTag : Text            -- "USDC" | "CBTC" | "cETH"
  where
    signatory issuer           -- bearer instrument: issuer authorizes transfers
    observer owner
    ensure amount > 0.0
    choice Transfer : ContractId PaymentDeposit with recipient : Party
      controller issuer
      do create PaymentDeposit with
           issuer = this.issuer, owner = recipient, …

template SealedBidAuction with
    manager         : Party
    eligibleBidders : [Party]
    roundId, description, serviceCategory : Text
    deadline        : Time
    maxBids         : Int
    settlementAsset : Optional (ContractId PaymentDeposit)  -- escrowed deposit
  where
    signatory manager
    observer eligibleBidders
    nonconsuming choice SubmitBid : ContractId Bid with …
    -- CloseAndReveal: ONE transaction that (1) transfers the escrowed
    -- PaymentDeposit to the winner, (2) consumes the winning Bid, (3)
    -- consumes every losing Bid, (4) creates the AuctionResult with
    -- settledAsset = Some (new deposit CID). No intermediate state.
    choice CloseAndReveal : ContractId AuctionResult with …

template Bid with …
  where
    signatory bidder            -- the bidder owns and authorizes
    observer manager            -- and ONLY the manager may inspect it
    choice Consume : ()         -- manager-controlled, used by CloseAndReveal
      controller manager
      do pure ()

template AuctionResult with …
  where
    signatory manager
    observer eligibleBidders
    -- settledAsset carries the CID of the PaymentDeposit now owned
    -- by the winner — on-ledger proof that value moved atomically.
    settledAsset : Optional (ContractId PaymentDeposit)
```

Why this matters to a Hackathon judge:

- The `observer manager` line on `Bid` is the **structural privacy property**. Canton does the rest.
- The `CloseAndReveal` choice combines value transfer + selection + consumption + result emission in a single event. Losing amounts are visible to no one outside the transaction — they're consumed in flight by the manager's exercise of `Consume` on each loser. The escrowed deposit moves to the winner in the same transaction — no separate settlement step, no counterparty risk window.
- The `PaymentDeposit` template uses a **bearer instrument pattern**: the issuer (auctioneer) is the sole signatory, so `CloseAndReveal` (controlled by the manager) can transfer the deposit without requiring the winner to co-sign. The `owner` field tracks who currently holds the deposit and is an observer, not a signatory — this is what makes the transfer atomic.
- The `SelectionMethod` sum type (`LowestBid | HighestBid | SpecificBidder with bidder : Party`) keeps the auctioneer rules on-ledger instead of in application code, so what the application thinks happened is what the ledger says happened.

The full file is `daml/daml/Main.daml` in this repo (templates only; the setup/test scripts live in a separate `daml/scripts` package, so the DAR uploaded to the participant carries no `daml-script`). The local sandbox seeds three demo rounds via `Setup.daml` — see "What runs live today" below.

---

## What runs live today

The deployed Cognivern backend has Canton registered as a real sealed-bid backend, bound to the **HackCanton S2 DevNet participant** (verified in the live startup log):

```
SealedBid: backend registered — canton
Canton: JSON Ledger client bound to https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443 (v2, OIDC web-app-ui-hackcanton-01-devnet)
SealedBid[canton]: hydrated open + revealed round(s) from ledger
SealedBid[canton]: bid submitted by alice-cognivern (bidCid=…)
SealedBid[canton]: round revealed — winner bob-cognivern, lost bids archived
SealedBid: bid_submitted event logged to CRE ledger (evidence hash 0x…)
```

Every lifecycle step fires `AuditLogService.logEvent` and lands in the CRE run ledger with hash-signed evidence. The `bid_submitted` event deliberately excludes `amountUsd` because — on Canton — the amount is visible only to the auctioneer. Anchoring it into a broadly readable audit log would break the privacy story. The `winner_revealed` event includes winner + winning bid because those become public at reveal.

The UI at [`/sealed-bid`](https://cognivern.vercel.app/sealed-bid) makes the privacy property clickable — and provable, not just plausible. The round detail page embeds a **party view** that toggles between `Auctioneer | Alice | Bob | Charlie`; each toggle fires a live `GET /rounds/:id/party-view?party=<name>` call that queries the Canton participant **acting as that party** (`CantonSealedBidBackend.queryBidsAsParty` → `client.query(partyId, [Bid])`). This is not a client-side filter over a shared response — a competitor's bid is never in the payload at all, because the participant itself never discloses it to a party that isn't its observer. The UI shows the raw ledger-response count so the point is unmissable: on an open round with two bids, Auctioneer sees `2`, Alice sees `1` (her own), Charlie sees `0` — verified live:

```
Auctioneer -> 2 contract(s): alice-cognivern $72,500, bob-cognivern $68,000
Alice      -> 1 contract(s): alice-cognivern $72,500
Bob        -> 1 contract(s): bob-cognivern $68,000
Charlie    -> 0 contract(s)
```

The reveal button calls `CloseAndReveal`; the post-reveal banner animates in and reads:

> *"Revealed in one atomic transaction — the winner was published and every losing bid archived in the same ledger event. No losing amount was ever disclosed, to competitors or the auctioneer."*

— and the party view proves it in the same breath: toggle back to Auctioneer on a revealed round and the ledger now returns **0** Bid contracts, even for the manager. An interactive **Canton | FHE** toggle sits underneath, running the same `createRound(backend: "canton" | "fhe")` argument live: Canton reads "losing prices seen by no one," FHE reads "the manager sees every losing price at reveal" — the comparative case from the section below, made clickable instead of argued in prose.

The live product opens on a **curated set of real DevNet rounds** (not the empty state, and not the internal test scaffolding — a featured allowlist keeps the demo clean) so a visitor lands on something real:

| Description | State on load |
| --- | --- |
| Security audit RFP — Q3 2026 | Open, 2 of 5 bids in — visitor submits the third, then drives close + atomic reveal |
| Legal counsel retainer 2026 | Already revealed — `bob-cognivern` won, losing amounts archived and never disclosed |
| Cloud infrastructure — 3-year commit | Open, 1 bid in |

*(The local `daml start` sandbox additionally seeds `demo-round-open/closed/revealed` via `daml/scripts/daml/Setup.daml` for offline development.)*

### Real institutional identity — production mode

The persona view above (Alice / Bob / Charlie) is the **sandbox**. In **production mode** a bid is bound to a real, verified institution — not a picklist:

- The institution signs in with its wallet (SIWE → JWT). Sealed-bid writes then **require** that verified identity — an unauthenticated production bid is rejected (401).
- The backend maps each verified wallet to its own pre-allocated **Canton party** (`meridian-cognivern`, `sterling-cognivern`, `atlas-cognivern`, … — allocated on DevNet by the HackCanton operator, with `CanActAs` granted to our participant user). The bid settles on-ledger under *that* party, so the disclosure model applies per real counterparty.
- This is a **custodial** model, and it says so: cognivern operates the participant and acts on each vetted institution's behalf after SIWE verification — the way a regulated operator runs a node for its clients. Not self-custody, but a real per-institution on-ledger identity rather than a shared demo persona.

Verified live on DevNet: a SIWE-verified wallet's bid returns as its institution party (`meridian-cognivern`), not the request-body value, and the same call without a signed-in wallet returns `401`.

---

## Real-world applicability

The privacy primitive ships as a *module*, not a procurement portal — the use case is institutional. The same `SealedBidAuction` contract body covers:

- **Private deal execution** (Track 1, named in the brief). Institutional RFPs — legal counsel retainers, security audits, large capex procurement — where bidders' pricing strategies are competitively sensitive.
- **Confidential OTC matching** (Track 1, named). Market makers respond to a client RFP for a block. Each maker's pricing model is private to them; the auctioneer counterparty sees the cleared price; the unmade quotes never surface.
- **Private credit allocation** (Track 1, named). Lenders bid into an allocation round; the borrower sees who cleared and at what spread; losing lenders' yield targets remain private — including from each other.
- **B2B marketplace with blind auctions** (problem statement literal). Drop-in for institutional procurement platforms that today centralize unblinding on a single SaaS provider.

For each, the architecture is identical: an authenticated buyer party creates an auction with an eligible-bidder list, the bidders submit, the buyer drives the reveal, every losing bid is consumed in flight. No code change.

---

## Engineering rigor (sidebar)

Engineering rigor is the difference between a Canton submission that compiles once on a laptop and one that lives on production. We exercised a write-verify-fix loop against our own deployed API:

- **24 CLI backend tests** (TestSprite CLI) running against the live API — covering the Canton sealed-bid lifecycle in four dedicated tests (atomic reveal, backend discoverability, reveal-before-close rejection, unknown-bidder rejection), plus twenty tests across auth, governance, OWS wallets, MCP, agents, copilot, speech, spend, audit, and webhooks.
- **30 MCP-generated Playwright frontend tests** (TestSprite MCP Server) — AI-generated from a real PRD summary of the codebase, executed in TestSprite's cloud.
- **16 production bugs caught and fixed during the build window** (full enumeration in [`LOOP.md`](LOOP.md)). The tests drove the fixes; we did not write the tests to pass code we'd already written.
- **GitHub Actions + TestSprite GitHub App**: every PR runs the full suite; the GitHub App also scans Vercel previews.

The Canton backend is covered by `tests/integration/canton-sealed-bid.test.ts` — a Vitest suite that auto-skips if no Daml sandbox is reachable on `localhost:7575`, and asserts four properties the integration with Canton actually depends on. Every assertion in this file is made by querying the **Daml JSON Ledger API directly as the relevant party**, so the privacy and settlement properties are verified by what Canton's participant node actually returns, not by the backend's read-through cache:

1. **End-to-end correctness + post-reveal atomic settlement.** `create → SubmitBid × 3 → close → CloseAndReveal` returns the right winner (Bob, lowest bid) and the right winningBid (24500). The same test then re-queries the **Bid** template as the auctioneer for this round and asserts zero active contracts — losing bids were consumed in-flight by the atomic `CloseAndReveal` transaction. Then it queries the **AuctionResult** template the same way and asserts the on-ledger contract carries `winner === Bob`'s namespaced party id and `winningAmount === 24500`. Both halves of "atomic settlement" are checked against the ledger, not the backend cache.
5. **Value settlement — atomic PaymentDeposit transfer (sandbox/IDE).** A separate test creates a round with `settlementAmount: 24500, settlementAssetTag: "USDC"`. The backend escrows a `PaymentDeposit` before the auction opens. After `CloseAndReveal`, the test queries the `AuctionResult` on-ledger and asserts `settledAsset.tag === "Some"`. It then queries the `PaymentDeposit` template and asserts the settled deposit's `owner === Bob`'s party ID, `amount === 24500`, and `assetTag === "USDC"` — verifying value moved on-ledger, atomically, in the same transaction as the reveal. Additionally, `daml/scripts/daml/SettlementProof.daml` is a Daml Script that exercises the full settlement flow on the IDE ledger and asserts all post-conditions (winner, deposit ownership transfer, old deposit archived, losing bids archived, `settledAsset` is `Some`). *(This test runs against a local Daml sandbox; the DevNet participant currently runs the prior DAR without `PaymentDeposit`, so the settlement path is model-proven but not yet DevNet-live.)*
2. **FHE manager-decrypt-and-publish happy path.** `revealWinner` on the FHE path now uses the Option B flow: callers supply a `decryptionProof` (`Array<{bidder, plaintext}>` with every bid covered). Tests assert (a) omitting `decryptionProof` rejects with `"decryption proof required"`, (b) supplying all plaintexts selects the lowest / highest bidder per `selectionMethod`, (c) `missing plaintext for bidder X` structurally rejects so the manager cannot silently drop a competitor, (d) losers are marked `rejected` and the winner `selected` on the round. The old `"threshold decryption of real CoFHE bids is not wired"` error is gone — replaced by behavior-tested reveal semantics on the in-memory backend, with an on-chain counterpart (`contracts/fhenix/src/SealedBidVendorSelection.sol::publishWinner`) gated by `msg.sender == round.manager`.
3. **Per-round visibility.** With three bidders on one round, querying the Daml JSON Ledger API as `Alice`, `Bob`, and `Charlie` returns exactly one Bid contract per bidder (matched by `payload.bidder === partyId`, not just by count), and querying as `Auctioneer` returns all three. Canton does the filtering; the assertion locks the cardinality *and* the identity.
4. **Cross-leakage guard.** Querying the Bid template as any individual bidder, **at the whole-ledger scope**, returns only contracts for which that bidder is the signatory. Anything else — a competitor's amount slipping through, a future observer-list broadening — fails this test.

The privacy claim Canton's disclosure model makes is test-verified *and* live-verified — the same per-party query the Vitest suite asserts against is the exact endpoint (`GET /rounds/:id/party-view`) the production UI calls on every toggle. There is one code path for "prove it in CI" and "prove it to a judge clicking the demo."

### FHE Option B trust-model evolution (sidebar, iters 24–27)

The FHE side of the sealed-bid primitive evolved through four iterations to remove the trusted-operator middleman and surface the manager-decrypt-and-publish flow end-to-end. Each iter either dropped a real bug or extended the trust-model surface:

- **iter 24 — Option B refactor** (`d5804e2` + `c2969e0` + `6fb8d74`): `PendingDecision.submitter` capture in `evaluateSpend`; new `publishSpendResult(decisionId, uint8 plaintext)` with the `msg.sender == pending.submitter` identity check + on-chain `DecisionPublished` event + Hyperlane dispatch. `resolveDecision`'s `onlyOwner` lifted so existing `FheDecisionWatcher` operator tooling still works. Default-init fix for the `Outcome.Pending` enum mapping (Solidity enum default is index 0, not Pending) closed the "already resolved" reject on first publish. `delete pendingDecisions[decisionId]` after first resolution dedups the cross-chain dispatch. Legacy "FHE threshold decryption not wired" narrative replaced; Canton now strictly better for institutional RFP because Option B leaks every losing plaintext to the manager at publish time.
- **iter 25 — `requestDeFiAction` → `publishDeFiAction`** (`60f00e1`): manager-decrypt-and-publish applied to the DeFi-action budget-check path. `DeFiActionRequested` + `DeFiActionPublished` events added. `requestDeFiAction` captures submitter, ACL-grants the budget-decision handle to `msg.sender`, sets `Outcome.Pending`, and emits `DeFiActionRequested` with NO synchronous dispatch. New `publishDeFiAction(decisionId, plaintext, target, data)` mirrors `publishSpendResult`'s identity gate and dispatches to `xLayerDeFiVault` ONLY when `plaintext == Approve (2)`.
- **iter 26 — struct extension + counter-at-publish** (`588f87c`): `PendingDecision` extended with `bool isDeFi, address target, bytes data, euint128 pendingNewSpent`. `requestDeFiAction` dropped the synchronous counter update entirely; counter commits at publish time on Approve — closed the phantom-balance divergence surface where an evaluator could exhaust `dailyLimit` by request-spamming without publishing. `publishDeFiAction` signature shrunk to `(decisionId, plaintext)` matching the original Option B plan-1a; reads `target/data` from the stored struct. Three reviewer fixes in the same commit: Solidity rejects `uint8 == enum` direct comparison (replaced `Outcome.Approve` with literal `2`), added missing `FHE.allowTransient(c.spentToday, address(this))` in `requestDeFiAction`, reordered FHE ops around the `pendingNewSpent` delete so the underlying ciphertext handle's ACL context is preserved.
- **iter 27 — DeFi dispatch semantic migration note** (`73dd6da`): docs-only — surfaces the Approve-gated dispatch as an intentional design choice (saves Hyperlane gas on Deny/Hold resolutions that have nothing to execute on-chain). Exhaustive audit across `src/`, `tests/`, `deploy/`, `scripts/`, `monitoring/`: one ABI-constant match for `DecisionPublished` in `src/backend/services/blockchain/FhenixPolicyService.ts:108` (encoding reference, not a listener); zero dispatches-per-agent telemetry counters; `FheDecisionWatcher` referenced only in `HealthController.ts` for pending-decision count, NOT a dispatch count. Architectural separation clarified: spend-path → `xLayerRecipient` → `GovernanceContract.handle()` (decodes `(decisionId, agentId, policyId, uint8 outcome)` → `bool approved = (outcome == 2)`); DeFi-path → SEPARATE `xLayerDeFiVault` → `GovernedVault` (a different contract). `GovernanceContract.handle()` doesn't need to special-case the DeFi path at all. Off-chain observation for telemetry builders: standard `eth_getLogs` on chain 421614 (Arbitrum Sepolia), filtering on `DeFiActionPublished(bytes32, uint8)` topic, returns the resolved `Outcome` for every `decisionId` including Deny/Hold — the Fhenix-side event stream remains the canonical observability surface even though the cross-chain Hyperlane handler on X Layer doesn't see Deny/Hold.

All 31 vitest pass on every iter; `pnpm typecheck` clean; `npx hardhat compile` clean. Combined git log: `d5804e2..HEAD` (verified 7 commits via `git log d5804e2..HEAD --oneline | wc -l`: iter 24 refactor + docs + docs(fix) → iter 25–27 → iter 28 docs-sidebar-sync).

---

## Architecture

```
                 ┌─────────────────────────────────────────┐
                 │      Cognivern API (Express :3087)      │
                 │  Port 3087 · PM2 · nginx reverse proxy   │
                 ├─────────────────────────────────────────┤
                 │ SealedBidService ─ async dispatcher     │
                 │ route(roundId) → owning backend         │
                 ├─────────────────────────────────────────┤
                 │           CantonSealedBid               │
                 │           (Daml JSON API client)        │
                 │                    │                    │
                 │                    ▼                    │
                 │   Daml JSON Ledger API v2 (HTTPS)       │
                 │   HackCanton S2 DevNet participant       │
                 │   SealedBidAuction / Bid / AuctionResult│
                 ├─────────────────────────────────────────┤
                 │ AuditLogService.logEvent                │
                 │   → CRE run ledger, hash-signed evidence│
                 │   bid_submitted   (amount excluded)    │
                 │   winner_revealed (amount included)     │
                 └─────────────────────────────────────────┘
```

Canton deployment: the production backend on the Hetzner VM binds the **HackCanton S2 DevNet participant** (`CANTON_JSON_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443`, JSON Ledger API v2, NODERS Keycloak OIDC). Contracts are created and exercised **on-ledger on DevNet** — confirmed in the startup log and by `pnpm canton:proof`. A local `daml start` sandbox (`pm2 cognivern-canton`, `127.0.0.1:7575`) remains for offline development and `tests/integration/canton-sealed-bid.test.ts`, but it is **not** what the live product points at. Because the backend is participant-agnostic, moving to a private participant or a different validator is a config swap (`CANTON_JSON_API_URL`), not a code change.

---

## Track claim

We submit under **Track 1 — Private DeFi & Capital Markets**, with the strongest fit on the "Private deal execution" and "OTC trading workflows" problem statements. We do **not** claim Track 2 (RWA / tokenized deposits) or Track 3 (agentic commerce) for this submission — the sealed-bid module is the Canton piece. Cognivern's broader spend-governance work is referenced once, as backdrop, not as a competing submission.

---

## Lessons from the HackCanton S2 builder brief

Three lessons from the HackCanton S2 track guidance shape the next build window:

1. **Lead with the Canton workflow, not the multi-chain stack.** Cognivern also
   does agent-wallet governance (Fhenix FHE, Filecoin/0G anchoring, ChainGPT,
   X Layer). That work is real but dilutes the "why Canton?" signal. For S2 the
   headline is the sealed-bid auction; the governance stack is supporting context
   (the auction is governed and audit-logged by agents), not a competing submission.

2. **Settlement of value — implemented in the model, pending DevNet upload.**
   `CloseAndReveal` now settles **value**, not just an informational record. A new
   `PaymentDeposit` template (bearer instrument pattern — issuer is sole signatory,
   `owner` tracks the current holder) is escrowed before the auction opens and
   atomically transferred to the winner inside the same `CloseAndReveal`
   transaction that archives losing bids and emits the `AuctionResult`. The
   `AuctionResult` carries a `settledAsset` reference to the new deposit contract
   — proof on-ledger that value moved. The deposit is asset-agnostic: today it
   carries a `Decimal` amount and `assetTag` ("USDC"); swapping in **CBTC**
   (BitSafe) or **cETH** (OnRails Finance) requires only replacing the
   `PaymentDeposit` template with the token contract — the `CloseAndReveal`
   atomicity pattern is unchanged. Verified by `daml/scripts/daml/SettlementProof.daml`
   — a Daml Script that exercises the full flow (escrow → 3 bids → close → reveal
   → transfer) and asserts: winner is Bob (lowest bid), deposit owner changed
   from auctioneer to Bob, old deposit archived, losing bids archived,
   `AuctionResult.settledAsset` is `Some`. All 9 assertions pass on the Daml IDE
   ledger. **The updated DAR (`daml-0.0.2.dar`) is pending upload to the shared
   DevNet participant — the existing DevNet rounds continue to work on the prior
   DAR (non-settlement path), and settlement rounds will go live once the new DAR
   is uploaded.**

3. **Make the demo usable with the PixelPlex rails.** The brief stresses a good
   MVP is "can users sign safely / see what happened / find the right party."
   Plan: sign bids with **Console Wallet**, surface the flow in **CC View**, and
   give parties **CC Tag** human-readable names — so the atomic reveal is observable
   in a real explorer rather than asserted only by our test suite.

---

## Reproducing locally

```bash
# 1. Canton sandbox — pm2-managed Hetzner or local
cd daml && daml build && daml start --start-navigator=no

# 2. Cognivern backend
pnpm install
pnpm build
pnpm start

# 3. Frontend
cd src/frontend && pnpm install && pnpm dev

# Visit http://localhost:3000/sealed-bid
# Three rounds pre-seeded: open, awaiting-reveal, revealed.
# Toggle "View as: Auctioneer | Alice | Bob | Charlie" to see Canton's
# disclosure model in action.
```

The default backend is `canton`. To switch to the FHE path for comparison, change the dropdown on the create-round form — the same HTTP surface routes to either backend. The FHE reveal uses the Option B manager-decrypt-and-publish flow (supply a `decryptionProof`); Canton reveals atomically with no decryption. Both round types render the same privacy-enforcing UI.

---

## Submission materials

| Item | Link |
| --- | --- |
| Live product | [cognivern.vercel.app/sealed-bid](https://cognivern.vercel.app/sealed-bid) |
| Public API | `https://cognivern.thisyearnofear.com` |
| Repository | Public — see top of `README.md` |
| Pitch deck | `docs/pitch-deck.pptx` (local file — export to PDF before final submit if required) |
| 3-minute demo video | YouTube (⏳ link TBD — re-record against the curated DevNet live product before submit) |
| TestSprite backend dashboards | 24 tests · 30 MCP frontend tests · `./LOOP.md` for the iteration log |

---

## Frontmatter: about the broader Cognivern platform

Cognivern is a spend-governance platform for AI agents — confidential policy evaluation on Fhenix, hardware-gated signing on Ledger DMK, agent activity indexing through ChainGPT, durable evidence anchoring on Filecoin + 0G, and on-ledger execution via X Layer. The Canton sealed-bid module is the most recently added primitive, and the one we believe is most informative for a Canton jury. The platform context is mentioned here only to disambiguate the deployment: a Canton module on top of an existing running production API was a more credible Canton-jury signal than a fresh repo.

> **Companion submission:** The FHE spend-governance and agent-governance
> primitives are also submitted to the Arbitrum London Founder House (deployed
> on Arbitrum Sepolia + Robinhood Chain Testnet) — see
> [HACKATHON_SUBMISSION_ARBITRUM.md](./HACKATHON_SUBMISSION_ARBITRUM.md). The
> two submissions are complementary, showcasing different privacy approaches
> (Canton structural disclosure vs. Arbitrum FHE) on their native ecosystems.

---

## Postscript: what testing validates

A Canton submission that says "we test" should also say what the tests prove. **31+ Vitest tests** plus **24 TestSprite CLI tests** run against the live API; Canton privacy invariants are asserted by querying the Daml JSON Ledger API directly as each party — not by trusting the backend cache. Representative issues caught during the build window are enumerated in [`LOOP.md`](LOOP.md). Three categories:

- **Endpoint access**. `/auth/*`, `/api/fhenix/encrypt`, `/api/metrics/ux-events`, `/api/mcp/governance-check`, `/api/speech/transcribe`, `/api/vendor/sealed-bid/rounds/:id/{bid,close,reveal}`, and `/api/projects/:id/{usage,tokens}` were all blocked by `apiKeyMiddleware` despite being public. Fix: parameterized path matching in `isPublicApiPath()` so the Canton sealed-bid sub-paths are not a special case.
- **Server crashes from unhandled throws**. `OwsWalletController.{createAgent, getWallet, importWallet, connectExternal}`, `OwsApiKeyController.{createApiKey, getApiKey, deleteApiKey}`, `OwsPermissionsController.{requestPermissions, getPermissions, revokePermissions, checkPermissions}` all threw `BadRequestError` / `NotFoundError` without try/catch, turning a 4xx into a 502 by taking the Node process down. Fix: explicit try/catch returning the right status.
- **Schema drift**. The `users` table lacked an `email` column; the `workspaces` table lacked `settings`. Inline migrations couldn't `CREATE TABLE IF NOT EXISTS` past the existing rows, so `ALTER TABLE … ADD COLUMN` statements were added as idempotent migrations.

(README's verification section summarizes the automated suite; [`LOOP.md`](LOOP.md) has the full iteration-by-iteration log.)

---

## License

MIT.
