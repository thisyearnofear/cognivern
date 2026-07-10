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

- Email RFPs leak; a leaked quote in an RFP can cost **5–15%** in final price.
- SaaS procurement portals centralize unblinding, creating counterparty risk.
- OTC market makers won't quote tight spreads if counterparties fear print-level leakage.

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
| Reveal leaks every loser | Needs threshold decryption by losers | **Winner revealed without decrypting losers** |
| Trust a SaaS operator | Manager publishes after decrypt | Trust Daml disclosure model + participant node |
| Settlement off-ledger | Reveal requires multi-party ceremony | Atomic reveal in one ledger transaction |

*Framing note:* FHE excels at keeping amounts sealed; Canton is the only option that reveals the winner without decrypting losing bids.

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

- **31+** Vitest integration & unit tests.
- **24** TestSprite CLI backend tests on the live API.
- **Direct** ledger assertions per party role.
- **79** lines of Daml across 3 templates.

Privacy invariants are asserted by querying the Daml JSON Ledger API directly as each party — not by trusting the backend cache. Legal and risk teams get an immutable, non-repudiable audit trail.

## Slide 8 — Compliance & auditability

Built for legal, risk, and audit sign-off:

- **Role-based disclosure** — Daml signatory/observer enforces who sees what.
- **Non-repudiation** — Every bid and reveal recorded on-ledger + hash-signed CRE events.
- **Immutable audit trail** — Full ledger history + `AuctionResult` for procurement/compliance.
- **No SaaS trust gap** — Privacy from disclosure model on your participant node.

## Slide 9 — HackCanton builder-test fit

| Question | Cognivern's answer (Canton) |
|---|---|
| Parties | Auctioneer + eligible-bidder list enforced by Daml signatory/observer. |
| Visibility | Each `Bid` is visible to its bidder and the auctioneer only. |
| Approval | Only the manager's `CloseAndReveal` choice can archive bids and emit the result. |
| Atomic settlement | Winner selection + archive of every losing `Bid` + `AuctionResult` in one tx. |
| Auditability | Ledger history + hash-signed events in the CRE run ledger. |
| Why weaker on public chain | Public chains leak amounts; FHE needs a ceremony losers won't join. |

## Slide 10 — Real-world applicability

One primitive, four institutional workflows:

- **Private RFPs** — legal retainers, security audits, capex procurement.
- **Confidential OTC** — client RFP for a block; cleared price visible, unmade quotes never surface.
- **Credit allocation** — lenders bid into an allocation round; losing yield targets stay private.
- **B2B blind auctions** — drop-in replacement for portals that centralize unblinding.

## Slide 11 — Deployment path

1. **Today** — Live on HackCanton S2 DevNet with on-ledger proof artifacts (`pnpm canton:proof`).
2. **Private participant** — Same backend is participant-agnostic; point at your Canton node or hosted validator.
3. **Mainnet-ready** — Daml SDK 3.5.x; SettlementLeg upgrade for atomic value transfer.

## Slide 12 — Roadmap: atomic value settlement

1. **Today** — `CloseAndReveal` archives bids and emits `AuctionResult` with winning amount.
2. **Next** — Add a `SettlementLeg` and exercise the escrowed asset's `Settle` choice inside the same `CloseAndReveal` transaction.
3. **Bounty lane** — CBTC (BitSafe) private OTC escrow or cETH (OnRails) private collateral — 50,000 CC bounty.

## Slide 13 — Why us

- Built on an already-deployed, tested governance API with real production logging, auth, and audit rails.
- Daml model compiles clean with **SDK 3.5.x**; backend is participant-agnostic.
- End-to-end Canton flow works today: create → submit → close → atomic reveal, with privacy verified by direct ledger queries.
- **31+ automated tests** plus direct ledger assertions keep the privacy guarantee machine-verifiable.

## Slide 14 — Closing

**Prove privacy on-ledger.**

Cognivern brings institutional sealed-bid / OTC workflows to Canton Network — with sub-transaction privacy and atomic reveal that actually works.

- Live demo: `cognivern.vercel.app/sealed-bid`
- Repo: `github.com/thisyearnofear/cognivern`
