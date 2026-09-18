# Product Strategy — thesis, wedge, and go-to-market

> Merged doc: replaces `AGENTIC_CAPITAL_THESIS.md`, `PRODUCT_GTM_CANVAS.md`,
> and `GO_TO_MARKET.md`. For the mandate/outcome *interface* see
> [`AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md`](./AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md);
> for the sponsored-inference *mechanics* see
> [`SPONSORED_CREDITS.md`](./SPONSORED_CREDITS.md).

## North star

**Cognivern makes autonomous work fundable.** A business allocates capital to
an agentic workflow under a bounded mandate, sees what every dollar was spent
on, and decides whether the work deserves more capital:

```text
funded mandate → governed agent actions → attributable spend
  → evidenced outcome → measured performance → better allocation
```

The one-line GTM thesis: **inference throughput is a commodity racing to
zero; verifiable evidence of what AI spend did is an empty category. Give the
commodity away at 0% fees and charge for the evidence and control layer.**

Internal shorthand: **capital for agents, with receipts.**

## The core object: a funded mandate

The unit of allocation is a mandate, not an abstract agent. It defines the
objective, funder/beneficiary, agent pool, capital and tool budgets, permitted
vendors/assets/chains, approval rules, success metrics and measurement window,
required evidence, and next-tranche conditions. Schema and invariants:
`AGENTIC_CAPITAL_IMPLEMENTATION_SPEC.md`.

## Where we are

Shipped today: funded-mandate lifecycle with operator-ingested outcomes,
hashed statement candidates, immutable published snapshots + permissioned
redacted export, bounded next-allocation recommendation (never auto-executes),
GitHub + Langfuse outcome connectors, governed wallet spend, policy and
confidential-policy evaluation, run ledger/audit evidence, confidential
vendor selection (Canton), sponsored-inference credits.

**Not current claims:** complete ROI accounting, causal attribution, an
external agent-investment marketplace, credit underwriting, automated tranche
release. The product never calls telemetry P&L.

Strategic sequence: govern spend → attribute → record outcomes → measure →
recommend allocation → (only with reliable performance histories) delegated
capital.

## The wedge

Launch the one desperate use case the code already fully serves: **AI-hackathon,
workshop, and course organisers handing out inference budgets.** They are
small, numerous, in pain this week (Discord key pastes), and hyper-networked —
one organiser's report page markets the product to every participant and
judge, who are the next organisers and future enterprise buyers.

- **Tester/grantee:** no account needed, unmodified OpenAI SDK on `/v1`,
  self-serve balance, and sees exactly what the sponsor sees — balance
  provable via Merkle receipt against a public anchor. Dignity, not just
  credits.
- **Organiser/sponsor:** the real pain. Buys an answer to *"what did my
  cohort actually do with the money"* that holds up to a third party:
  hold/settle budgets, model allowlists, disclosure tiers, tamper-evident
  ledgers, dual-chain anchored commitments.

Sequence: (1) sponsored cohorts at 0 fees — including hackathons Cognivern
itself enters; (2) protocolize the receipt — a public verification link in
every cohort recap; (3) legitimate capacity-sharing — organisers point their
own upstream key at the gateway, metered + evidenced under our governance
(the legal form of key resale); (4) monetize up — enterprise budget owners
pay for controls, retention, SSO, compliance.

Expansion markets after the wedge: autonomous procurement/vendor selection
(closest to existing sealed-bid + settlement primitives), B2B lead gen
(harder attribution), invoice recovery/finance ops.

## Where the monopoly is

Throughput margin is a tollbooth, not a monopoly — OpenRouter/Together/0G
compete it to zero, and resold-key platforms carry ToS/ban liability we will
not copy. The monopolizable dimension is the split already in
`ZeroGRouterBackend`: 0G's Router runs zero data retention — *it can say how
much was spent, structurally not what it was spent on*. "Verifiable,
third-party-grade evidence of what AI spend did" is an empty category, and we
already own the control point where policy meets spend.

The defensible combination: mandate definition + capital/tool allocation +
policy enforcement + execution boundary + spend attribution + outcome
evidence + bounded reallocation — the trusted graph
`capital → mandate → agent → run → spend → vendor → outcome`.

Fee model: **0% on throughput, forever, publicly.** Charge for governance
workspaces, premium controls (TEE-sealed mandates, rate limits, approvals),
enterprise assurance, and hosted orchestration (platform holds the deposit;
organisers are tenants paying for management, not token markup). The free
rail is also the flywheel — every free cohort produces governed run data
money can't buy.

## Distribution built into the product

1. **Mandate artifacts** — every completed mandate produces a permissioned,
   portable statement that travels to finance, boards, partners, funders.
2. **Agent integrations** — MCP/frameworks make "run under a funded mandate"
   the default path, not "call a governance endpoint."
3. **Execution integrations** — wallets, procurement, CRM carry mandate IDs
   and outcome links through the lifecycle.
4. **Benchmarks** — accumulating evidence yields workflow/vendor/cost-per-
   outcome benchmarks that attract the next user.
5. **Design partners first** — manually supported deployments; productize
   only repeated patterns.

Compounding loop: more mandates → more attributable spend/outcome data →
better evidence → more allocation confidence → larger mandates.

## The honesty constraint

Raw native cost is recorded on every inference record so charges recompute
from primary data. If the platform ever takes a spread it must be visible —
margin hidden in FX or pricing overrides is discoverable by design. Take
margin as a fee, subscription, or explicit markup knob. Two protected
decisions: public verification stays free forever (it is the trust anchor
and the marketing); disclosure-tier choice stays with the tester (the
sponsor has no override — that absence is a selling point).

## Operating modes

| Mode | Who holds 0G + keys | Revenue | Status |
| --- | --- | --- | --- |
| Sponsor self-hosts | The organiser | Platform/license value | Current (`SPONSORED_CREDITS.md`) |
| Hosted platform | Cognivern | Orchestration fee; optional explicit markup | Architecture supports it; invoicing off-ledger |

Open items for hosted mode: per-tenant funding view (organisers must not see
the shared upstream account), explicit markup multiplier, per-key rate
limiting.

## GTM diagnosis

| Question | Answer |
| --- | --- |
| Discover | Founder-led design partners in one measurable workflow; then agent/wallet/procurement/CRM/MCP integrations |
| Trust | Enforce spend before execution; distinguish observed / verified / attributed / causal; on-chain anchors where they help |
| Stay | Mandate history + evidence + policy config become load-bearing; the spend-to-outcome graph is the switching cost |
| Share | Permissioned statements and outcome evidence travel to finance, boards, customers, future capital providers |

North-star metric: **published mandate statements containing at least one
non-self-reported outcome** (leading indicator of the allocator platform) —
then verified capital deployed through successful mandates. Supporting:
active funded mandates, repeat allocation rate, % spend tied to a mandate,
% outcomes with evidence.

## Passed-on markets (standing filter)

Filter: does it produce outcome-bearing mandate records on rails we already
have? If not, it's a distraction.

- **AI training-data monetization** (assessed 2026-08-24, passed): real and
  large, but the money flows to brokers/labelers/frontier labs, the hard
  problems are ML/legal not governance, and it means a new buyer + sales
  motion from zero. Capture the tailwind instead — more agentic data spend
  needing governance; run any data-licensing design partner as a funded
  mandate on existing rails.
