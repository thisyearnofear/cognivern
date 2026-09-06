# Telegraph Protocol Season I — Track 3 — Cognivern Submission

**Hackathon:** Telegraph Protocol Season I, Track 3 (Apps & Agents)
**Host:** Telegraph Protocol (built on Base)
**Window:** Track 3 opened 2026-08-31 → submissions close **2026-09-07 23:59 UTC**
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.persidian.com/telegraph](https://cognivern.persidian.com) · API: `api.cognivern.persidian.com` (`/api/telegraph/*`)
**X post:** [posted 2026-09-01](https://x.com/cognivern/status/2094861075464249758) — live governed-consumption metrics, tagged `@Telegraphprotoc`
**Demo video:** pending (see Submission checklist)

---

## TL;DR

**Cognivern is a governed consumption layer for Telegraph intelligence.** Autonomous
agents can't act on raw, unverified API responses — and even *verified* signals
shouldn't move money without economic accountability. Cognivern wraps real Telegraph
miner calls (paid in x402 USDC on Base Sepolia) in its existing governance pipeline:
confidence thresholds, budget enforcement, approve/hold operator review, and a
complete CRE artifact audit trail — `telegraph.signal` evidence for every paid call.

**One line:** *We don't show "I called a miner." We show "my agent made 151 governed
Telegraph calls, spent $1.51, held 100+ low-confidence signals for review — and every
decision is auditable."*

---

## Live deployment status (as of 2026-09-06)

- Backend: PM2 process `cognivern-backend` (port 3087) + `cognivern-telegraph-digest`
  (signal digest loop, 6h interval) on the production backend host, branch `main`
  @ `d8638f2`.
- Integration is **live in the product** at `cognivern.persidian.com/telegraph`:
  signal categories, questions, and governed consumption stats
  (`GET /api/telegraph/stats`).
- x402 payments settled on **Base Sepolia** (`eip155:84532`), payer
  `0x688441bA6a6952c039E0836eDB5B46db090aBc3B`, ~18.5 USDC runway (~1,800 calls).
- **Real consumption to date: 151 governed calls, $1.51 spent**, mix of auto-approved
  (confidence ≥ 0.7) and held-for-review (below threshold or no declared confidence —
  we never fabricate a score).

### Operational incident, resolved 2026-09-06

The digest run of 2026-09-06 10:00 UTC failed all 5 miner calls with HTTP 402.
Diagnosis: the network, asset, and wallet config were correct — a manually driven
paid call succeeded against a live price miner. The failures came from two specific
miners (`litellm`, `telegraph-chatbot`) returning empty 402s; a restart plus the
miners' own recovery restored a clean cycle at 13:15 UTC (4 calls, $0.04, 1 approved,
3 held, 0 failed). No code change was required; the fail-safe behavior (hold, don't
guess) worked as designed.

---


## What we built

### The governed flow

```
Telegraph Verified Intelligence (miner discovery → engine/miner dispatch)
  ↓
x402 micropayment (@x402/fetch, EIP-3009 on Base Sepolia, ~$0.01/call)
  ↓
Confidence threshold check (per-miner declared confidence_field; fail-safe hold)
  ↓
Governance pipeline (GovernanceClient.previewSpend → executeSpend)
  ↓
Wallet execution + SpendAttributionService
  ↓
telegraph.signal CRE artifact + FundedMandateStatement (full audit trail)
```

### New (Telegraph-specific)

| Component | Purpose |
|---|---|
| `TelegraphService` | Miner discovery (129+ miners), x402 payments, node/engine health |
| `TelegraphGovernanceHelper` | Confidence routing → approve/hold, CRE artifact creation |
| `TelegraphController` | Status + governed consumption stats API |
| `telegraph.signal` | CRE artifact type with paid/payment-network metadata |
| `telegraph-signal-digest` agent | Scheduled loop: real daemon signals → daemon-recommended miners → governed decisions |
| `/telegraph` dashboard | Public in-product view of categories, signals, and governed stats |

### Reused (existing Cognivern rails — zero duplication)

GovernanceClient, OwsWalletService, PolicyEnforcementService,
SpendAttributionService, CreRunRecorder + AuditLogService, FundedMandateStatement.
**Additive-only:** if Telegraph is disabled, everything else works exactly as before.

---

## Judging criteria alignment

| Criterion | How Cognivern delivers |
|---|---|
| **Users acquired & activity** | Production platform live at cognivern.persidian.com with the /telegraph surface in the product |
| **Usage and adoption** | Continuous governed consumption loop (digest agent every 6h) driving real paid miner requests — 151 calls / $1.51 and counting |
| **Creativity and usefulness** | First governance + accountability layer over verified intelligence: thresholds, budgets, attribution, audit receipts |
| **Must use Telegraph miners** | ✅ Real miners (price feeds, LLM, weather, AI-detection), real x402 payments, no mocks |
| **Engagement on posts** | [X post with live metrics](https://x.com/cognivern/status/2094861075464249758) tagged @Telegraphprotoc |

### The demo story for judges

1. Open `cognivern.persidian.com/telegraph` — live signal categories and governed stats.
2. Run `pnpm demo:telegraph` — discover miners, one governed call with x402 payment,
   confidence check, `telegraph.signal` artifact created.
3. Watch the digest log: signals auto-approved when confidence ≥ 0.7, **held** when
   below — proof that low-confidence intelligence never moves money unreviewed.
4. Every decision links agent → mandate → policy → spend → on-chain payment.

---

## Submission checklist

- [x] Code: all integration committed and public (`main`)
- [x] Docs: `docs/TELEGRAPH.md` + `docs/TELEGRAPH_TRACK3_PROPOSAL.md`
- [x] Unit tests: `tests/unit/TelegraphService.test.ts` (15 tests, passing)
- [x] Demo script: `pnpm demo:telegraph` (real x402 payments)
- [x] Live API: `/api/telegraph/status` + `/api/telegraph/stats`
- [x] Production deployment: `cognivern.persidian.com/telegraph`
- [x] X post with metrics: [2026-09-01](https://x.com/cognivern/status/2094861075464249758)
- [ ] Demo video (60–90s governed intelligence → action) — **in progress; required before submission**
- [ ] Platform submission on hackathon.telegraphprotocol.com before 2026-09-07 23:59 UTC

---

## Notes & caveats

- Payments are on **Base Sepolia testnet USDC** per the Telegraph testnet's accepted
  networks; the payer wallet needs no ETH (EIP-3009 signature flow).
- Prize pool $15K across the season; Track 3 eligibility for global prizes requires
  ≥100 real Track 3 requests per intent — our loop contributes real demand.
- Zero impact on the other rails (Flare, Canton DevNet, Cleanverse/Monad).

## Related docs

- [TELEGRAPH.md](./TELEGRAPH.md) — full integration guide & architecture
- [TELEGRAPH_TRACK3_PROPOSAL.md](./TELEGRAPH_TRACK3_PROPOSAL.md) — original track choice & design
- [HACKATHON_SUBMISSION_KEEPERHUB.md](./HACKATHON_SUBMISSION_KEEPERHUB.md) /
  [HACKATHON_SUBMISSION_CLEANVERSE.md](./HACKATHON_SUBMISSION_CLEANVERSE.md) — prior submissions

