# Telegraph Protocol Season II — Cognivern Submission (working doc)

> Working submission document. Durable rails: [`../TELEGRAPH.md`](../TELEGRAPH.md)
> (governed calls, compliance-on-payment, ledger) and
> [`../SPONSORED_CREDITS.md`](../SPONSORED_CREDITS.md) (sponsored inference,
> verified-answer economics). Pre-submission pass:
> [`../SUBMISSION_CHECKLIST.md`](../SUBMISSION_CHECKLIST.md).

**Track:** Apps & Agents · **Missions:** 02 (stablecoin agent expense ledger +
compliance proof on payment) and 10 (model economy / cost per verified answer)

## TL;DR

Cognivern is the economic control plane for agentic work. On Telegraph it
turns raw miner calls into governed, payable, verifiable settlements: every
paid call is a CRE run with a signed `telegraph.signal` artifact; a
compliance screen can gate the payment itself; low-confidence signals pause in
a human approval inbox; and sampled inference answers are judged by paid
evaluator miners into a cost-per-verified-answer leaderboard.

## Live evidence (all re-runnable)

| Claim | Evidence |
| --- | --- |
| Compliance proof attached to payment | `POST /api/telegraph/compliant-call` — sanctions screen `clear` (run `b1d33930`) → parent `GAS_PRICE` settled (run `6b1c1b4c`, TxLens, `complianceVerdict: "clear"` in its `telegraph.signal` artifact) |
| Compliance gate blocks real money | `compliant-call` screening a real OFAC SDN-listed wallet via **Counterproof Sanctions Screener** (miner `731002`, top-ranked on `SANCTIONS_SCREENING_MATCH_GENERAL`) → verdict `hit` (`matched=true`, ISIL KHORASAN on US/UN/EU/UK lists) → parent `GAS_PRICE` purchase **denied before settlement**. Screening run `5f22f7ec`, gate-decision run `cb44a45b`; only the $0.01 screen was paid |
| Expense ledger with reverse states | `GET /api/telegraph/ledger` — 47 calls, $0.44 spend, dispositions `approved / held_pending / released / quarantined / blocked / failed` |
| Human-in-the-loop | `/inbox` — held telegraph runs approve (release) or reject (quarantine); UI-verified approve on run `55c4484a` |
| Verified-answer economics | `POST /api/credit-programs/:id/verify-sample` — Groq `openai/gpt-oss-120b` program `prog_3c75599c-3913-4fcc-8edd-2aedc5674f08`; leaderboard: 20 ok calls, 19 sampled, 6 correct / 1 incorrect / 12 unknown, `verifiedAccuracy 0.857`, `costPerVerifiedCorrectUsd ≈ $0.0065` |
| Cross-miner agreement | `verify-sample {"agreement":true}` — two distinct evaluators (TxLens + AssistWire) per record; verdicts persist only on unanimous decided verdicts, else `unknown` with per-evaluator breakdown. Live result: 3 unanimous `correct`, 7 `no consensus` — mostly TxLens held/unparseable, plus one genuine evaluator disagreement (TxLens `incorrect` vs AssistWire `correct`) |
| Anjoman delegated screening → award gate | `POST /api/vendor/sealed-bid/rounds/:id/screen-bidders` — one governed Anjoman task per bidder → `sealed_bid.vendor_screened` events on the round's hash-signed timeline → `/reveal` with `requireScreened` refuses to award an unscreened or hit vendor (403 + verdict map). Code + 27 tests landed; live run pending `ANJOMAN_API_KEY` |
| Judge re-runnability | `tooling/scripts/agents/telegraph-demo.ts` — dependency-free CLI over the live API (`ledger`, `compliant-call`, `anjoman-task`, `verify-sample`, `report`, `screen-round`, `reveal`) |
| Demo video | `~/Downloads/telegraph-s2-motion.mp4` (local artifact, ~108s, 1080p) |

Workspace auth: a workspace JWT (`Authorization: Bearer`). API base:
`https://api.cognivern.persidian.com` · UI: `https://cognivern.persidian.com/telegraph`.

## What changed this season (git-visible)

- `feat(inference): openai-compatible backend for sponsored-credit programs` — provider-agnostic upstream (Groq live)
- `feat(verification): cross-miner agreement mode for verify-sample` + flaky-evaluator demotion
- `feat(telegraph): judge-facing CLI for re-running live evidence`
- `feat(telegraph): cumulative spend trajectory on intelligence ledger`
- `test(inference): cover openai-compat backend contract` (7 tests)
- Anjoman API-key rail — `AnjomanService` (`/agent/chat`, async-job poll/cancel, escrow balance) + `governedAnjomanTask` (`telegraph.signal`, `paymentMethod: "anjoman_api_key"`, fail-safe held)
- Anjoman-delegated vendor screening for sealed-bid rounds — `sealed_bid.vendor_screened` governance events + `requireScreened` reveal gate + UI badges + judge CLI
- Ledger/compliance/CRE rails from earlier commits (`18ccb457`, `47988448`, …)

## Honesty bounds (say these out loud)

- Payments are x402 stablecoin on a testnet rail — label as such.
- Verdicts are paid evaluator-miner assertions linked to governed runs, not
  independent ground truth. Agreement mode raises the bar (two miners must
  concur) but remains correlated miner opinion with receipts.
- `unknown` verdicts are stored and excluded from accuracy — never counted correct.
- Only `open`-disclosure-tier records are sampled; private/detailed content is never sent to evaluators.

## Apps & Agents — five commercial questions (draft answers)

**01 Who is it for?**
Teams and agents buying ranked intelligence through Telegraph who need to
prove what they spent, why it was allowed, and whether the answer was right —
hackathon builders today, procurement/compliance teams and agent operators
tomorrow. The problem recurs on every paid call an agent makes.

**02 What does it improve?**
Raw Telegraph calls settle with a receipt but no policy context: no mandate,
no compliance check, no human recourse, no answer-quality signal. Cognivern
adds the governance layer — compliance verdicts attached to the payment
itself, dispositions on every settlement, an approval inbox for the unsure
cases, and a cost-per-verified-answer metric — at ~$0.01–0.02 of governance
overhead per call.

**03 What does it do today?**
Live on production: 47 governed Telegraph calls ($0.44 x402 spend), a real
OFAC-listed wallet screened by top-ranked miner Counterproof that blocked a
downstream payment before settlement, 20 metered inference calls through our
OpenAI-compatible gateway, and 19 evaluator-sampled records producing a
verified-answer leaderboard (85.7% accuracy, $0.0065 per verified-correct).
The new Anjoman rail delegates multi-step due-diligence — one governed task
per bidder screens sanctions, reputation, and wallet risk across ranked
specialists — and the verdicts gate the Canton sealed-bid award itself.
Every claim re-runnable via `tooling/scripts/agents/telegraph-demo.ts`.

**04 Why would someone adopt it?**
Because "the agent paid a stranger and nobody can prove it was allowed" stops
being acceptable the moment spend is real. Mandates, compliance-on-payment,
and verified-answer economics are the difference between a demo and an
auditable agent economy. Before production: mainnet rail, more evaluator
coverage, and independent (non-miner) ground-truth checks.

**05 How can someone try it?**
`cognivern.persidian.com/telegraph` for the ledger and inbox;
`POST /api/telegraph/compliant-call`, `GET /api/telegraph/ledger`, and
`POST /api/credit-programs/:id/verify-sample` on the API; the CLI in
`tooling/scripts/agents/telegraph-demo.ts` re-runs the evidence. Maintained
by the Cognivern team; docs in `docs/TELEGRAPH.md` and
`docs/SPONSORED_CREDITS.md`.

## Submission checklist status

- [x] One product, one story — governed agent spend, compliance-on-payment, verified answers
- [x] Public code linked — `thisyearnofear/cognivern`
- [x] Working demo — live deployment + video
- [x] On-ledger/API evidence — run IDs, ledger endpoint, CLI
- [x] Venue tech is the wedge — every paid call flows through Telegraph miners/evaluators
- [ ] Form fields pasted and proofread — **do before submitting**
- [ ] Submitted for judging — confirm submitted state, not just saved
