# Go-to-Market — Wedge, Creative Monopoly, and the 0-Fee Rail

Strategy for the sponsored-inference product line. Complements
[`PRODUCT_GTM_CANVAS.md`](./PRODUCT_GTM_CANVAS.md) (market canvas) and
[`SPONSORED_CREDITS.md`](./SPONSORED_CREDITS.md) (mechanics). This doc is the
*why*; those are the *what* and *how*.

> The one-line thesis: **inference throughput is a commodity racing to zero;
> verifiable evidence of what AI spend did is an empty category. Give the
> commodity away at 0% fees and charge for the evidence and control layer.**

---

## 1. The user's problem (both users)

**The tester / grantee.** Today they get raw API keys dumped into a Discord.
Keys leak, die mid-project, and can't be re-issued without chaos. The cohort
existence already built here is strictly better: no account needed, an
unmodified OpenAI SDK against `/v1`, self-serve balance, and — the part
nobody else does — they can see exactly what the sponsor sees about them
(`/v1/credits/activity` shows their calls next to the sponsor's projection)
and prove their balance with a Merkle receipt verified against a public
on-chain anchor. That is dignity, not just credits.

**The organiser / sponsor.** The one with the real pain. Their options today:
hand out raw keys (leak, drain, zero accountability), build metering
themselves (weeks), or pay enterprise gateway fees. What they cannot buy
anywhere is an answer to *"what did my cohort actually do with the money"* that
holds up to a third party. The system answers it: hold/settle budgets,
per-program model allowlists, graded disclosure tiers, tamper-evident run
ledgers, commitments anchored to two public chains, receipts verifiable
without trusting the sponsor or the platform.

### Why not the key-resale model

A visible pattern in the market: holders of unused API keys resell capacity
for USDC, buyers consume at a discount, the platform keeps the delta. Do not
copy it. Resold upstream keys violate provider terms, get banned without
appeal, and create unpriceable liability — whose account is at risk when a
buyer's content runs through a seller's key? Resale works at all only because
of the *absence* of a governance layer. Cognivern's asset is precisely that
layer — see §3 for the legitimate version of the idea.

## 2. Thiel: where the creative monopoly is

Inference throughput is a commodity; OpenRouter, Together, and 0G itself
compete its margin toward zero. **A throughput-fee margin is not a monopoly —
it is a tollbooth on a public road and invites both bypass and price war.**

The monopolizable dimension is the split already written into
`ZeroGRouterBackend`: 0G's Router runs zero data retention — *it can tell a
sponsor how much was spent and structurally cannot tell them what it was
spent on*. Privacy-harmonizing gateways share that limit by design. So the
category "verifiable, third-party-grade evidence of what AI spend did" is
empty, and Cognivern is already inside it: policy-gated execution,
tamper-evident ledgers, disclosure tiers, dual-chain anchored commitments,
public verification. A competitor cannot bolt this on afterwards — it
requires owning the control point where policy meets spend, which is the
whole product.

The fee model follows directly: **0% on throughput, forever, publicly.** Never
tax the commodity; charge for the monopoly asset:

- **Governance workspaces** — policies, audit trails, retention, SSO, team roles.
- **Premium controls** — TEE-sealed spend mandates, per-key rate limits,
  approval workflows.
- **Enterprise assurance** — auditor permits, compliance reporting, retention.
- **Hosted orchestration** — the platform holds the 0G deposit; organisers are
  tenants and pay for management, not markup on tokens.

The free rail is also the flywheel: every free cohort run generates governed
run data that improves the posture and audit tooling — usage money cannot
buy.

## 3. PG: the wedge

Do not launch "a governance platform." Launch the one desperate use case the
code already fully serves: **AI-hackathon, workshop, and course organisers
handing out inference budgets.** They are small, numerous, in pain this week,
solving it embarrassingly (Discord key pastes), and hyper-networked — one
organiser's report page ("every balance provable, every model constrained,
killswitch included") markets the product to every participant and judge, who
are the next organisers and the future enterprise buyers.

### Sequence

1. **Wedge (now).** Sponsored cohorts, 0 fees, self-serve. Run the organiser
   flow from [`SPONSORED_CREDITS.md`](./SPONSORED_CREDITS.md) at real events —
   including the hackathons Cognivern itself enters; this is the team's own
   need first.
2. **Protocolize the receipt.** "Sponsored inference, with proof" becomes the
   norm: a public verification link in every cohort recap. The receipt is the
   reason cohorts come to the platform.
3. **The legitimate resale variant.** Organisers or capacity holders with idle
   0G allocation point *their own* upstream key at the gateway; their unused
   budget flows to cohorts **under Cognivern's governance** — metered,
   allowlisted, evidence-attached. This is the legitimate form of key resale:
   the governance layer is what lets strangers trust each other's capacity.
4. **Monetize up.** When an enterprise asks for this for its internal AI
   budget owners, that is the paid tier — controls, retention, SSO,
   compliance. They pay for the monopoly asset after arriving via the free
   rail.

## 4. The honesty constraint

The product records raw native (0G-denominated) cost on every inference
record precisely so charges can be recomputed from primary data. If the
platform ever takes a spread, it must be visible — margin hidden in FX rates
or pricing overrides is discoverable by design, and the product would expose
its own dishonesty. Take margin as a fee, a subscription, or an explicit
markup knob; never as obfuscation.

The same principle protects two existing product decisions: public
verification stays free forever (it is the trust anchor and the marketing),
and disclosure-tier choice stays with the tester — the sponsor has no
override, and that absence is a selling point.

## 5. Operating modes (decision pending)

| Mode | Who holds 0G + keys | Revenue | Status |
| --- | --- | --- | --- |
| Sponsor self-hosts | The organiser | Platform/license value only | Current doc model (`SPONSORED_CREDITS.md`) |
| Hosted platform | Cognivern | Fee for orchestration; optional explicit markup | Architecture supports today (one shared upstream account, workspace-scoped programs); invoicing is off-ledger |

Open items if hosted mode is chosen: per-tenant funding view (organisers
must not see the shared upstream account), an explicit markup multiplier in
pricing, and the gateway per-key rate limiting noted as a gap in
`SPONSORED_CREDITS.md`.
