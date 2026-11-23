# Proof and eval contracts

Every rail ends in the same thing: something was asked, money moved under a
mandate, a decision was made, and there is a receipt. This doc fixes the two
contracts that let one public surface (`/verify`) and one report shape serve
every rail, so a new rail or a new eval does not need a new page or a new
format.

Status: the proof envelope is implemented as a shared type plus client-side
adapters. The eval contract is a decision of record, not yet implemented.

## 1. Proof envelope — `cognivern.proof.v1`

Type: `PublicProof` in `packages/shared/src/proof.ts`.

| Field | Answers |
| --- | --- |
| `kind`, `id`, `title` | Which proof is this? |
| `asked` | What was asked, in one sentence. |
| `mandate` | Under which mandate (id and label; null when the rail does not carry one yet). |
| `spent` | What it cost in USD, with a note saying what the figure is. Null when the source has no USD figure — never estimated. |
| `decided` | The outcome and one line of detail. |
| `receipts` | Hashes, run ids and anchors a third party can check. |
| `limits` | What this proof does not show. |

Rules:

- The envelope is a summary over a rail's own public record. It never
  replaces that record and never contains anything the record does not.
- Adapters are pure functions at the boundary
  (`src/frontend/src/lib/proof.ts`). `/verify` renders the envelope with one
  component (`ProofSummary`) above each mode's own detail view.
- A new proof type is a new `kind`, an adapter, and a `/verify` mode. It is
  not a new route.
- Publication is opt-in and redacted. Private evidence stays behind
  workspace auth; the envelope carries hashes and ids, not payloads.

| Kind | Source record | Mandate carried today |
| --- | --- | --- |
| `credit-commitment` | `GET /verify/credit-commitment/:id` | Program id and name |
| `sealed-bid-round` | `GET /api/vendor/sealed-bid/rounds/:roundId/verify` | No |
| `diligence-report` | `cognivern.telegraph.diligence-public-report.v1` static file | Mandate id |

Not yet adapted, in order of value:

1. **Mandate statement export**
   (`GET /api/mandates/:mandateId/statements/:statementId/export`). It is the
   canonical "funded mandate → outcome" record and should become the
   reference kind; it needs a public, redacted read path first.
2. **Telegraph compliant-call evidence bundle**
   (`cognivern.telegraph.compliant-call-evidence.v1`). Workspace-auth only
   today; a public read needs an explicit publish action.
3. **Backend-native emission.** Once two more kinds exist, move the adapters
   server-side so every public endpoint returns the envelope alongside its
   record.

## 2. Eval contract — cases in, report out (decision, not implemented)

Five harnesses exist with five formats: the Telegraph benchmark, the
supplier-diligence runner, `verify-sample`, the Lexsi spend-governance evals
and the HydraDB mandate evaluation. They share one structure, and new
harness work should converge on it instead of adding a sixth format.

- **Cases** (`cognivern.eval.cases.v1`): a declared `policy`, and per case an
  `id`, an `input`, an `expected` result, and `groundTruth`
  (`source`, `assertion`, `checkedAt`). Ground truth is independent of the
  system being measured.
- **Arms**: the things being compared on the same cases — a model alone, the
  same model governed, a retrieval mode, a miner.
- **Report** (`cognivern.eval.report.v1`): per case and arm the `observed`
  result, `correct`, `costUsd`, `latencyMs` and `receipts`; a per-arm
  summary; and `limits`. Unknown or unparseable results are stored and
  counted as incorrect, never dropped.
- **Publication**: a report is published as a proof of kind `eval-report`
  and viewed at `/verify`, so a stakeholder who brings cases and a policy
  gets back a link.

| Harness | Cases today | Arms | Gap to the contract |
| --- | --- | --- | --- |
| Supplier diligence (`telegraph-diligence.ts`) | Fixed suppliers with ground truth | Model × alone/governed | Closest; rename fields, emit the shared schema |
| Telegraph benchmark (`telegraph-benchmark.ts`) | Fixed cases with ground truth | Telegraph, optional baseline model | Same structure, own field names |
| `verify-sample` | Sampled live inference records | Evaluator miner(s) | No fixed cases or independent ground truth; verdicts are miner opinion |
| HydraDB mandate evaluation | Question set | Graph vs no-graph | Aggregate-only output; per-case results not in the published JSON |
| Lexsi evals (`lexsi/`) | Task files | Base vs tuned model | Separate Python pipeline; export step needed |

Order: converge the two Telegraph harnesses first (same language, same
author, both already carry ground truth), then add the `eval-report` proof
kind, then exporters for the other three.

## 3. What stays separate on purpose

- `/sponsor` and `/procure` remain thin audience entry pages: different
  buyers, different pitches.
- `/procure/demo` keeps its own route for now. It is the interactive
  companion to a published field note that links to it, and its look is part
  of that piece.
- `/sponsor/sample` shows labelled fixture data. It should be replaced by a
  real cohort's commitment on `/verify`, not ported. That needs a published
  cohort to point at.
