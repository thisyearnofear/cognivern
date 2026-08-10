# Flare Summer Signal — Cognivern Submission Working Doc

**Hackathon:** Flare Summer Signal (DoraHacks) · open online · **Aug 14 19:59 UTC** deadline
**Target bounty:** Bounty 2 — **Confidential Compute Apps** (primary). Bounty 1 (Interoperable Asset Products) is a stretch/secondary.
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.persidian.com](https://cognivern.persidian.com) · API `api.cognivern.persidian.com`
**Window:** existing-project submission. ~4 days remaining as of Aug 10.

**Dev materials:** [dev.flare.network](https://dev.flare.network/) · [FCC overview](https://dev.flare.network/fcc/overview) · [Build your first extension](https://dev.flare.network/fcc/guides/getting-started) · [scaffold](https://github.com/flare-foundation/fce-extension-scaffold)

---

## Current status (Aug 10) — priorities

- **Cleanverse (Trusted Assets, Monad)** — prior shipping target; keep live, do not regress.
- **HackCanton S2 (Canton DevNet)** — concluded; DevNet sealed-bid backend stays live. Keep working; do not gate Flare on it.
- **Flare Summer Signal (this doc)** — **active top priority**. Target Bounty 2 (Confidential Compute). Additive only.

### Day 0 progress (Aug 10)

- [x] Recon vs current Flare docs — **corrected framing** (see below).
- [x] Coston2 RPC verified (`chainId 114`, live block production).
- [x] `contracts/flare/` Hardhat project + `ConfidentialSpendPolicy.sol` (FCC InstructionSender).
- [x] Unit tests against mock Tee registries (no Docker required) — 9/9.
- [x] `FLARE_*` env vars in `.env.example`.
- [x] Coston2 `FlareTeeManager` address pinned (`0x1a9C4A0f…`).
- [x] FCC host bootstrap on separate VPS (internal ops) — scaffold cloned, exotic ports, Traefik template.
- [x] Go extension handlers `SPEND_POLICY` / `REGISTER_POLICY` / `EVALUATE_SPEND` (+ unit tests on host).
- [x] Backend stub `FlareConfidentialPolicyService.ts` + `FLARE_EVALUATOR` gate helper.
- [x] Funded Coston2 key + faucet C2FLR (on FCC host `.env`).
- [x] DNS `flare-tee.*` → Traefik route → host `:7667`.
- [x] Pre-build on Coston2: InstructionSender `0x9280232ac471237C3065591c9e7774f175AA1A94`, extension `0x10238`.
- [x] Indexer DB credentials + FCC stack up; TEE **PRODUCTION**; public `/info` live.
- [ ] Smoke REGISTER_POLICY / EVALUATE_SPEND via InstructionSender.
- [x] Wire spend-eval dispatch to Flare when `FLARE_EVALUATOR=flare`.
- [x] Coston2 smoke: REGISTER_POLICY + EVALUATE_SPEND (approve/hold/deny).
- [x] `GET /api/flare/status` + Flare block on `/api/fhenix/status`.
- [ ] Demo video / DoraHacks submission polish.
- [x] Judge surface: **Try confidential spend** on `/governance/check` (+ `?confidential=1`).

> Guardrail: Cleanverse/Monad and Canton/DevNet remain **live** — do not re-platform or touch their demo-critical paths. Flare work is **additive and isolated**: `contracts/flare/`, new adapters, feature-flagged evaluator.

---

## Demo video — conveyor cut (60–90s)

**Differentiator vs research-source conveyors:** cards are **FCC path stages** (not social APIs). One query threads every tile. Payoff is the **on-chain decision brief**, not a markdown blog.

**Open for live B-roll / final click:** `https://cognivern.persidian.com/governance/check?confidential=1`  
**Contact sheet (lock look before motion):** `docs/flare-demo/contact-sheet/index.html`

### The idea
Six cards fly through frame, each mid-work on the same evaluation — *Evaluate spend for agent 0xaa · policy 0x01* — and resolve into the `flare.confidential` brief (contract, extension, outcome, decision id).

| # | Card | Mid-search result (real) |
| --- | --- | --- |
| 1 | Cognivern | intent queued · `$750` · `FLARE_EVALUATOR=flare` |
| 2 | InstructionSender | `EVALUATE_SPEND` · `0x9280…` · ext `0x10238` |
| 3 | ext-proxy | action in flight · `flare-tee.persidian.com` |
| 4 | TEE / FCE | enclave compare · `approval_threshold` forming |
| 5 | Outcomes | `$25 approve` / `$750 hold` / `$2500 deny` |
| 6 | **Payoff brief** | TextEdit-style proof · highlight the outcome line |

**Anatomy (strict):** logo row → task headline (`lead` + ink query) → result rows → harvest counter → ⊕. No poster taglines. No mono fluff.

### Script timed to conveyor (nothing at rest)

| Time | Visual | Voiceover |
| --- | --- | --- |
| **0:00–0:07** | Card 1 morphs in; task line word-stagger | “Agents need budgets that stay private — even from the operator.” |
| **0:07–0:18** | 1 exits upward while 2+3 whip in (overlap; still scaling) | “Cognivern submits the spend. Flare’s InstructionSender and proxy put it on the confidential compute path.” |
| **0:18–0:32** | Card 4 holds the enclave beat; counters still ticking into exit | “Inside the TEE, limits never hit public storage. Only the comparison runs.” |
| **0:32–0:50** | Card 5 — three native results reveal (`approve` / `hold` / `deny`) | “Twenty-five dollars — approve. Seven-fifty — hold for a human. Twenty-five hundred — deny. Same private counters.” |
| **0:50–0:68** | Card 6 lands, slides left on power4.in → **cut at peak speed** into full-screen brief; lines waterfall; blue highlight on outcome | “The payoff isn’t a mockup. It’s the decision brief — contract, extension, outcome — sealed as Flare confidential evidence.” |
| **0:68–0:85** | Optional 1s live UI cut: Try panel click → real decision id | “Same path in the product: Try confidential spend on Coston2.” |
| **0:85–0:90** | End card | “Cognivern × Flare Confidential Compute. Private agent budgets.” |

### End card
```
Cognivern × Flare Summer Signal — Bounty 2
Try: /governance/check?confidential=1
Contract: 0x9280232ac471237C3065591c9e7774f175AA1A94
Extension: 0x10238 · flare-tee.persidian.com
```

### Motion law (three passes — ship pass 3)
1. **Blocking** — morph, hold, exit. Discard; reads dead.
2. **Character** — task words masked, `back.out`, stagger ~0.045s.
3. **Never finish** — grow 1→1.05 into exit; crouch `scaleY` 0.93→1.05 then fire; outgoing `power4.in` / incoming `power4.out` on the same axis; harvest counters still counting when crouch starts. Cut the brief handoff on the **fastest** frame of the slide.

### HyperFrames + screenshots workflow
1. Open `docs/flare-demo/contact-sheet/index.html` → screenshot each `.card` (or full grid).  
2. Iterate stills until anatomy is locked (reject conceptual poster cards).  
3. Compose conveyor in HyperFrames from those stills; drive any shader/dot field off **timeline time**, not `requestAnimationFrame`.  
4. Optional last 5s: screen-record the live Try panel for proof-of-life.

### Recording tips
- One query only — never change agent/policy mid-film.  
- Don’t tour Canton/Cleanverse in this clip.  
- If enclave latency shows in live B-roll, VO covers it while motion continues — never a resting spinner card.

---

## Corrected FCC framing (read this)

Earlier drafts mentioned "Opaque Gateway / confidential ERC-20". **That is not the current FCC product surface.**

Per [dev.flare.network/fcc/overview](https://dev.flare.network/fcc/overview) (Aug 2026):

- **Flare Confidential Compute (FCC)** = TEE infrastructure on Flare.
- Apps are **Flare Compute Extensions (FCE)** — Go HTTP handlers in a confidential VM, reached via on-chain `InstructionSender` → `TeeExtensionRegistry.sendInstructions` → data-provider relay → `ext-proxy` → TEE.
- On Coston2, `ITeeExtensionRegistry` and `ITeeMachineRegistry` are both the **FlareTeeManager** diamond: `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`.
- FCC is still pre-full-public-production; building FCE on Coston2 with simulated TEE is the documented path.

### Technical framing for judges (be precise, do not overclaim)

Fhenix uses **Fully Homomorphic Encryption** (`euint*`). Flare FCC uses **secure-enclave confidentiality** (TEE-private state + attested code). We frame the work as:

> **Porting our confidential-policy paradigm (private budget + private spend counter + private approve/hold/deny) to Flare's TEE-based confidential compute** — mechanism change, same product guarantee.

Budget/counter state lives **inside the TEE**, not in public contract storage. Evaluation runs in the enclave; only the decision is published on-chain via `publishDecision`. Initial `REGISTER_POLICY` payloads are relayed once through FCC instructions; thereafter limits and counters are enclave state.

---

## Why this bounty fits (one paragraph for judges)

Cognivern is the economic control plane for agentic work. It already ships **confidential policy evaluation** — encrypted budgets and spend counters with approve/hold/deny decisions evaluated privately, currently on Fhenix CoFHE — and **confidential vendor selection** (sealed-bid). For this hackathon we **port the confidential spend-policy paradigm onto Flare Confidential Compute**, so a mandate's budget and spend counters stay private even from the operator, with policy decided inside a Flare Compute Extension. This is a real port of existing product logic onto FCC — not a superficial integration.

---

## Product slice for this submission

**Flare Confidential Spend Policy (CSP-Flare)**

- Configure a mandate with a **budget** and per-agent **spend counters** held as TEE-private state.
- A spend request is evaluated **inside the Flare Compute Extension**; result is `approve` / `hold` / `deny`, published on-chain and emitted to the CRE/run ledger.
- Reuses the existing `SpendEvaluated` event surface so backend dispatch stays isomorphic (feature-flagged `FLARE_EVALUATOR=flare`).

**Stretch (only if time, still Bounty 2):** sealed-bid vendor selection as a second OPType. Frame as "confidential vendor selection, now TEE-verifiable," distinct from the live Canton path.

---

## What is "new work" vs "already existed"

| Layer | Existed before | Newly built / ported for Flare |
| ----- | -------------- | ------------------------------ |
| Contract | `contracts/fhenix/.../ConfidentialSpendPolicy.sol` (FHE) | `contracts/flare/src/ConfidentialSpendPolicy.sol` (FCC InstructionSender) |
| Compute | CoFHE threshold decrypt | FCE Go extension (`SPEND_POLICY` / `REGISTER_POLICY` / `EVALUATE_SPEND`) |
| Backend | `FhenixPolicyService.ts`, `FheDecisionWatcher.ts` | `FlareConfidentialPolicyService` + `confidential.evaluator: "flare"` flag |
| Chain | Fhenix-enabled Sepolia nets | **Coston2** (chain 114) |
| UI/evidence | `/verified-capital` + Fhenix status | Flare status + `flare.confidential` CRE artifact |

---

## 5-day execution plan (revised for real FCC)

### Day 0 (Aug 10) — Setup + recon ✅ in progress

- [x] Confirm FCC model from official docs (FCE, not Opaque Gateway).
- [x] Create `contracts/flare/` Hardhat project + Coston2 config.
- [x] Write InstructionSender-shaped `ConfidentialSpendPolicy.sol` + mock unit tests.
- [x] Add `FLARE_*` to `.env.example`.
- [ ] Install Docker Desktop (blocker for live TEE).
- [ ] Fund Coston2 wallet via faucet.

### Day 1 — Extension handlers + backend adapter

- [ ] Clone `fce-extension-scaffold`; customize Go OPType/OPCommand to match the Solidity constants.
- [ ] Implement TEE handlers: `REGISTER_POLICY` (store limits+counters), `EVALUATE_SPEND` (approve/hold/deny).
- [x] Backend: `FlareConfidentialPolicyService.ts` + feature-flagged dispatch branch.

### Day 2 — Deploy to Coston2 + wire evidence

- [ ] Deploy InstructionSender, register extension, allow TEE version, start proxy+tunnel.
- [ ] Record address + extension id in this doc.
- [x] Wire decision → `AuditLogService` CRE artifact `flare.confidential`.
- [x] `GET /api/flare/status` — connected, chain 114, contract, evaluator.
- [x] Minimal operator surface (policies / audit / settings / governance) — rail-aware, product-first copy.

### Day 3 — UI + smoke/acceptance

- [x] Minimal operator surface (do **not** touch `/verified-capital` logic).
- [ ] Smoke script: register budget → evaluate → publish → ledger artifact.
- [ ] Negative paths: deny over budget, hold on threshold.

### Day 4 — Verification + submission draft

- [ ] Finalize this doc's submission sections + Coston2 address.
- [ ] Demo video script.
- [ ] Unit/test pass + `pnpm build`.

### Day 5 (Aug 14) — Polish, record, ship

- [ ] Demo video, public commits, DoraHacks submit.

---

## Success bar

1. **Not superficial:** decision logic runs through an FCC extension on a deployed Coston2 InstructionSender — not a placeholder.
2. **Deployed:** CSP-Flare address + extension id on Coston2, linked in the submission.
3. **New-work ledger:** clear before/after table with public commits in-window.
4. **Path beyond:** Coston2 → Songbird/Flare mainnet; confidential governance for agents moving FAssets.

## Files touched

| Path | Role |
| --- | --- |
| `contracts/flare/src/ConfidentialSpendPolicy.sol` | FCC InstructionSender |
| `contracts/flare/hardhat.config.cjs` / `test/` / `README.md` | Compile + unit tests |
| `contracts/flare/config/coston2/deployed-addresses.json` | FlareTeeManager pin |
| `.env.example` | `FLARE_*` vars (inert by default) |
| `docs/FLARE_SUMMER_SIGNAL.md` | This submission doc |
| `src/backend/services/blockchain/FlareConfidentialPolicyService.ts` | Backend adapter (Day 1) |
