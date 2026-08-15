# Telegraph Protocol Hackathon — Track 3 Application Proposal

> **Status:** Scoping / concept (no code shipped). Decided **Track 3 only** — an
> Application — not Tracks 1 or 2. This keeps the work **additive** to the live
> Flare, Cleanverse/Monad, and Canton/DevNet rails and builds *our* product
> rather than supplying intelligence to someone else's network.
>
> **Window:** Track 3 opens **Aug 31** and runs to **Sep 7, 2026** (Tracks 1&2 are
> Aug 17–31 and are *not* our target).
> **Web:** https://hackathon.telegraphprotocol.com · docs · rules · supported-intents

---

## 1. TL;DR — the one-liner

**A governed "verified-intelligence → on-chain action" application**: consume a
**real Telegraph Miner** response for an on-chain financial intent (with a
confidence threshold), route the resulting intended action through Cognivern's
*existing* policy engine, wallet, execution providers, and CRE/audit ledger, and
produce an on-chain action that is **bounded, attributable, and evidenced** —
the exact "autonomous agents can't act on raw unverified responses" gap Telegraph
itself names.

This maps 1:1 to Telegraph's own **high-value area**:

> "Build agents that consume verified intelligence and directly trigger on-chain
> actions — trading, liquidations, arbitrage, compliance checks, treasury
> management."

---

## 2. Why this and not Tracks 1/2 (fit recap)

| Telegraph track | What you build | Fit vs Cognivern | Verdict |
| --- | --- | --- | --- |
| **1 — Miners** | Wrap an API/model and serve an intent | We don't supply intelligence; crowded lane | **Not us** |
| **2 — Evaluation Scripts** | Score miners vs ground truth | Not model-eval; our eval muscle is agent-safety tuned | **Not us** |
| **3 — Applications** | Products/agents on live miners | Governed/attributable on-chain action is *our* wheelhouse | **Target** |

Cognivern is the **accountability layer for agents** (govern → attribute →
measure → allocate), not the intelligence-supply layer. Track 3 is the one place
where building *our* product and winning a Telegraph track coincide.

---

## 3. Chosen intent

The Supported Intents catalog groups intelligence into four domains. We target
**Track 1 — Financial & On-Chain**, because it has the clearest path from "verified
signal" to "bounded on-chain action", and because Telegraph flags on-chain
pipelines as the highest-value area.

Candidate intents (narrow to **one** primary + one cross-domain backup):

| Intent | Why it fits | Governed action |
| --- | --- | --- |
| `CRYPTO_PRICE` | Clean, high-frequency, easy to threshold on confidence; feeds a rebalance/swap | A rebalance swap triggered by a verified price move |
| `GAS_PRICE` | Low-risk demo; naturally timed to a treasury gas-management run | Hold/relay gas-top-up spend |
| `FINANCIAL_DATA` | Deterministic Tier A (exact-match ground truth); strongest "verified" story | Compliance/treasury data attestation |

**Primary recommendation:** `CRYPTO_PRICE` for the live demo (compelling, numeric,
thresholdable), with `GAS_PRICE` as a fallback if a miner is thin in that intent.

---

## 4. The end-to-end flow (existing primitives → new glue)

The plan is to **reuse the governed-spend pipeline end-to-end** and add a thin
Telegraph consumption layer in front of it. The closest existing reference is the
Sapience rebalance path (`SapienceTradingAgent` → `GovernanceClient.previewSpend`
→ operator approval → `executeSpend` → `OwsWalletService.finalizeApprovedSpend` →
execution provider), and the Cleanverse/KeeperHub rails that already plug
providers into that same path.

```text
[Telegraph Miner]  →  (new) TelegraphMinerClient   // consume ranked reply + confidence
        │
        ▼
[Decision Layer]   →  confidence >= threshold? → proceed; else HOLD
        │
        ▼
[Governance]       →  GovernanceClient.previewSpend({ spend intent + signal metadata })
        │                 status: approved | held | denied
        ▼
[Execution]        →  GovernanceClient.executeSpend → OwsWalletService
                           → executionProvider: local | keeperhub | cleanverse
        ▼
[Evidence]         →  CRE run + audit trail + artifacts + on-chain tx hash
```

### 4.1 New glue (small, isolated)

1. **`TelegraphMinerClient`** (backend service, `src/backend/services/telegraph/`)
   — a thin client over Telegraph's intent/Miner API: pick the top-ranked Miner for
   our intent, call it with the request, return `{ value, confidence, minerId,
   intent }`. **This is the only genuinely new code.**
2. **New CRE artifact type** — `telegraph.signal` (add to the `CreArtifact` type
   union in `src/backend/cre/types.ts`) to store the raw Miner reply + confidence
   + minerId, so the signal that justified the action is verifiable.
3. **A small orchestration script** (mirrors
   `tooling/scripts/demo/run-keeperhub-rebalance.ts`) that drives the flow:
   signal → threshold → preview → (operator confirm) → execute → evidence.
4. **(Optional) a UI surface** reusing the existing capital/governance components
   (e.g. a `/telegraph` page mirroring `/verified-capital`) so the demo is
   walkable by judges without reading code.

### 4.2 Existing primitives reused as-is

| Concern | Existing implementation | Notes |
| --- | --- | --- |
| Policy evaluation | `GovernanceClient.previewSpend` → `OwsWalletService.executeSpend` → `PolicyEnforcementService` (+ confidential FHE/Flare paths) | Whole governed path reused |
| Wallet + execution providers | `OwsWalletService.finalizeApprovedSpend` routes by `metadata.executionProvider`: `local`, `keeperhub`, `cleanverse` | Pick per demo chain (§5) |
| Evidence / audit | `CreRunRecorder` + `creRunStore` + `AuditLogService`; `cre/types.ts` artifact/evidence model | Add one artifact type (§4.1) |
| Mandate/attribution | `FundedMandateService`, `SpendAttributionService`, `StatementService`, `AllocationRecommendationService` | Optional but strong for judges |
| Hold/operator gate | `paused_for_approval` CRE runs; `/api/cre/runs/:runId/approval` | Use for the confidence-threshold demo |

---

## 5. Demo chains / execution provider

- Default the demo through the **existing `keeperhub` provider on Arbitrum Sepolia**
  (already proven live with `executionId xq65c4bkaqoue6ybzm83f`) or the
  **Cleanverse Access USDC rail on Monad testnet (10143)** — both are already
  wired and battle-tested in this repo.
- Never create probe rounds against live Canton DevNet (no cancel path) and do not
  disturb the Cleanverse/Monad or Flare demo-critical paths.
---

## 6. Confidence threshold + routing behavior (what judges reward)

Telegraph explicitly rewards understanding of confidence thresholds and routing.
Make the threshold **first-class** in the app:

- If the Miner's confidence is below the intent threshold → the action is **held**
  (CRE `paused_for_approval`) and surfaces to an operator — a concrete
  demonstration that unverified/low-confidence signals do **not** move money.
- Store the threshold decision on the run/artifact so it's auditable and can be
  explained to a judge.

This is the crux of the demo: **"Trust the ranked Miner, but let a governed control
plane decide whether the action is worth capital."**

---

## 7. Deliverables & judging fit

Telegraph Track 3 judging criteria (from the rules page):
- **Users acquired & activity** — keep the governed-action path live and reusable.
- **Usage & adoption** — a public `/telegraph` demo path + the orchestration script.
- **Creativity & usefulness** — verified-intelligence→governed-on-chain-action.
- **Must use real Telegraph miners** — **non-negotiable**: the demo must call a live
  Miner; no mocked data.
- **Engagement on posts showcasing the project** — post on X tagged
  `@Telegraphprotoc` (all updates "properly tagged").

Plus the broader guardrails: miners we use must remain live through Track 3, and
any intent we target needs ≥3 active Miners + ≥100 real Track 3 requests to be
eligible for global prizes.

---

## 8. Risks & honest caveats

- **Ecosystem dependency.** Track 3 needs real Miners to exist in our intent and to
  stay live. We don't control supply; we pick the best-ranked miner programmatically.
- **Prize is modest** ($2K top app). Strategic value (a verified-consumption rail)
  outweighs the direct cash for us.
- **Time boxed.** Only ~7 days (Aug 31–Sep 7). Keep it to a script + one UI page +
  a new artifact type; do **not** add new execution rails or re-platform anything.
- **100-request eligibility floor** is per intent; our app contributes to it but
  reaching it depends on the ecosystem too.

---

## 9. Decision & next steps

**Decision: pursue Track 3 only**, gated on (a) a live `CRYPTO_PRICE`/`GAS_PRICE`
Miner existing by Aug 31, and (b) Flare + Cleanverse + Canton remaining un-regressed.

Checklist before committing build hours:
- [ ] Confirm Telegraph Miner API + supported-intent call shape (fetch docs when Tracks open).
- [ ] Land `TelegraphMinerClient` + `telegraph.signal` artifact type behind a feature flag.
- [ ] Wire one end-to-end script on the **keeperhub (Arbitrum Sepolia)** rail; no new execution code.
- [ ] One public demo page + one X post tagged `@Telegraphprotoc`.
- [ ] Verify (do not create) live Canton/DevNet + Cleanverse/Monad + Flare state unchanged.

---

## 10. Related docs

- [Agentic capital thesis](./AGENTIC_CAPITAL_THESIS.md) — govern → attribute → measure → allocate
- [KeeperHub submission](./HACKATHON_SUBMISSION_KEEPERHUB.md) — the governed rebalance path we reuse
- [Cleanverse submission](./HACKATHON_SUBMISSION_CLEANVERSE.md) — provider-on-spend-rail pattern
- [Developer Guide](./DEV.md) — API reference, spend path, execution providers