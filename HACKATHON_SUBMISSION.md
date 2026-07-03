# Canton Network Hackathon Submission — Cognivern

**Track:** 1 · Private DeFi & Capital Markets
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app/sealed-bid](https://cognivern.vercel.app/sealed-bid) · API: `cognivern.thisyearnofear.com`
**Pitch deck & 3-min demo video:** in this repo at `docs/pitch-deck.pdf` and `docs/demo-video.mp4`
**Backend on-ledger:** Canton Daml sandbox (pm2 process `cognivern-canton` on the Hetzner production VM; participant-agnostic — swap `CANTON_JSON_API_URL` to point at a Canton Network DevNet node without code changes)

---

## TL;DR

- **What we built.** Confidential RFP / OTC vendor-selection auctions on Canton/Daml with structural sub-transaction privacy and atomic multi-party settlement.
- **Headline technical claim.** Sealed-bid reveal cannot be finished cleanly under FHE alone — it requires a threshold-decryption ceremony that the round's economic participants rarely exist in real institutional contexts. Canton rewrites the settlement layer so the privacy property comes from the disclosure model, not cryptography, and the reveal completes in **one atomic transaction**.
- **Daml model.** `SealedBidAuction` · `Bid` (signatory bidder, observer manager — no other bidder has visibility) · `AuctionResult` (publicly visible to bidders post-reveal). 79 lines of Daml.
- **Pluggable backend.** Live production code runs the same sealed-bid protocol over either Canton (works end-to-end) or Fhenix CoFHE (works for sealed-bid but cannot reveal — see "Why this is hard" below). Same REST surface, swapped at `createRound(backend: "canton" | "fhe")`.
- **End-to-end on a live ledger.** Three demo rounds pre-seeded at sandbox boot — one open, one closed awaiting reveal, one already revealed — so the demo video lands on a real privacy state, not an empty screen. Bid-amount visibility is *literally* enforced by the Daml JSON API's response payload per role.
- **Twenty-four CLI backend tests + thirty MCP-generated Playwright frontend tests run against the live API.** Sixteen production bugs were caught and fixed during the build window by the same write-verify-fix loop.

---

## The pain: information leakage in institutional procurement and OTC

When an institution runs an RFP — for legal counsel, infra, an audit — every qualifying bidder needs to see *the auction*, but no bidder needs to see the *other bids*. In the current world:

- Email RFPs leak. A respondent who learns a competitor's pricing during a Q&A cycle effectively bands.
- Even digital sealed-bid procurement portals tend to centralize the unblinding on a single SaaS provider — a fresh counterparty risk inside an already outsourced workflow.
- OTC desks face a structurally similar problem: market makers won't quote tight spreads if they know other makers' print levels, and end-clients won't show real interest if a half-penny better quote leaks.

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

---

## Our approach: structural sub-transaction privacy + atomic multi-party settlement

The Canton billing primitive for this is well-suited:

- **Sub-transaction privacy**: Daml contracts only become visible to authorized signatories and observers on the ledger. Create a `Bid` whose observer is the auctioneer alone → other bidders verify the contract exists *as a fact* (it's referenced from the auction) but cannot read *its fields*. This is the privacy property, enforced by the participant node, not by encryption.
- **Atomic multi-party settlement**: `CloseAndReveal` is a **consuming** Daml choice that, in a single ledger transaction, (a) fetches every bid auth token by its contract ID, (b) selects a winner by an in-model sort routine, (c) consumes every losing `Bid` contract, and (d) creates the `AuctionResult` with the winning amount publicly disclosed to all eligible bidders. Outside observers see *one* event: the `AuctionResult`. There is no intermediate state where amounts leak.

The Canton backend is live (`src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.ts`):

```
POST /api/vendor/sealed-bid/rounds → SealedBidAuction contract on Canton
POST /api/vendor/sealed-bid/rounds/:id/bid → SubmitBid choice (per-bidder, nonconsuming)
POST /api/vendor/sealed-bid/rounds/:id/close → off-ledger state transition
POST /api/vendor/sealed-bid/rounds/:id/reveal → CloseAndReveal choice (atomic settlement)
```

---

## The Daml model

Three templates, 79 lines, no external dependencies beyond the Daml SDK. Each one carries the privacy property:

```daml
template SealedBidAuction with
    manager         : Party
    eligibleBidders : [Party]
    roundId, description, serviceCategory : Text
    deadline        : Time
    maxBids         : Int
  where
    signatory manager
    observer eligibleBidders
    -- SubmitBid is a nonconsuming choice. The Bid it creates has the
    -- bidder as signatory and the manager as the SOLE observer. This
    -- enforces sub-transaction privacy structurally.
    nonconsuming choice SubmitBid : ContractId Bid with …
    -- CloseAndReveal is a consuming choice. One ledger transaction
    -- sorts and selects the winner, consumes the winner's Bid via the
    -- manager-controlled Consume choice, consumes every loser the
    -- same way, and creates the AuctionResult whose observers are
    -- the eligible bidders.
    choice CloseAndReveal : ContractId AuctionResult with …

template Bid with …
  where
    signatory bidder            -- the bidder owns and authorizes
    observer manager            -- and ONLY the manager may inspect it
    choice Consume : ()         -- manager-controlled, used by CloseAndReveal
      controller manager
      do pure ()
```

Why this matters to a Hackathon judge:

- The `observer manager` line on `Bid` is the **structural privacy property**. Canton does the rest.
- The `CloseAndReveal` choice combines selection + consumption + result emission in a single event. Losing amounts are visible to no one outside the transaction — they're consumed in flight by the manager's exercise of `Consume` on each loser.
- The `SelectionMethod` sum type (`LowestBid | HighestBid | SpecificBidder with bidder : Party`) keeps the auctioneer rules on-ledger instead of in application code, so what the application thinks happened is what the ledger says happened.

The full file is `daml/daml/Main.daml` in this repo. It also seeds three demo rounds at sandbox boot — see "Live demo state" below.

---

## What runs live today

The deployed Cognivern backend has Canton registered as a real sealed-bid backend:

```
[ SealedBid ] backend registered — canton (Canton: JSON Ledger client bound to http://127.0.0.1:7575)
SealedBid[canton]: hydrated 2 open + 1 revealed round(s) from ledger
SealedBid[canton]: bid submitted by Alice (bidCid=…1234)
SealedBid[canton]: round revealed — winner Bob at $24,500, lost bids archived
SealedBid: bid_submitted event logged to CRE ledger (evidence hash 0x…)
```

Every lifecycle step fires `AuditLogService.logEvent` and lands in the CRE run ledger with hash-signed evidence. The `bid_submitted` event deliberately excludes `amountUsd` because — on Canton — the amount is visible only to the auctioneer. Anchoring it into a broadly readable audit log would break the privacy story. The `winner_revealed` event includes winner + winning bid because those become public at reveal.

The UI at [`/sealed-bid`](https://cognivern.vercel.app/sealed-bid) makes the privacy property clickable. The round detail page embeds a "party view" that lets visitors toggle between `Auctioneer | Alice | Bob | Charlie` and visually dim out any bid the selected party cannot read on-ledger. The reveal button calls `CloseAndReveal`, and the post-reveal banner says:

> *"Losing bid amounts remain undisclosed on-ledger — Canton archived them without ever revealing them to competitors."*

Three lifecycle states are pre-seeded at sandbox boot (one live round on each ticket — open, awaiting-reveal, already-revealed — so the demo video lands on something real):

| roundId | Description | Status on first page load |
| --- | --- | --- |
| `demo-round-open` | Q1 penetration testing engagement | Open, 2 of 5 bids in — visitor submits the third |
| `demo-round-closed` | Q3 cloud-hosting RFP — 3-year commit | Three bids in, awaiting reveal — visitor drives the atomic reveal |
| `demo-round-revealed` | Legal counsel retainer 2026 | Already revealed — Bob won at $185k, losing amounts archived |

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
2. **FHE manager-decrypt-and-publish happy path.** `revealWinner` on the FHE path now uses the Option B flow: callers supply a `decryptionProof` (`Array<{bidder, plaintext}>` with every bid covered). Tests assert (a) omitting `decryptionProof` rejects with `"decryption proof required"`, (b) supplying all plaintexts selects the lowest / highest bidder per `selectionMethod`, (c) `missing plaintext for bidder X` structurally rejects so the manager cannot silently drop a competitor, (d) losers are marked `rejected` and the winner `selected` on the round. The old `"threshold decryption of real CoFHE bids is not wired"` error is gone — replaced by behavior-tested reveal semantics on the in-memory backend, with an on-chain counterpart (`contracts/fhenix/src/SealedBidVendorSelection.sol::publishWinner`) gated by `msg.sender == round.manager`.
3. **Per-round visibility.** With three bidders on one round, querying the Daml JSON Ledger API as `Alice`, `Bob`, and `Charlie` returns exactly one Bid contract per bidder (matched by `payload.bidder === partyId`, not just by count), and querying as `Auctioneer` returns all three. Canton does the filtering; the assertion locks the cardinality *and* the identity.
4. **Cross-leakage guard.** Querying the Bid template as any individual bidder, **at the whole-ledger scope**, returns only contracts for which that bidder is the signatory. Anything else — a competitor's amount slipping through, a future observer-list broadening — fails this test.

The privacy claim Canton's disclosure model makes is now test-verified, not asserted in prose.

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
                 │      Daml JSON API :7575 (HTTPS)        │
                 │      Canton participant node            │
                 │   SealedBidAuction / Bid / AuctionResult│
                 ├─────────────────────────────────────────┤
                 │ AuditLogService.logEvent                │
                 │   → CRE run ledger, hash-signed evidence│
                 │   bid_submitted   (amount excluded)    │
                 │   winner_revealed (amount included)     │
                 └─────────────────────────────────────────┘
```

Canton deployment: pm2 process `cognivern-canton` on the Hetzner production VM, binding `127.0.0.1:7575` for the Daml JSON API (admin/party-allocation endpoints JWT-authed via HS256). It's not publicly routable — verifying the on-ledger state from outside the host either (a) runs `daml start` locally and exercises `tests/integration/canton-sealed-bid.test.ts` against the local sandbox, or (b) reads the [Canton runbook](docs/CANTON.md) and the public repo. DevNet migration is a config swap, not a code change — `CANTON_JSON_API_URL` redirected to a DevNet participant node.

---

## Track claim

We submit under **Track 1 — Private DeFi & Capital Markets**, with the strongest fit on the "Private deal execution" and "OTC trading workflows" problem statements. We do **not** claim Track 2 (RWA / tokenized deposits) or Track 3 (agentic commerce) for this submission — the sealed-bid module is the Canton piece. Cognivern's broader spend-governance work is referenced once, as backdrop, not as a competing submission.

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

The default backend is `canton`. To switch to the FHE path for comparison, change the dropdown on the create-round form — the same HTTP surface routes to either backend, and the FHE reveal call will produce the documented `"not wired"` 400. Both round types render the same privacy-enforcing UI.

---

## Submission materials

| Item | Link |
| --- | --- |
| Live product | [cognivern.vercel.app/sealed-bid](https://cognivern.vercel.app/sealed-bid) |
| Public API | `https://cognivern.thisyearnofear.com` |
| Repository | Public — see top of `README.md` |
| Pitch deck | `docs/pitch-deck.pdf` *(companion to this doc)* |
| 3-minute demo video | `docs/demo-video.mp4` *(companion to this doc)* |
| TestSprite backend dashboards | 24 tests · 30 MCP frontend tests · `./LOOP.md` for the iteration log |

---

## Frontmatter: about the broader Cognivern platform

Cognivern is a spend-governance platform for AI agents — confidential policy evaluation on Fhenix, hardware-gated signing on Ledger DMK, agent activity indexing through ChainGPT, durable evidence anchoring on Filecoin + 0G, and on-ledger execution via X Layer. The Canton sealed-bid module is the most recently added primitive, and the one we believe is most informative for a Canton jury. The platform context is mentioned here only to disambiguate the deployment: a Canton module on top of an existing running production API was a more credible Canton-jury signal than a fresh repo.

---

## Postscript: bugs caught and fixed by the test loop

A Canton submission that says "we test" should also say "here is what testing caught". Sixteen production bugs surfaced during the build window; the full enumeration is in [`LOOP.md`](LOOP.md). Three representative categories, with one or two concrete examples per category:

- **Endpoint access**. `/auth/*`, `/api/fhenix/encrypt`, `/api/metrics/ux-events`, `/api/mcp/governance-check`, `/api/speech/transcribe`, `/api/vendor/sealed-bid/rounds/:id/{bid,close,reveal}`, and `/api/projects/:id/{usage,tokens}` were all blocked by `apiKeyMiddleware` despite being public. Fix: parameterized path matching in `isPublicApiPath()` so the Canton sealed-bid sub-paths are not a special case.
- **Server crashes from unhandled throws**. `OwsWalletController.{createAgent, getWallet, importWallet, connectExternal}`, `OwsApiKeyController.{createApiKey, getApiKey, deleteApiKey}`, `OwsPermissionsController.{requestPermissions, getPermissions, revokePermissions, checkPermissions}` all threw `BadRequestError` / `NotFoundError` without try/catch, turning a 4xx into a 502 by taking the Node process down. Fix: explicit try/catch returning the right status.
- **Schema drift**. The `users` table lacked an `email` column; the `workspaces` table lacked `settings`. Inline migrations couldn't `CREATE TABLE IF NOT EXISTS` past the existing rows, so `ALTER TABLE … ADD COLUMN` statements were added as idempotent migrations.

(README's count is 12 because it lists the most recent 12; the broader figure across the project lifetime is 16.)

---

## License

MIT.
