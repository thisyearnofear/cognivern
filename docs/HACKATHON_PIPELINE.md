# Hackathon & Program Pipeline — selection doctrine and live evaluation

> Status as of **2026-11-26**. Update when opportunities are evaluated, entered,
> or concluded. Entered programs graduate to the program status table in
> [`README.md`](./README.md); concluded submission material archives to
> [`history/`](./history/) per repo convention.

## The doctrine: hackathons serve the roadmap, never the reverse

**North star (from [`PRODUCT_STRATEGY.md`](./PRODUCT_STRATEGY.md)):** Cognivern
makes autonomous work fundable — capital for agents, with receipts.

```text
funded mandate → governed agent actions → attributable spend
  → evidenced outcome → measured performance → better allocation
```

Hackathons and programs are **forcing functions and distribution channels for
work already on this path** — nothing more. A hackathon that requires building
something the roadmap would never produce is a cost, not an opportunity, no
matter the prize. The evaluation question is never "what could we build for
this hackathon?" but "**which of our planned rails does this hackathon pay us
(in money, distribution, or deadline pressure) to ship sooner?**"

Evidence this doctrine works: every permanent rail in the product today —
Canton sealed-bid procurement, Fhenix confidential policies, Telegraph verified
intelligence, KeeperHub execution, sponsored credits — began as hackathon work
that was *already* north-star work. The failures to repeat are the inverse:
events that demanded a product shape we would never otherwise build.

### Alignment filter — apply before entering anything

| Test | Pass condition |
| --- | --- |
| **Loop advancement** | The required work directly strengthens the mandate → govern → attribute → evidence → measure loop, or removes a known blocker on it. |
| **Rail permanence** | What gets built becomes a permanent product rail or capability, useful long after the event ends. One-off demo scaffolding is a fail. |
| **Stack adjacency** | The chain/protocol/sponsor tech is already in our rail set (x402, Solana, Canton, Fhenix, Celo, 0G, X Layer, Monad, ERC-8004) or is a rail we had independently planned to add. |
| **Eligibility honesty** | The entry complies with the event's rules in spirit, not just letter (repo age, code-written-during-window, chain requirements). An ineligible or rule-straining entry is a fail regardless of fit. |
| **Timeline cost** | The deadline pulls roadmap work forward; it does not displace or delay higher-priority roadmap work. |
| **Distribution value** | The audience (judges, ecosystem, partners) overlaps with buyers or allies of the evidence-and-control layer — not just generic hacker noise. |

**Any fail = do not enter.** A marginal pass on all six is still a weak entry;
enter when at least loop advancement and rail permanence are strong passes.

## Live evaluation — 2026-11-26 scan

### 1. ETHGlobal Agentic Markets — **aligned; primary candidate**

- **What:** async online hackathon, Dec 3–10 2026, $50,000+ prize pool. Theme:
  AI agents, onchain markets, and autonomous financial applications.
- **Loop advancement: strong.** "Autonomous financial applications" is the
  north star nearly verbatim. Agents participating in onchain markets *under
  bounded mandates with evidence* is the direction of the roadmap itself
  (governed capital allocation), not a detour.
- **Rail permanence: strong.** The work would produce an agentic-markets rail
  — policy-bounded market participation with attributable evidence — a
  capability the product does not yet have and the strategy implies.
- **Eligibility: pass with care.** ETHGlobal requires code written during the
  event. Entry must be a **new module built in the window** on top of the
  existing open infrastructure (standard, legitimate pattern) — never a
  resubmission of existing work.
- **Distribution: strong.** ETHGlobal partner prizes (up to 3 selectable)
  multiply shots; the audience is exactly the buyer/builder overlap.
- **Verdict: enter.** Starts Dec 3 — use the week before to scope the module
  tightly so the window is spent building, not deciding.

### 2. Celo Agents Open for Business — **aligned; parallel small bet**

- **What:** online, Nov 20 – Dec 7 2026, $5K across four tracks. Celo mainnet,
  public repo, attribution tag, code written during the window.
- **Track fit:**
  - **Altana Agent Wallets** ($1K + XP) — wallets controlled by user-defined
    permissions and session keys: this *is* the mandate/policy model.
  - **Verified Agent Payments** — identity-aware transactions via Self Agent
    ID / ERC-8004: the agent-identity rail already planned.
  - **Online & Onchain Checkout** — agents paying onchain with x402: production
    x402 rails already exist; the work is a Celo mainnet adapter.
- **Loop advancement: strong** — governed spend on a new mainnet rail.
- **Compounding: high.** The Prezenti sponsorship application (hard close
  Dec 29) already requires a **Celo mainnet milestone** — the same build can
  serve both programs. This is exactly the kind of double-counting the
  doctrine rewards: one north-star artifact, two distribution channels.
- **Timeline cost: moderate.** 11 days left, overlapping the ETHGlobal window
  — only viable if scoped as one focused Celo mainnet rail, not four track
  entries.
- **Verdict: enter one or two tracks maximum** (Altana + Verified are the
  north-star tracks; Corridors is farthest from the loop). Skip entirely if it
  would cannibalize the ETHGlobal entry.

### 3. Solana Perps & Prediction Markets — **misaligned; do not enter**

- **What:** Solana, Dec 1–5 2026, $100K+ — the largest prize on the board.
- **Why it fails the filter despite the prize:** the rules require the pm-AMM
  to be the *core product*. That means building a trading venue or trading
  terminal — a product shape the roadmap never produces. The tempting angle
  ("governed autonomous trading agents — loss limits, escalation, evidence")
  still requires building the trading product first and the governance layer
  second: the hackathon dictating the product, the exact failure mode this
  doctrine exists to prevent.
- **Rail permanence: fail.** A perps terminal is not a permanent Cognivern
  rail; the governance garnish on top does not change what the core artifact
  would be.
- **Verdict: skip.** Record it here so the $100K doesn't relitigate the
  decision every time it resurfaces.

### 4. Colosseum Eternal — **aligned; start when ready, no deadline pressure**

- **What:** Solana's always-on hackathon. Start a 4-week sprint any time from
  the Eternal dashboard; weekly 1-minute updates; feeds the accelerator
  pipeline and the Spring 2027 hackathon (Apr 6 – May 11).
- **Loop advancement: strong** — the governed Solana settlement rail (merged
  in PR #106) is already north-star work; an Eternal sprint documents,
  hardens, and evidences it end-to-end rather than inventing scope.
- **Eligibility: clean pass** — Eternal rewards ongoing shipping, no
  code-written-in-window constraint.
- **Verdict: enter.** Lowest-friction, highest-EV move on the board. Ideal
  start: when the Solana rail has its first real settlement evidence to build
  the sprint narrative around.

## Ruled out in this scan (for the record)

| Opportunity | Reason ruled out |
| --- | --- |
| KaneCLI Online Hackathon (deadline Nov 26) | Ineligible — repo must be started on/after Nov 12; retrofitting fails the eligibility-honesty test. |
| Solana Blitz v10 (ends Nov 27) | Timeline cost fail — one day left, $1K, entertainment-finance theme off-path. |
| HSK Chain Horizon Seoul (ends Dec 3) | Stack adjacency fail — requires building on HSK Chain, not a planned rail. |
| Base "Stocks Maxxing" (ends Dec 5) | Loop advancement fail — tokenized-stock product shape, not governance infrastructure. |
| Celo Agents at Work | Ended Sep 2026. |
| Colosseum Fall 2026 | Ended Nov 2 — note for next cycle. |
| Reactive Omni Buildathon (ends Dec 6) | Stack adjacency fail — Reactive Network-specific, not a planned rail. |

## Standing rules

1. **Re-scan on a cadence** — new agentic-commerce/x402/ERC-8004 events are
   appearing monthly; re-run this scan when a program closes or a new
   ecosystem event surfaces.
2. **Entry = thin submission doc** — per repo convention, a entered event gets
   a thin doc linking the durable rail doc, never duplicating it.
3. **The rail outlives the event** — if a entered hackathon's work would be
   abandoned when the event ends, the entry was a mistake; postmortem it in
   the retro column of the program table.
4. **Zero displacement** — hackathon work never pushes north-star milestones
   (the Prezenti Celo mainnet milestone, Telegraph S2 close Dec 1) off their dates.
   If a conflict emerges, the hackathon loses.
