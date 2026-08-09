# Flare Summer Signal — Cognivern Submission Working Doc

**Hackathon:** Flare Summer Signal (DoraHacks) · open online · Aug 14 23:59 UTC deadline
**Target bounty:** Bounty 2 — **Confidential Compute Apps** (primary). Bounty 1 (Interoperable Asset Products) is a stretch/secondary.
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.persidian.com](https://cognivern.persidian.com) · API `api.cognivern.persidian.com`
**Window:** last 5 days (Aug 9 → Aug 14, 23:59 UTC). Existing-project submission.

---

## Current status (Aug 9) — priorities

- **Cleanverse (Trusted Assets, Monad)** — submission is **due today Aug 9 ~23:59 UTC (a few hours)**. Finish/ship first; Flare must not block it.
- **HackCanton S2 (Canton DevNet)** — **now over**. The DevNet sealed-bid backend stays live, but the next HackCanton application is planned for **September**. Keep Canton working; do not gate Flare work on it.
- **Flare Summer Signal (this doc)** — **now a top priority, additive**. Target Bounty 2 (Confidential Compute). Must be delivered without regressing the live Cleanverse rail or the Canton DevNet path.
- **Order of work TODAY:** ① submit Cleanverse → ② begin Flare Day 0/1.

> Guardrail: Cleanverse/Monad and Canton/DevNet remain **live** — do not re-platform or touch their demo-critical paths. Flare work is **additive and isolated**: new `contracts/flare/`, new adapters, and a feature-flagged evaluator so default behavior is unchanged.

---

## Why this bounty fits (one paragraph for judges)

Cognivern is the economic control plane for agentic work. It already ships **confidential policy evaluation** — encrypted budgets and spend counters with approve/hold/deny decisions evaluated privately, currently on Fhenix CoFHE — and **confidential vendor selection** (sealed-bid). Flare Confidential Compute (Opaque Gateway / confidential ERC-20) is a different, TEE-based confidential layer. For this hackathon we **port the confidential spend-policy paradigm onto Flare**, so a mandate's budget and spend counters stay private even from the operator, with policy decided inside the Opaque Gateway. This is a real port of existing product logic onto Flare Confidential Compute — not a superficial integration.

### Technical framing (be precise, do not overclaim)
Fhenix uses **Fully Homomorphic Encryption** (FHE over `euint*`). Flare Confidential Compute uses **secure-enclave confidentiality** (Opaque Gateway gates reads to confined contracts; rolling-secret encryption like confidential ERC-20). We frame the work as **"porting our confidential-policy paradigm (encrypted budget + private spend counter + private approve/hold/deny) to Flare's TEE-based confidential compute"** — a mechanism change, same product guarantee.

---

## Product slice for this submission

**Flare Confidential Spend Policy (CSP-Flare)**
- Configure a mandate with a **budget** and per-vendor/per-category **spend counters** that are kept *confidential* (not readable on-chain by Cognivern or third parties).
- A spend request is evaluated against the confidential budget/counters **inside Flare's Opaque Gateway**; result is an `approve` / `hold` / `deny` decision emitted to the CRE/run ledger.
- Reuses the existing SpendEvaluated → GovernanceContract style dispatch already in the codebase (see Fhenix waves) so the backend integration pattern is proven.

**Stretch (only if time, still Bounty 2):** mirror `SealedBidVendorSelection.sol` — sealed-bid vendor selection where bid amounts are confidential on Flare. If included, frame it as "confidential vendor selection, now TEE-verifiable," distinct from the live Canton path (which stays the primary, atomic-reveal backend).

---

## What is "new work" vs "already existed" (judges will check this explicitly)

| Layer | Existed before | Newly built / ported for Flare |
| ----- | -------------- | ------------------------------ |
| Contract | `contracts/fhenix/src/ConfidentialSpendPolicy.sol` (FHE) | `contracts/flare/ConfidentialSpendPolicy.sol` using Flare Confidential Compute gate pattern |
| Backend | `FhenixPolicyService.ts`, `FheDecisionWatcher.ts`, spend-eval dispatch | Flare adapter + dispatch branch (`FlareConfidentialPolicyService`) |
| Chain | Fhenix testnets (Sepolia/Arb Sepolia/Base Sepolia) | **Coston2** (and note Songbird/Mainnet path for the writeup) |
| UI/evidence | `/verified-capital` rail status surface | Flare status + evidence on the spend/policy surface |
---

## 5-day execution plan

### Day 0 (today, Aug 9) — Setup + recon
- [ ] Confirm `contracts/fhenix/src/ConfidentialSpendPolicy.sol` compile + tests pass (baseline before port).
  `npx hardhat --config contracts/fhenix/hardhat.config.cjs test`
- [ ] Install/resolve **Flare Confidential Compute** tooling per https://dev.flare.network (Opaque Gateway SDK, `@flarenetwork/confidential-*` packages), pin for Coston2.
- [ ] Add `FLARE_*` env vars to `.env.example` (RPC, gateway URL, deployer key; keep `.env` untouched for live config parity).
- [ ] Create `contracts/flare/` project with its own `hardhat.config.cjs` (mirror the `contracts/fhenix/` layout).
- [ ] **Freeze scope:** one bounty, one confidential contract. Only touch Flare-isolated paths.

### Day 1 — Contract port + backend adapter
- [ ] Write `contracts/flare/ConfidentialSpendPolicy.sol`: map FHE `euint*` budget/counter + `FHE.lte/gt` eval onto the Flare confidential-input / confined-read pattern; keep the `SpendEvaluated` event surface identical so backend dispatch does not change shape.
- [ ] Compile + write a small unit test (mirror `contracts/fhenix/test/ConfidentialSpendPolicy.test.ts`).
- [ ] Backend: `src/backend/services/blockchain/FlareConfidentialPolicyService.ts` (adapter modeled on `FhenixPolicyService.ts`) + a dispatch branch in the spend-eval path, **behind a `confidential.evaluator: "flare"`-style flag** so the live Fhenix/Canton/Monad behavior is unchanged by default.

### Day 2 — Deploy to Coston2 + wire evidence
- [ ] Deploy CSP-Flare to **Coston2** (testnet, low risk), record address + tx in the doc.
- [ ] Wire the decision → `AuditLogService.logEvent` CRE artifact + a `flare.confidential` evidence record (mirror the Cleanverse `cleanverse_apass` artifact pattern).
- [ ] Add a `GET /api/.../confidential/status`-style status surface: connected, Coston2 chain id, contract address, evaluator.

### Day 3 — UI + smoke/acceptance
- [ ] Minimal operator surface (extend the existing spend/policy status route; do **not** touch `/verified-capital` logic) showing Flare evaluator + last confidential decision.
- [ ] Smoke test: `pnpm tsx` fixture/demo script that configures a budget, submits a request, and shows private approve/hold/deny + ledger artifact.
- [ ] Negative-path checks (deny over budget, hold on counter breach) — deterministic in unit tests; live read-only subset against Coston2.

### Day 4 — Verification + submission draft
- [ ] Write `docs/FLARE_SUMMER_SIGNAL.md` submission sections: product description, target user, how it uses Flare, new-vs-existing, **deployed contract address on Coston2**, roadmap.
- [ ] Draft demo video script (mirror Cleanverse outline: status → confidential budget config → private decision → ledger evidence).
- [ ] Full unit/test pass: `pnpm vitest run tests/unit/*Policy* tests/unit/*Spend*`; `pnpm build` (or the repo dev no-fail check).

### Day 5 (Aug 14) — Polish, record, ship
- [ ] Record demo video (≤ a few minutes), capture Coston2 deploy + contract address + public API evidence.
- [ ] Public commits (commits during the window = evidence).
- [ ] Submit via DoraHacks with repo, demo link, this doc, contract address.

---

## Success bar (what "meaningful Flare integration" means for the judges)

1. **Not superficial:** decision logic actually runs through Flare Confidential Compute on a deployed contract, not a placeholder.
2. **Deployed:** a real CSP-Flare address on Coston2, linked in the submission.
3. **New-work ledger:** clear before/after table (above) with public commits in-window.
4. **Path beyond:** Coston2 → Songbird/Flare mainnet, and terrain native to Flare's FAssets thesis (confidential governance for agents moving wrapped assets).

## Files touched (planned)

| Path | Role |
| --- | --- |
| `contracts/flare/ConfidentialSpendPolicy.sol` (+ own hardhat config, test) | Ported confidential policy contract |
| `src/backend/services/blockchain/FlareConfidentialPolicyService.ts` | Backend adapter / dispatch branch |
| `src/backend/services/blockchain/FlareConfidentialStatusService.ts` (or folded into controller) | Status + evidence surface |
| `.env.example` | `FLARE_*` vars (kept inert by default) |
| `docs/FLARE_SUMMER_SIGNAL.md` | This submission doc (finalize Day 4) |
| `docs/HACKATHON_SUBMISSION_CLEANVERSE.md` | Reference guide for submission format (no edit needed) |