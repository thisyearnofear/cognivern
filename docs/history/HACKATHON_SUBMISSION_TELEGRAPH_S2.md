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
| Expense ledger with reverse states | `GET /api/telegraph/ledger` — 23 calls, $0.22 spend, dispositions `approved / held_pending / released / quarantined / blocked / failed` |
| Human-in-the-loop | `/inbox` — held telegraph runs approve (release) or reject (quarantine); UI-verified approve on run `55c4484a` |
| Verified-answer economics | `POST /api/credit-programs/:id/verify-sample` — Groq `openai/gpt-oss-120b` program `prog_3c75599c-3913-4fcc-8edd-2aedc5674f08`; leaderboard: 10 ok calls, 9 sampled, 3 correct / 1 incorrect / 5 unknown, `verifiedAccuracy 0.75`, `costPerVerifiedCorrectUsd ≈ $0.006` |
| Cross-miner agreement | `verify-sample {"agreement":true}` — two distinct evaluators (TxLens + AssistWire) per record; verdicts persist only on unanimous decided verdicts, else `unknown` with per-evaluator breakdown |
| Judge re-runnability | `tooling/scripts/agents/telegraph-demo.ts` — dependency-free CLI over the live API (`ledger`, `compliant-call`, `verify-sample`, `report`) |
| Demo video | `~/Downloads/telegraph-s2-motion.mp4` (local artifact, ~108s, 1080p) |

Workspace auth: a workspace JWT (`Authorization: Bearer`). API base:
`https://api.cognivern.persidian.com` · UI: `https://cognivern.persidian.com/telegraph`.

## What changed this season (git-visible)

- `feat(inference): openai-compatible backend for sponsored-credit programs` — provider-agnostic upstream (Groq live)
- `feat(verification): cross-miner agreement mode for verify-sample` + flaky-evaluator demotion
- `feat(telegraph): judge-facing CLI for re-running live evidence`
- `feat(telegraph): cumulative spend trajectory on intelligence ledger`
- `test(inference): cover openai-compat backend contract` (7 tests)
- Ledger/compliance/CRE rails from earlier commits (`18ccb457`, `47988448`, …)

## Honesty bounds (say these out loud)

- Payments are x402 stablecoin on a testnet rail — label as such.
- Verdicts are paid evaluator-miner assertions linked to governed runs, not
  independent ground truth. Agreement mode raises the bar (two miners must
  concur) but remains correlated miner opinion with receipts.
- `unknown` verdicts are stored and excluded from accuracy — never counted correct.
- Only `open`-disclosure-tier records are sampled; private/detailed content is never sent to evaluators.

## Submission checklist status

- [x] One product, one story — governed agent spend, compliance-on-payment, verified answers
- [x] Public code linked — `thisyearnofear/cognivern`
- [x] Working demo — live deployment + video
- [x] On-ledger/API evidence — run IDs, ledger endpoint, CLI
- [x] Venue tech is the wedge — every paid call flows through Telegraph miners/evaluators
- [ ] Form fields pasted and proofread — **do before submitting**
- [ ] Submitted for judging — confirm submitted state, not just saved
