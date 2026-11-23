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
compliance screen can gate the payment itself; each compliant call can carry
a signed evidence bundle and spend-guard evaluation; low-confidence signals
pause in a human approval inbox; and sampled inference answers are judged by
paid evaluator miners into a cost-per-verified-answer leaderboard.

## Live evidence (all re-runnable)

| Claim                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compliance proof attached to payment     | `POST /api/telegraph/compliant-call` — sanctions screen `clear` (screening run `9961cba1-130a-43cd-8968-7088e4fa1a16`, Sanctions Name Evidence `710637`) → parent `GAS_PRICE` settled (run `3dd5beff-f9ad-4d89-9648-53d3804c36c2`, TxLens `9002`, `telegraph.signal` artifact `5ea178aa-185e-4e39-a611-a8f22396cbb8` carrying `compliance.verdict: "clear"`)                 |
| Compliance gate blocks downstream paid spend | `compliant-call` screening `ISIL KHORASAN` via **Counterproof Sanctions Screener** (miner `731002`) → verdict `hit` (`matched=true`) → parent `GAS_PRICE` purchase **denied before settlement**. Screening run `e916cddf-2032-4e8f-bfce-e9be80f83a0c`; gate-decision run `2f509267-f0c2-466d-9b70-5ca37f658221`; only the $0.01 screen was paid                              |
| Inconclusive screen blocks downstream paid spend | `compliant-call` with a paid but uninterpretable screen response → verdict `unknown` (`no recognizable verdict field in screening response`) → parent purchase **denied before settlement**. Screening run `9e349959-82a8-4d89-9980-4794000c55d4`; gate-decision run `f4300716-fa82-4f1f-9073-fbb70a40a3bf`; only the $0.01 screen was paid                                  |
| Shareable payment evidence               | New `compliant-call` attempts attach a signed `evidenceBundle` before artifact persistence and expose it through `GET /api/telegraph/evidence/:runId`; the November 22 run ids above predate the bundle, so they remain receipt evidence but do not have this retrieval endpoint populated                                                                                   |
| Expense ledger with reverse states       | `GET /api/telegraph/ledger` — 117 calls, 88 paid calls, $0.88 cumulative testnet spend; dispositions include `approved / held_pending / released / quarantined / blocked / failed`; records now surface evidence hash/path, verdict source, and policy violations when present                                                                                               |
| Human-in-the-loop                        | `/inbox` — held telegraph runs approve (release) or reject (quarantine); UI-verified approve on run `55c4484a`                                                                                                                                                                                                                                                               |
| Verified-answer economics                | `POST /api/credit-programs/:id/verify-sample` — Groq `openai/gpt-oss-120b` program `prog_3c75599c-3913-4fcc-8edd-2aedc5674f08`; leaderboard: 20 ok calls, 19 sampled, 6 correct / 1 incorrect / 12 unknown, `verifiedAccuracy 0.857`, `costPerVerifiedCorrectUsd ≈ $0.0065`                                                                                                  |
| Cross-miner agreement                    | `verify-sample {"agreement":true}` — two distinct evaluators (TxLens + AssistWire) per record; verdicts persist only on unanimous decided verdicts, else `unknown` with per-evaluator breakdown. Live result: 3 unanimous `correct`, 7 `no consensus` — mostly TxLens held/unparseable, plus one genuine evaluator disagreement (TxLens `incorrect` vs AssistWire `correct`) |
| Anjoman delegated screening → award gate | `POST /api/vendor/sealed-bid/rounds/:id/screen-bidders` — one governed Anjoman task per bidder → `sealed_bid.vendor_screened` events on the round's hash-signed timeline → `/reveal` with `requireScreened` refuses to award an unscreened or hit vendor (403 + verdict map). Code + 27 tests landed; live run pending `ANJOMAN_API_KEY`                                     |
| Judge re-runnability                     | `tooling/scripts/agents/telegraph-demo.ts` — dependency-free CLI over the live API (`ledger`, `evidence`, `compliant-call`, `anjoman-task`, `verify-sample`, `report`, `screen-round`, `reveal`)                                                                                                                                                                             |
| Demo video                               | `~/Downloads/telegraph-s2-demo.mp4` (local upload artifact, 72s, 720p)                                                                                                                                                                                                                                                                                                       |

Workspace auth: a workspace JWT (`Authorization: Bearer`) or workspace API key
(`x-api-key`). API base: `https://api.cognivern.persidian.com` · UI:
`https://cognivern.persidian.com/telegraph`.

**Post-deploy verification, November 23.** The production backend was redeployed
from `main` commit `5b9cdc24`; `/health` is green and the active release
registers `GET /api/telegraph/evidence/:runId` behind workspace auth. The
November 22 run ids above still predate bundles, so they will not populate the
new endpoint. To produce a fresh evidence bundle without buying another screen,
run this zero-cost spend-guard denial with a valid workspace credential:

```bash
pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts compliant-call '{
  "minerId": "9002",
  "intent": "GAS_PRICE",
  "params": {"chain": "base", "unit": "gwei"},
  "compliance": {"params": {"name": "COGNIVERN_EVIDENCE_PROBE"}},
  "spendGuard": {"subjectDenylist": ["COGNIVERN_EVIDENCE_PROBE"]},
  "description": "Zero-cost spend-guard evidence probe"
}'
```

Expected: `blocked: true`, `status: "denied"`, a `runId`, and an embedded
`evidenceBundle`; no screening or parent call is purchased. Then run
`pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts evidence <runId>` and
expect the same bundle under `data.evidenceBundle`. A successful authenticated
retrieval receipt still needs to be captured with a valid workspace credential.

**Live validation, November 22.** The capped Mission 02 sequence spent exactly
$0.10 of Base Sepolia USDC across the canonical clear/hit/unknown cases and
additional exploratory probes. Canonical receipts: clear screening run
`9961cba1-130a-43cd-8968-7088e4fa1a16` + settled parent
`3dd5beff-f9ad-4d89-9648-53d3804c36c2`; hit screening run
`e916cddf-2032-4e8f-bfce-e9be80f83a0c` + denied gate run
`2f509267-f0c2-466d-9b70-5ca37f658221`; unknown screening run
`9e349959-82a8-4d89-9980-4794000c55d4` + denied gate run
`f4300716-fa82-4f1f-9073-fbb70a40a3bf`. Exploratory name probes returned
additional `clear` and `hit` receipts; the `unknown` receipt used a paid screen
whose response deliberately lacked a recognizable compliance verdict.

**Staging evidence, November 21 (not a live Anjoman call).** An agent-governed round on a disposable Canton participant received three bids. The backend rejected an early close (403), accepted close after the deadline (200), then rejected reveal with `requireScreened: true` because no bidder had screening evidence (403). `/verify` still showed a closed round with no winner or result reference. Cancellation succeeded and `/verify` returned a cancellation ledger reference, still with no winner. This proves the opt-in refusal and cancellation paths over HTTP. It does not prove that Anjoman returned a verdict or that an award without `requireScreened` is screened.

## What changed this season (git-visible)

- `feat(inference): openai-compatible backend for sponsored-credit programs` — provider-agnostic upstream (Groq live)
- `feat(verification): cross-miner agreement mode for verify-sample` + flaky-evaluator demotion
- `feat(telegraph): judge-facing CLI for re-running live evidence`
- `feat(telegraph): cumulative spend trajectory on intelligence ledger`
- Provider-aware compliance verdicts (`clear / hit / review / unknown`), including Counterproof `CLEAR / REVIEW / BLOCK` labels and explicit-provider precedence over recursive guesses
- Signed `evidenceBundle` on every compliant-call gate/settlement artifact + authenticated `GET /api/telegraph/evidence/:runId` + `telegraph-demo.ts evidence <runId>`
- Fail-closed `spendGuard` on `compliant-call` (screening/total caps, miner and intent allowlists, hashed subject terms, consensus count, budget linkage) with violations recorded before and after screening
- `test(inference): cover openai-compat backend contract` (7 tests)
- Anjoman API-key rail — `AnjomanService` (`/agent/chat`, async-job poll/cancel, escrow balance) + `governedAnjomanTask` (`telegraph.signal`, `paymentMethod: "anjoman_api_key"`, fail-safe held)
- Anjoman-delegated vendor screening for sealed-bid rounds — `sealed_bid.vendor_screened` governance events + `requireScreened` reveal gate + UI badges + judge CLI
- Ledger/compliance/CRE rails from earlier commits (`18ccb457`, `47988448`, …)

Latest local verification for the assurance slice: six focused unit files
pass (47 tests), backend and frontend typechecks pass, the updated API client
and sealed-bid UI lint pass, and `git diff --check` is clean.

## Honesty bounds (say these out loud)

- Payments are x402 stablecoin on a testnet rail — label as such.
- Verdicts are paid evaluator-miner assertions linked to governed runs, not
  independent ground truth. Agreement mode raises the bar (two miners must
  concur) but remains correlated miner opinion with receipts.
- `unknown` verdicts are stored and excluded from accuracy — never counted correct.
- Provider `review` is now distinct from malformed `unknown`, but both still
  block payment until a human-review/second-opinion workflow exists.
- Shareable bundles omit the screened subject and sit behind workspace auth;
  they carry hashes and run linkage, not a public unauthenticated receipt.
- `spendGuard` proves the evaluated request stayed inside the declared caps
  and allowlists. `budgetId` is linkage only; it does not yet debit a budget.
- Only `open`-disclosure-tier records are sampled; private/detailed content is never sent to evaluators.

## Apps & Agents — five commercial questions (paste-ready answers)

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
Live on production: 117 governed Telegraph calls ($0.88 cumulative x402
testnet spend), a clear-screened payment that settled with compliance proof,
a real sanctions hit that blocked a downstream payment before settlement,
and an uninterpretable screen that also blocked before settlement. The
November 22 validation sequence spent exactly $0.10 of Base Sepolia USDC.
The current implementation also normalizes provider `REVIEW`, routes provider
review and explicitly disputed hits into the operator approval inbox, attaches a
signed evidence bundle to each new compliant-call attempt, enforces
spend-guard policy before and after the paid screen, and exposes the bundle
through an authenticated evidence endpoint and judge CLI. Separately, 20 metered
inference calls through our OpenAI-compatible gateway produced 19
evaluator-sampled records and a verified-answer leaderboard (85.7% accuracy,
$0.0065 per verified-correct). The new Anjoman rail is implemented and covered
by tests: it can delegate one governed due-diligence task per bidder, and its
verdicts gate the Canton sealed-bid award; the live Anjoman run is pending a
production API key. Implemented claims are re-runnable via
`tooling/scripts/agents/telegraph-demo.ts`.

**04 Why would someone adopt it?**
Because "the agent paid a stranger and nobody can prove it was allowed" stops
being acceptable the moment spend is real. Mandates, compliance-on-payment,
and verified-answer economics are the difference between a demo and an
auditable agent economy. Before production: mainnet rail, more evaluator
coverage, and independent (non-miner) ground-truth checks.

**05 How can someone try it?**
`cognivern.persidian.com/telegraph` for the ledger and inbox;
`POST /api/telegraph/compliant-call`, `GET /api/telegraph/evidence/:runId`,
`GET /api/telegraph/ledger`, and `POST /api/credit-programs/:id/verify-sample`
on the API; the CLI in `tooling/scripts/agents/telegraph-demo.ts` re-runs the
evidence. Maintained by the Cognivern team; docs in `docs/TELEGRAPH.md` and
`docs/SPONSORED_CREDITS.md`.

## Product developments worth implementing next

The commercial wedge is not "another model call." It is paid specialist
intelligence that can govern an action and leave a receipt a buyer, auditor,
or judge can independently verify. Ordered by leverage:

1. **Provider verdict adapters (implemented).** Canonical verdicts are now
   `clear / hit / review / unknown`. Explicit provider labels take precedence
   over recursive field guesses; Counterproof `CLEAR / REVIEW / BLOCK` maps to
   `clear / review / hit`; the raw response hash and verdict source are kept
   with the compliance block.
2. **Shareable evidence bundle (implemented).** Each compliant-call attempt
   now writes a signed `cognivern.telegraph.compliant-call-evidence.v1`
   bundle into the gate or settlement artifact. It links screen/gate/parent
   run and artifact ids, hashes, miner/source/list metadata, costs, payment
   network, policy evaluation, and replay metadata without exposing the
   screened subject. `GET /api/telegraph/evidence/:runId` and
   `telegraph-demo.ts evidence <runId>` retrieve it.
3. **Spend-guard policy (implemented).** `spendGuard` supports max screening
   and total cost, parent/screen miner and intent allowlists, normalized
   subject allow/deny terms (hashed in evidence), consensus count, and budget
   linkage. Checks run before any payment and again before the parent purchase;
   violations fail closed and are recorded on the artifact and ledger.
4. **Stablecoin payment guard (P1).** Turn `compliant-call` into a payment
   intent: payee + amount + rail → sanctions/fraud/transaction-risk screen →
   `allow / deny / review` → purchase or settlement.
5. **Human review path (implemented).** Provider `REVIEW` verdicts enter the
   existing approval inbox as paused gate runs; an explicit
   `compliance.disputeHit: true` does the same for a disputed `hit`. Approval
   releases and rejection quarantines the review case, without silently
   clearing the provider verdict or resuming the denied parent payment.
6. **Independent benchmarks (P1).** Re-run fixed public cases against
   authoritative records and compare miners with frontier-model baselines:
   precision/review/error rates, latency, and cost per verified answer.
7. **Router + agent SDK (P2).** Route miners by measured quality/cost and
   expose `screenBeforeSpend`, `buyIntel`, `getEvidence`, `budgetStatus`, and
   `approveReview` as tools agents can use without learning CRE internals.
8. **Workflow templates (P3).** Package stablecoin treasury compliance,
   procurement/vendor due diligence, pre-trade settlement checks, and
   company/document intelligence only after the primitives are solid.

The compliance review path is now implemented alongside the first build
slice; the next useful product step is the payment-intent workflow, not
generic model routing. Durable detail lives in
[`../TELEGRAPH.md#product-roadmap-after-mission-02-validation`](../TELEGRAPH.md#product-roadmap-after-mission-02-validation).

## Submission checklist status

- [x] One product, one story — governed agent spend, compliance-on-payment, verified answers
- [x] Public code linked — `thisyearnofear/cognivern`
- [x] Working demo — live deployment + video
- [x] On-ledger/API evidence — run IDs, ledger endpoint, CLI
- [x] Venue tech is the wedge — every paid call flows through Telegraph miners/evaluators
- [ ] Form fields pasted and proofread — **do before submitting**
- [ ] Submitted for judging — confirm submitted state, not just saved
