# Settlement execution pipeline — current shape and evolution path

Status: current as of 2026-11-25. Companion to `docs/TELEGRAPH.md` (operator
semantics) — this note covers the architecture decision and its deliberate
limits.

## What exists today

The Solana settlement leg of the compliant-call pipeline lives in
`src/backend/services/blockchain/solana/SettlementFlow.ts`, with a documented
phase contract whose ordering is load-bearing:

1. `parseSettlementIntent` — body validation + intentId derivation (stable
   across identical retries, distinct when the payload changes).
2. `settlementPreScreenGuard` — mandate policy + rail preflight run BEFORE
   the paid screen, so a settlement that cannot execute never buys
   intelligence it could not settle.
3. `settlementExecuteIfApproved` — execution only after an approved parent
   call, plus single-flight mandate debit.
4. `enrichUncertainEvidence` — journalled signature/explorer state attached
   to uncertain outcomes for reconciliation.

Error mapping (blocked / uncertain / unavailable / failed) is centralized in
the same module so a second caller cannot diverge from the semantics.
`TelegraphController.compliantCall` is a thin caller (~35 lines of
orchestration).

## Deliberate future step, not debt

The phase contract is currently Solana-shaped: it names the rail's service,
policy resolver, and evidence fields directly. When a **second non-EVM rail**
arrives (i.e. a third settlement pathway beyond Cleanverse/EVM and
Solana), the plan is to lift the phase contract into a rail-agnostic
pre-execution pipeline:

- A `SettlementPhase` interface (parse / preScreenGuard / executeIfApproved /
  enrich) that each rail implements.
- A registry keyed by `settlement.rail`, mirroring the existing
  `ExecutionBackend` registry in `src/backend/services/blockchain/execution/`.
- The controller calls the pipeline, never a rail directly.

Why not now: there is exactly one consumer of the contract and one rail that
uses it. Extracting a generic pipeline today would be speculative
generalization against a single data point — the abstraction would be guessed,
not observed. The current module boundary is the cheap, honest version: the
semantics are already centralized and the controller is already thin, so the
future lift is mechanical (move the interface, register rails) rather than a
rewrite.

Trigger for doing it: the second rail's PR. At that point this note should be
updated or removed in favor of the pipeline's own doc.
