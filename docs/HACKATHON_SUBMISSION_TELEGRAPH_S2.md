# Telegraph Protocol Season II — Cognivern Submission (working doc)

> Working submission document. Durable rails: [`./TELEGRAPH.md`](./TELEGRAPH.md)
> (governed calls, compliance-on-payment, ledger) and
> [`./SPONSORED_CREDITS.md`](./SPONSORED_CREDITS.md) (sponsored inference,
> verified-answer economics). Pre-submission pass:
> [`./SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md).

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
| Shareable payment evidence               | New `compliant-call` attempts attach a signed `evidenceBundle` before artifact persistence and expose it through `GET /api/telegraph/evidence/:runId`; authenticated retrieval verified on blocked gate run `f7d012d6-ae46-4f9e-8c14-6cbc60fdf908`, evidence hash `7058b798e116579a9ddf1790f777228102f2c1bd113be4787204d83f511bf41e`                     |
| Expense ledger with reverse states       | `GET /api/telegraph/ledger` — 137 calls, 102 paid calls, $1.00 cumulative recorded spend; dispositions include `approved / held_pending / released / quarantined / blocked / failed`; records now surface evidence hash/path, verdict source, and policy violations when present                                                                                               |
| Human-in-the-loop                        | `/inbox` — held telegraph runs approve (release) or reject (quarantine); UI-verified approve on run `55c4484a`                                                                                                                                                                                                                                                               |
| Verified-answer economics                | `POST /api/credit-programs/:id/verify-sample` — Groq `openai/gpt-oss-120b` program `prog_3c75599c-3913-4fcc-8edd-2aedc5674f08`; leaderboard: 20 ok calls, 19 sampled, 6 correct / 1 incorrect / 12 unknown, `verifiedAccuracy 0.857`, `costPerVerifiedCorrectUsd ≈ $0.0065`                                                                                                  |
| Cross-miner agreement                    | `verify-sample {"agreement":true}` — two distinct evaluators (TxLens + AssistWire) per record; verdicts persist only on unanimous decided verdicts, else `unknown` with per-evaluator breakdown. Live result: 3 unanimous `correct`, 7 `no consensus` — mostly TxLens held/unparseable, plus one genuine evaluator disagreement (TxLens `incorrect` vs AssistWire `correct`) |
| Independent benchmark                    | `tooling/scripts/agents/telegraph-benchmark.ts` — paid production fixture run: 3/3 pass, `$0.03` measured spend, two paid calls, 5,083ms average latency, 100% hit precision/recall, no review/unknown responses; all three gate runs expose authenticated evidence bundles |
| Anjoman delegated screening → award gate | `POST /api/vendor/sealed-bid/rounds/:id/screen-bidders` — one governed Anjoman task per bidder → `sealed_bid.vendor_screened` events on the round's hash-signed timeline → `/reveal` with `requireScreened` refuses to award an unscreened or hit vendor (403 + verdict map). Code + 27 tests landed; production API key configured/reachable; governed smoke tasks reached Anjoman and held fail-safe, while two $0.50-capped paid tasks hit provider 504s ($0.03 provider-reported unbilled) — paid specialist delegation still unproven |
| Judge re-runnability                     | `tooling/scripts/agents/telegraph-demo.ts` — dependency-free CLI over the live API (`ledger`, `evidence`, `compliant-call`, `anjoman-task`, `verify-sample`, `report`, `screen-round`, `reveal`)                                                                                                                                                                             |
| Demo video                               | `~/Downloads/telegraph-s2-demo.mp4` (local upload artifact, 72s, 720p)                                                                                                                                                                                                                                                                                                       |

Workspace auth: a workspace JWT (`Authorization: Bearer`) or workspace API key
(`x-api-key`). API base: `https://api.cognivern.persidian.com` · UI:
`https://cognivern.persidian.com/telegraph`.

**Post-deploy verification, November 23.** The production backend was redeployed
from `main` commit `5b9cdc24`, then again from `32e7c831` to activate the
provider-review / disputed-hit approval path. `/health` and `/health/ready` are
green; the active release registers `GET /api/telegraph/evidence/:runId` behind
workspace auth and contains the review pending actions. The November 22 run ids
above still predate bundles, so they will not populate the new endpoint. To
produce a fresh evidence bundle without buying another screen, run this
zero-cost spend-guard denial with a valid workspace credential:

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
expect the same bundle under `data.evidenceBundle`. Captured on November 23:
blocked gate run `f7d012d6-ae46-4f9e-8c14-6cbc60fdf908`, authenticated
retrieval returned schema `cognivern.telegraph.compliant-call-evidence.v1` and
evidence hash `7058b798e116579a9ddf1790f777228102f2c1bd113be4787204d83f511bf41e`.

**Paid benchmark validation, November 23.** `telegraph-benchmark.ts` ran all
three fixed cases against production: 3/3 passed, `$0.03` measured spend, two
paid calls, 5,083ms average latency, no review/unknown responses, and 100% hit
precision/recall. Run ids: `b70bd57c-c926-4423-ac72-a6a853b1f394` +
`978b4a1a-c457-4bd1-aa60-a0b6cd31be40` (hit denied), `65fa277b-a746-4c93-88f0-3b66c85abf15` +
`e7c8fae6-5263-408d-92d9-2b9aa34fdcc7` (clear approved), and
`8735b278-b099-4fb1-bb8d-043a2f6180d0` (zero-cost spend-guard denial). The
three gate evidence hashes were `d2150c41eae5ae2c2a140b0ff85edec78fc0b558be76c3d67809d579486d73cf`,
`21ea2b050a72bcb39c85dd47037998fbd66c5e79a8f44d3b49f8b20c85e8a7e3`, and
`860fbf813a9e863af935ec43a9277958bbcdff9aaaa8ccfd1425300f13fc0fe9`.

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
- Human-review path for provider `review` and explicitly disputed `hit` compliance gates via the existing CRE approval inbox (`held_pending → released/quarantined`)
- Independent fixed-case benchmark harness (`telegraph-benchmark.ts`) with declared ground truth, optional OpenAI-compatible baselines, JSON/Markdown reports, cost/latency, review/unknown/error rates, and false-positive/false-negative metrics
- `test(inference): cover openai-compat backend contract` (7 tests)
- Anjoman API-key rail — `AnjomanService` (`/agent/chat`, async-job poll/cancel, escrow balance) + `governedAnjomanTask` (`telegraph.signal`, `paymentMethod: "anjoman_api_key"`, fail-safe held)
- Anjoman-delegated vendor screening for sealed-bid rounds — `sealed_bid.vendor_screened` governance events + `requireScreened` reveal gate + UI badges + judge CLI
- `feat(telegraph): governed Solana settlement rail` — `SolanaSettlementService` (mandate-guarded SPL USDC `transferChecked`, idempotent `intentId`), `compliant-call` settlement leg with pre-screen guards, `settlementTransfer` evidence, x402 `ExactSvmScheme` registration, diligence-eval `--settlement-payee` + `/verify` settlement node (PR #106)
- Ledger/compliance/CRE rails from earlier commits (`18ccb457`, `47988448`, …)

Latest verification for the assurance slice: focused Telegraph compliance,
evidence, recorder, ledger, and benchmark unit tests pass; backend and frontend
typechecks pass; API client/sealed-bid UI lint passes; `git diff --check` is
clean; authenticated production evidence retrieval succeeded on run
`f7d012d6-ae46-4f9e-8c14-6cbc60fdf908`; and the paid benchmark passed all
three production fixture cases with `$0.03` measured spend.

## Honesty bounds (say these out loud)

- Payments are x402 stablecoin on a testnet rail — label as such.
- Verdicts are paid evaluator-miner assertions linked to governed runs, not
  independent ground truth. Agreement mode raises the bar (two miners must
  concur) but remains correlated miner opinion with receipts.
- `unknown` verdicts are stored and excluded from accuracy — never counted correct.
- Provider `review` is distinct from malformed `unknown` and now creates an
  approval-inbox case when the screening call itself was approved; `hit`
  requires explicit `compliance.disputeHit`, while `unknown` and undisputed
  hits still block payment.
- The benchmark harness declares independent fixture ground truth and reports
  response hashes/metrics. `--dry-run` validates the suite; the November 23
  paid production fixture run passed 3/3 cases with `$0.03` measured spend.
  Three cases are evidence, not broad coverage.
- Shareable bundles omit the screened subject and sit behind workspace auth;
  they carry hashes and run linkage, not a public unauthenticated receipt.
- `spendGuard` proves the evaluated request stayed inside the declared caps
  and allowlists. `budgetId` is linkage only; it does not yet debit a budget.
- Anjoman is configured and reachable on production. Governed smoke tasks
  created fail-safe held runs; two paid attempts hit provider-side 504s and
  the balance endpoint reported `$0.03` cumulative unbilled, so do not claim
  completed paid specialist delegation yet.
- Only `open`-disclosure-tier records are sampled; private/detailed content is never sent to evaluators.
- Solana settlement executes only after gate approval and inside the mandate
  caps — but the live on-chain evidence is not yet produced (funded run
  pending). Until the first real signature exists, every settlement claim
  in this document is "tested code", not "observed on-chain".
- No custom on-chain program is deployed; the reviewable surface is the
  TypeScript service, not contract code.

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
Live on production: 137 governed Telegraph calls ($1.00 cumulative recorded
spend), a clear-screened payment that settled with compliance proof,
a real sanctions hit that blocked a downstream payment before settlement,
and an uninterpretable screen that also blocked before settlement. The
November 22 validation sequence spent exactly $0.10 of Base Sepolia USDC.
The current implementation also normalizes provider `REVIEW`, routes provider
review and explicitly disputed hits into the operator approval inbox, attaches a
signed evidence bundle to each new compliant-call attempt, enforces
spend-guard policy before and after the paid screen, and exposes the bundle
through an authenticated evidence endpoint and judge CLI. Authenticated bundle
retrieval is verified on run `f7d012d6-ae46-4f9e-8c14-6cbc60fdf908`. A
fixed-case benchmark harness scored all three production fixture cases against
independent ground truth: 3/3 passed with `$0.03` measured spend, 5,083ms
average latency, no review/unknown responses, and 100% hit precision/recall.
Separately, 20 metered inference calls through our OpenAI-compatible gateway
produced 19 evaluator-sampled records and a verified-answer leaderboard
(85.7% accuracy, $0.0065 per verified-correct). The new Anjoman rail is
configured on production and reachable; governed smoke tasks reached Anjoman
and held fail-safe, while two $0.50-capped paid attempts hit provider-side
504s (`$0.03` provider-reported unbilled), so paid specialist delegation is
not yet claimed. Implemented claims are re-runnable via
`tooling/scripts/agents/telegraph-demo.ts`.

**04 Why would someone adopt it?**
Because "the agent paid a stranger and nobody can prove it was allowed" stops
being acceptable the moment spend is real. Mandates, compliance-on-payment,
and verified-answer economics are the difference between a demo and an
auditable agent economy. Before production: a funded mainnet settlement run
(the rail is code-complete but has only moved devnet/test USDC so far), more
evaluator coverage, and independent (non-miner) ground-truth checks.

**05 How can someone try it?**
`cognivern.persidian.com/telegraph` for the ledger and inbox;
`POST /api/telegraph/compliant-call`, `GET /api/telegraph/evidence/:runId`,
`GET /api/telegraph/ledger`, and `POST /api/credit-programs/:id/verify-sample`
on the API; the CLI in `tooling/scripts/agents/telegraph-demo.ts` re-runs the
evidence. Maintained by the Cognivern team; docs in `docs/TELEGRAPH.md` and
`docs/SPONSORED_CREDITS.md`.

## Enterprise extension: supplier diligence (model-agnostic)

Telegraph's team asked whether Cognivern could demonstrate what the
intelligence network enables for Alibaba Cloud and Qwen. What was built —
and included in this submission — is **not** a Qwen-specific fork; it is a
model-agnostic enterprise example proving the difference between a model
answering alone and an agent making a governed, independently evidenced
decision. Any OpenAI-compatible model slots in; Qwen (via Alibaba Cloud
Model Studio) is the first configuration, and two or more models can be
compared side by side in one run.

**Scenario:** cross-border supplier onboarding and payment risk.

**Comparison per case:**

1. **Model alone** evaluates the supplier and recommends `proceed`, `hold`,
   or `reject`, with model usage/cost recorded.
2. **Model + Cognivern + Telegraph** evaluates the same supplier under a
   mandate and spend cap: a two-step compliant-call buys sanctions screening
   (miners `731002`, `710637`) gating corporate-registry (`7393`) and
   vendor-verify (`7396`) specialist purchases, the declared gate policy
   decides clear-cut cases itself, and only then does the same model
   synthesize a recommendation from the purchased evidence. Disputed or
   uncertain screens — including purchased evidence held by the confidence
   gate — route to the approval inbox.

The evidence is the paired report: model/provider, token usage and cost,
Telegraph specialist spend, compliance verdicts, final decision and who
decided it, run ids, and evidence hashes — plus the point where specialist
intelligence changed or escalated the business decision.

Implementation: named OpenAI-compatible providers via
`OPENAI_COMPAT_PROVIDERS` (no dedicated `qwen` backend — the existing Groq
`openai-compat` route is untouched, and a stored upstream credential that
does not match the program's backend is ignored), and the
`telegraph:diligence` runner (`tooling/scripts/agents/telegraph-diligence.ts`)
with four fixed supplier cases (listed entity, registered-clear,
unregistered entity, individual name-match). Results are pending a live
run; this is an
enterprise example, not a claim of Alibaba adoption or partnership.

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
4. **Stablecoin payment guard (implemented on Solana).** `compliant-call`
   now carries `settlement: {rail: "solana", payee, amountUsd, intentId}` —
   the payment intent this item described. All guards (mandate policy, payee
   allowlist, per-transfer and cumulative caps, rail readiness, payer
   SOL/USDC balance) run before the paid screen; a governed SPL USDC
   `transferChecked` executes once per `intentId` only on gate approval.
   Replay safety is a durable pre-broadcast intent journal (not process
   memory), so restarts and concurrent retries cannot double-pay; ambiguous
   broadcasts are recorded as `uncertain` and never blind-retried. Outcomes
   land as `settlementTransfer` in the evidence bundle and on `/verify`.
   Mainnet requires `SOLANA_ALLOW_MAINNET=true`; devnet is the default.
   See "Solana commercial use cases" below.
5. **Human review path (implemented).** Provider `REVIEW` verdicts enter the
   existing approval inbox as paused gate runs; an explicit
   `compliance.disputeHit: true` does the same for a disputed `hit`. Approval
   releases and rejection quarantines the review case, without silently
   clearing the provider verdict or resuming the denied parent payment.
6. **Independent benchmark harness (implemented and live-verified).**
   `telegraph-benchmark.ts` re-runs fixed public cases against declared ground
   truth and emits JSON/Markdown reports with cost, latency, review/unknown/error
   rates, and hit precision/recall including false positives/negatives. The
   November 23 paid production fixture run passed all three cases with `$0.03`
   measured spend. Optional `--baseline` compares an OpenAI-compatible frontier
   model.
7. **Supplier diligence example (implemented, live run pending).** Named
   OpenAI-compatible providers via `OPENAI_COMPAT_PROVIDERS` (Qwen first,
   model-agnostic — no dedicated backend) plus the `telegraph:diligence`
   runner comparing model-alone versus model+Cognivern+Telegraph on fixed
   supplier cases with paired cost/evidence reports.
8. **Router + agent SDK (P2).** Route miners by measured quality/cost and
   expose `screenBeforeSpend`, `buyIntel`, `getEvidence`, `budgetStatus`, and
   `approveReview` as tools agents can use without learning CRE internals.
9. **Workflow templates (P3).** Package stablecoin treasury compliance,
   procurement/vendor due diligence, pre-trade settlement checks, and
   company/document intelligence only after the primitives are solid.

The compliance review path is now implemented alongside the first build
slice. The next core rail is the payment-intent workflow; the supplier
diligence item is a bounded, model-agnostic enterprise example rather than
generic model routing. Durable
detail lives in
[`./TELEGRAPH.md#product-roadmap-after-mission-02-validation`](./TELEGRAPH.md#product-roadmap-after-mission-02-validation).

## Solana commercial use cases (PR #106)

The Telegraph team's Solana brief asked for institutional agents operating
with "enforceable spending mandates, independently verified intelligence,
transaction authorization and auditable settlement." Cognivern's answer
combines use cases **#1 Institutional Transaction Intelligence** and **#4
Verified Global Trade** on one rail:

- **Enforceable spending mandates** — `SolanaSettlementService` guards run
  before any paid intelligence is bought: funded-mandate policy (budget,
  allowed assets, chain constraints), payee allowlist, per-transfer cap
  (`SOLANA_SETTLEMENT_MAX_USD`), cumulative runway, and a kill switch. A
  blocked payee never costs a cent, and the rail also fails closed on
  malformed config, an unarmed mainnet, or an unfunded payer.
- **Independently verified intelligence** — the existing compliant-call
  rail: paid sanctions/registry/vendor screens from Telegraph miners gate
  every decision.
- **Transaction authorization** — the governed gate: `clear` → settle,
  `hit`/`unknown` → block, `review`/disputed → human approval inbox.
- **Auditable settlement** — SPL USDC `transferChecked` on devnet or
  mainnet-beta, executed once per `intentId` through a durable pre-broadcast
  journal (restart- and concurrency-safe; ambiguous sends become `uncertain`
  and are never blind-retried), with `cluster` + `signature` in the public
  report and a solscan link on `/verify`.

**Scope note for reviewers:** no custom on-chain program is deployed. The
service composes the canonical SPL Token program; all governance logic lives
in `src/backend/services/blockchain/solana/` and the `compliant-call`
settlement leg in `TelegraphController.ts`. SOL funds transaction fees plus
~0.00204 SOL of rent when a payee's token account is first created; neither
is part of the USDC caps. The rail does not screen the payee address itself —
the allowlist is the payee control, and the compliance screen covers whatever
subject is passed to `compliance.params`.

**Status:** code complete and unit/integration-tested
(`SolanaSettlementService` unit suite including a mocked-RPC broadcast,
durable-journal replay/concurrency tests, settlement-policy tests, diligence
plumbing + public-report leak-guard tests, controller suite). **Live funded
run pending** — devnet first, then mainnet with `SOLANA_ALLOW_MAINNET=true`;
the diligence eval will settle cleared suppliers at $0.01 USDC each against a
second controlled wallet, with screened-out suppliers receiving nothing.

## Submission checklist status

- [x] One product, one story — governed agent spend, compliance-on-payment, verified answers
- [x] Public code linked — `thisyearnofear/cognivern`
- [x] Working demo — live deployment + video
- [x] On-ledger/API evidence — run IDs, ledger endpoint, CLI
- [x] Venue tech is the wedge — every paid call flows through Telegraph miners/evaluators
- [ ] Form fields pasted and proofread — **do before submitting**
- [ ] Submitted for judging — confirm submitted state, not just saved
