# Pitch Deck Source — Cognivern on Canton

**Generated file:** `docs/pitch-deck.pptx`  
**Generator script:** `scripts/create-pitch-deck.py`  
**Regenerate:** `pnpm pitch-deck` (or `/usr/local/bin/python3.13 scripts/create-pitch-deck.py`)

## Slide 1 — Title

- **Cognivern**
- Private sealed-bid RFP / OTC vendor selection on Canton Network
- Track 1 · Private DeFi & Capital Markets
- Team thisyearnofear
- Live demo: `cognivern.vercel.app/sealed-bid`

## Slide 2 — The pain

Institutional RFPs and OTC desks leak pricing:

- Email RFPs leak; a respondent who sees a competitor's price bands the auction.
- SaaS procurement portals centralize unblinding, creating counterparty risk.
- OTC market makers won't quote tight spreads if print levels leak.

What institutions need: a sealed-bid primitive where bids exist, but only the counterparty can read them — and revealing the winner does not reveal every loser.

## Slide 3 — The Canton answer

Canton makes privacy structural, not cryptographic:

- `SealedBidAuction` → `SubmitBid` → `CloseAndReveal` → `AuctionResult`
- Each `Bid` is signatory bidder + observer manager only.
- `CloseAndReveal` is a consuming choice: selects winner, archives every losing `Bid` in flight, and emits the result in one atomic transaction.

## Slide 4 — Why Canton beats public chain / FHE-only

| Public chain / SaaS | FHE only (Fhenix) | Canton Network |
|---|---|---|
| Bid amounts visible to all | Amounts stay sealed | Amounts stay sealed |
| Reveal leaks every loser | Needs threshold decryption by losers | Losing bids consumed in flight, never decrypted |
| Trust a SaaS operator | Trust CoFHE permit / manager | Trust Daml disclosure model + participant node |
| Settlement off-ledger | Reveal not wired end-to-end | Atomic reveal in one ledger transaction |

## Slide 5 — The Daml model (79 lines)

```daml
template Bid with
  bidder : Party
  manager : Party
  amountUsd : Decimal
  ...
where
  signatory bidder
  observer manager          -- ONLY the auctioneer may inspect

choice CloseAndReveal : ContractId AuctionResult
  controller manager
  do
    ... select winner ...
    mapA archive losingBids  -- consumed in flight
    create AuctionResult with ...
```

Two lines do the privacy work: `observer manager` on `Bid`, and `CloseAndReveal` being a consuming choice.

## Slide 6 — Live product

`cognivern.vercel.app/sealed-bid`

- Create a Canton-backed round.
- Submit sealed bids as Alice, Bob, Charlie.
- Toggle the Party view: each bidder sees only their own bid; the auctioneer sees all three.

## Slide 7 — Engineering rigor

- **31** Vitest integration & unit tests passing.
- **24** TestSprite CLI backend tests on the live API.
- **16** Production bugs caught and fixed this build window.
- **79** lines of Daml across 3 templates.

Privacy invariants are asserted by querying the Daml JSON Ledger API directly as each party — not by trusting the backend cache.

## Slide 8 — HackCanton builder-test fit

| Question | Cognivern's answer (Canton) |
|---|---|
| Parties | Auctioneer + eligible-bidder list enforced by Daml signatory/observer. |
| Visibility | Each `Bid` is visible to its bidder and the auctioneer only. |
| Approval | Only the manager's `CloseAndReveal` choice can archive bids and emit the result. |
| Atomic settlement | Winner selection + archive of every losing `Bid` + `AuctionResult` in one tx. |
| Auditability | Ledger history + hash-signed events in the CRE run ledger. |
| Why weaker on public chain | Public chains leak amounts; FHE needs a ceremony losers won't join. |

## Slide 9 — Real-world applicability

One primitive, four institutional workflows:

- **Private RFPs** — legal retainers, security audits, capex procurement.
- **Confidential OTC** — client RFP for a block; cleared price visible, unmade quotes never surface.
- **Credit allocation** — lenders bid into an allocation round; losing yield targets stay private.
- **B2B blind auctions** — drop-in replacement for portals that centralize unblinding.

## Slide 10 — Roadmap: atomic value settlement

1. **Today** — `CloseAndReveal` archives bids and emits `AuctionResult` with winning amount.
2. **Next** — Add a `SettlementLeg` and exercise the escrowed asset's `Settle` choice inside the same `CloseAndReveal` transaction.
3. **Bounty lane** — CBTC (BitSafe) private OTC escrow or cETH (OnRails) private collateral — 50,000 CC bounty.

## Slide 11 — Why us

- Built on an already-deployed, tested governance API with real production logging, auth, and audit rails.
- Daml model compiles clean with SDK 2.10.4; backend is participant-agnostic.
- End-to-end Canton flow works today: create → submit → close → atomic reveal, with privacy verified by direct ledger queries.
- Iteration log (`LOOP.md`) shows 16 bugs fixed, 31 tests passing, and a clear FHE Option B trust-model evolution.

## Slide 12 — Closing

**Prove privacy on-ledger.**

Cognivern brings institutional sealed-bid / OTC workflows to Canton Network — with sub-transaction privacy and atomic reveal that actually works.

- Live demo: `cognivern.vercel.app/sealed-bid`
- Repo: `github.com/thisyearnofear/cognivern`
