# Arbitrum London Founder House — Cognivern Submission

**Hackathon:** Arbitrum Open House London (Encode Hub, Shoreditch, London UK)
**Host:** Arbitrum Foundation · **Mode:** Hybrid · **Ecosystem:** Arbitrum
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.vercel.app](https://cognivern.vercel.app) · API: `cognivern.thisyearnofear.com`
**Primary tracks:** Best Agentic Project · Open House London: Champions · Robinhood Chain tracks

---

## Eligibility — Deployed on Arbitrum

All contracts are deployed and verified live on **Arbitrum Sepolia (chain 421614)**.

| Contract | Address | Arbiscan | Status |
|----------|---------|----------|--------|
| **ConfidentialSpendPolicy** (FHE) | `0x710005F7454B8756F7E1118B26d1361b001fc818` | [link](https://sepolia.arbiscan.io/address/0x710005F7454B8756F7E1118B26d1361b001fc818) | ✅ **Live — CoFHE end-to-end verified** (encrypt → on-chain `evaluateSpend` tx `0x47b16e88…` → `SpendEvaluated`; 14,240 bytes) |
| **GovernanceContract** | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | [link](https://sepolia.arbiscan.io/address/0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE) | ✅ Code verified on-chain (38,712 bytes) |
| **GovernedVault** | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | [link](https://sepolia.arbiscan.io/address/0x468F1CfBB5bec9352b279192a952916610f58BB4) | ✅ Code verified on-chain (7,532 bytes) |
| **SealedBidVendorSelection** (FHE) | Deployed alongside ConfidentialSpendPolicy | — | ✅ Compiled & deployable via `pnpm deploy:fhenix` |

**Deployer:** `0x5912d140b58c62ff007D803D25ea7CcC818548D3` (owns all contracts)

**Manifest:** `scripts/deploy-bundle/arbitrum-sepolia-deployment.json` and
`docs/arbitrum-sepolia-deployment.json` record the same addresses listed above
(owner `0x5912…548D3` confirmed on-chain via `owner()`).

**Robinhood Chain Testnet (chain 46630):** ✅ **Deployed and verified live.**
- GovernanceContract: `0x723e444ee6D7da19fADe372f85DA06dD849bF1E0`
- GovernedVault: `0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE`

See the Robinhood Chain Deployment section below for full details.

**How to verify on-chain right now:**
```bash
node -e "const {ethers}=require('ethers'); (async()=>{
  const p=new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
  for(const [n,a] of [['Gov','0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE'],['Vault','0x468F1CfBB5bec9352b279192a952916610f58BB4'],['FHE','0x710005F7454B8756F7E1118B26d1361b001fc818']]) {
    const c=await p.getCode(a); console.log(n+': '+(c==='0x'?'NOT DEPLOYED':'LIVE ('+c.length+' bytes)'));
  }})()"
```

---

## The Problem

AI agents are now spending real money autonomously — paying for API credits,
executing trades, procuring services, interacting with DeFi protocols. But there
is no consistent way to **see, simulate, approve, and audit** what agents spend.

Today's reality:
- An agent with a wallet key can drain the entire balance in one call.
- Budgets and spend limits live in plaintext — visible to anyone with RPC access.
- There is no audit trail that a regulator, compliance team, or customer would accept.
- Agent frameworks (LangChain, AutoGen, CrewAI) have no built-in spend governance.

The gap is not "can agents spend?" — it's **"can humans govern what agents spend?"**

---

## The Solution — Cognivern

**Cognivern is a spend-governance control plane for AI agent wallets.**

Every agent spend request flows through a policy evaluation layer before any
transaction is signed:

```
Agent intends spend
  → Cognivern evaluates against policy (budget, vendor, chain, risk)
  → Decision: APPROVE / HOLD / DENY
  → [on APPROVE] signing provider dispatches (Ledger / local / remote)
  → Audit log persisted + anchored to Filecoin + 0G
  → [optional] cross-chain execution via Hyperlane
```

**Three evaluation modes:**
1. **Standard rules** — plaintext budget/vendor/chain checks (fast, local)
2. **Confidential rules** — FHE-encrypted policy evaluation on Arbitrum Sepolia
   via Fhenix/CoFHE. Budgets and spend counters stay encrypted end-to-end.
3. **Contract audit rules** — ChainGPT / 0G Compute Network audits the target
   smart contract before allowing spend (catches malicious contracts)

**The agentic layer:**
A Gemini 3.1-powered agent runtime enforces a strict multi-step protocol:
**PLAN → EVIDENCE → PREVIEW → CONFIRM → EXECUTE → AUDIT**
- The agent reasons about the spend goal, gathers evidence (vendor reputation,
  contract audit, policy constraints), previews the decision, asks the human to
  confirm, then executes and records the audit trail.
- Human-in-the-loop is enforced before any real spend.
- MongoDB MCP server provides persistent agent memory, audit history, and
  vendor reputation across sessions.

---

## Architecture on Arbitrum

```
                         Arbitrum Sepolia (chain 421614)
                         ┌─────────────────────────────────────┐
  Agent spend request ──▶│  ConfidentialSpendPolicy (FHE)      │
                         │  • encrypted dailyLimit / perTxLimit│
                         │  • encrypted spentToday counter      │
                         │  • FHE.lte / FHE.gt evaluation       │
                         │  • emits SpendEvaluated              │
                         │  • manager-decrypt-and-publish       │
                         │    (CoFHE decryptForView + permit)   │
                         └──────────┬──────────────────────────┘
                                    │ Hyperlane dispatch
                                    ▼
                         ┌─────────────────────────────────────┐
                         │  GovernanceContract                 │
                         │  • receives cross-chain outcome      │
                         │  • bool approved = (outcome == 2)    │
                         │  • records GovernanceAction           │
                         │  • policy/agent/action CRUD           │
                         └──────────┬──────────────────────────┘
                                    │
                         ┌──────────▼──────────────────────────┐
                         │  GovernedVault                       │
                         │  • executes approved DeFi calls       │
                         │  • mailbox-only entry point           │
                         │  • target/value/data execution        │
                         └─────────────────────────────────────┘

  Off-chain services:
  • Cognivern API (Express) — policy evaluation, audit, agent runtime
  • FhenixPolicyService — CoFHE SDK integration, encrypt/decrypt
  • AuditLogService — Filecoin + 0G dual-anchor evidence
  • Gemini 3.1 agent — PLAN→EVIDENCE→PREVIEW→CONFIRM→EXECUTE→AUDIT
  • Ledger DMK — hardware signing for high-value txs
```

**Why Arbitrum? (onchain is necessary, not decorative)**
- Fhenix (CoFHE) runs on Arbitrum Sepolia — the FHE coprocessor is native to
  the Arbitrum ecosystem, making encrypted spend policy evaluation possible
  without a separate privacy chain. **What breaks without onchain:** the policy
  decision is just a backend assertion (not provable to auditors), budgets are
  visible to anyone with RPC access (not encrypted), and there's no
  non-repudiable audit trail.
- Hyperlane connects the FHE evaluation layer to the governance/execution
  contracts, all within the Arbitrum ecosystem. The verifiability +
  programmability + transparency properties are all load-bearing.
- Low fees + fast finality make per-spend policy evaluation economically viable
  — a $0.001 evaluation guarding a $500 spend. This is cost reduction (removing
  counterparty risk of an off-chain policy engine) and significant improvement
  (cryptographic proof of compliance that doesn't exist off-chain).

---

## Smart Contracts

### 1. ConfidentialSpendPolicy (Arbitrum Sepolia — FHE)
**Address:** `0x710005F7454B8756F7E1118B26d1361b001fc818` · 644 lines · Solidity 0.8.24

The core innovation. Holds encrypted budgets (`euint128 dailyLimit`,
`perTxLimit`, `approvalThreshold`) and encrypted spend counters
(`euint128 spentToday`) per agent. Incoming spend amounts are evaluated under
FHE — the contract never sees plaintext budgets or spend amounts.

**Key functions:**
- `evaluateSpend(agentId, policyId, encryptedAmount, vendorHash)` — FHE budget
  check, emits `SpendEvaluated`, creates `PendingDecision`
- `publishSpendResult(decisionId, plaintext)` — manager-decrypt-and-publish
  via CoFHE `decryptForView`; identity-gated (`msg.sender == pending.submitter`)
- `requestDeFiAction` / `publishDeFiAction` — DeFi spend path with
  Approve-gated cross-chain dispatch
- `resolveDecision(decisionId, outcome)` — legacy operator fallback

**Security model (Option B — manager-decrypt-and-publish):**
- The CoFHE permit, the `FHE.allowTransient` ACL grant, and the on-chain
  `msg.sender` identity check form a triple-binding that closes the
  impersonation gap without threshold decryption.
- Upgrade path: when `@fhenixprotocol/cofhe-contracts` ships
  `FHE.verifyDecryptResult`, the `publishWinner`/`publishSpendResult` functions
  can cryptographically verify each decrypted plaintext — the ABI is already
  shaped for this (non-breaking upgrade).

### 2. SealedBidVendorSelection (Arbitrum Sepolia — FHE)
271 lines · Solidity 0.8.24

Sealed-bid vendor selection using FHE-encrypted `euint128` bid amounts. Agents
submit encrypted bids → manager closes round → winner revealed via
manager-decrypt-and-publish. Bid amounts stay encrypted forever.

> **Companion implementation:** Cognivern also ships a structurally-private
> sealed-bid primitive on Canton Network (Daml) where privacy comes from the
> ledger's signatory/observer disclosure model rather than cryptography — see
> [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md) and
> [docs/CANTON.md](./docs/CANTON.md). The FHE contract here and the Daml model
> are two independent implementations of the same vendor-selection primitive,
> each showcasing a different privacy approach on its native ecosystem.

### 3. GovernanceContract (Arbitrum Sepolia)
**Address:** `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` · 414 lines · Solidity 0.8.19

Hyperlane `IMessageRecipient` that receives cross-chain policy outcomes from
the FHE layer. Records `GovernanceAction` (approved/denied) per agent + policy.
Full policy/agent/action CRUD with `onlyOwner` / `onlyAuthorizedEvaluator`
access control and `whenNotPaused` emergency halt.

### 4. GovernedVault (Arbitrum Sepolia)
**Address:** `0x468F1CfBB5bec9352b279192a952916610f58BB4` · 80 lines · Solidity 0.8.19

DeFi execution vault. Only executes calls authorized by the remote FHE policy
via Hyperlane. Security: `msg.sender == mailbox`, origin domain check, sender
check, self-call prevention.

### 5. AIGovernanceStorage (Filecoin FVM)
342 lines · Solidity 0.8.19

Immutable audit-record anchoring for AI agent governance data. Stores
`GovernanceRecord`, `PolicyViolation`, `AgentInfo` with IPFS/Filecoin CID
references for detailed evidence.

---

## Agentic Capabilities (Best Agentic Project track)

Cognivern is fundamentally an **agent governance** project — the entire platform
exists to make autonomous agent spending safe and auditable.

### The Cognivern Copilot Agent

A Gemini 3.1-powered agent runtime (`agent/agent.ts`) that enforces a strict
multi-step protocol before any spend:

| Step | What happens | Why it matters |
|------|-------------|----------------|
| **PLAN** | Agent reasons about the spend goal | Prevents reflexive spending |
| **EVIDENCE** | Gathers vendor reputation (MongoDB), contract audit (ChainGPT/0G), policy constraints | Decisions are evidence-based |
| **PREVIEW** | Calls Cognivern API to preview the policy decision | Shows approve/hold/deny before execution |
| **CONFIRM** | Human-in-the-loop approval gate | No autonomous spend without human sign-off |
| **EXECUTE** | Signing provider dispatches (Ledger/local/remote) | Hardware-grade signing for high-value |
| **AUDIT** | Decision + evidence persisted to audit log + Filecoin/0G | Non-repudiable compliance trail |

**Agent stack:** Gemini 3.1 (`gemini-3.1-pro-preview`) + Google Cloud Agent
Builder + MongoDB MCP server (memory/audit/vendor reputation) + Cognivern
governance API (OpenAPI tool for policy evaluation).

**AI Safety Monitoring:** A 4-dimension suspicion scoring system
(rule violations 2x, behavioral, temporal, scope creep) with composite score
(0–1), labels (normal/elevated/high/critical), and evidence persisted to the CRE
run ledger. See `scripts/hackathon/HACKATHON_REPORT.md`.

---

## Innovation & Creativity

| Innovation | What's new |
|-----------|-----------|
| **FHE spend governance on Arbitrum** | Budgets and spend counters stay encrypted on-chain via CoFHE. No existing project does confidential agent spend policy evaluation on Arbitrum. |
| **Manager-decrypt-and-publish trust model** | Eliminates threshold decryption via a triple-binding: CoFHE permit + FHE.allowTransient ACL + msg.sender identity. |
| **Cross-chain governance dispatch** | FHE evaluation on Arbitrum Sepolia → Hyperlane → execution vault, all within Arbitrum. |
| **Sealed-bid vendor selection with FHE** | Agents submit encrypted bids; winner revealed without decrypting losing bids. |
| **Agent + on-chain governance integration** | The Gemini agent's PLAN→EXECUTE→AUDIT protocol is backed by real on-chain policy enforcement. |

---

## Judging Criteria Mapping

| Criterion | How Cognivern scores |
|-----------|---------------------|
| **Smart contract quality** | 5 contracts (~1,751 lines), OpenZeppelin, access control (onlyOwner, onlyAuthorizedEvaluator, whenNotPaused), Hyperlane security (mailbox/domain/sender verification), NatSpec, 30 test files. |
| **Product-Market Fit** | AI agent spending is a fast-growing problem with no governance standard. Live product with real users. |
| **Innovation & Creativity** | FHE-encrypted spend policies + cross-chain governance + sealed-bid + AI safety scoring. Genuinely novel on Arbitrum. |
| **Real Problem Solving** | Non-repudiable evidence trail, dual-anchor (Filecoin + 0G), hardware signing. The PLAN→AUDIT protocol is practical for compliance. |
| **Pitch quality** | Live demo, pitch deck, 3-min video. Clear problem → solution → architecture → demo flow. |
| **Product & GTM Canvas** | ✅ Pre-filled following the Open House London templates — see [docs/PRODUCT_GTM_CANVAS.md](./docs/PRODUCT_GTM_CANVAS.md). Product Canvas (wedge, why-now, alternatives, why-onchain, first 5–10 users) + GTM Canvas (who buys/uses, 3 distribution channels, core message, proof needed, 5 named targets, ask this weekend) + GTM four-questions diagnosis + anti-pattern check. Ready to walk a mentor through. |

---

## Prize Track Fit

| Track | Prize | Fit | Why |
|-------|-------|-----|-----|
| **Best Agentic Project** | $20k (1st: $10k) | ★★★★★ | The entire project IS agent governance. Gemini 3.1 agent + MongoDB MCP + multi-step protocol + on-chain policy enforcement. Deployed on Arbitrum Sepolia. |
| **Open House London: Champions** | $120k | ★★★★☆ | Strong innovation (FHE on Arbitrum), solid smart contracts, real problem. One prize reserved for Arbitrum builder. |
| **Robinhood Chain: Founder-in-Residence** | $60k | ★★★★☆ | Real startup concept, not a toy. Capital + mentorship for a founding team. |
| **Robinhood Chain: Innovation Award** | $30k | ★★★☆☆ | Open brief — FHE + agent governance is innovative infrastructure. |
| **Open House London: Grants** | $70k | ★★★★☆ | Case-by-case milestone-based grants for Arbitrum-deployed projects. |

---

## Robinhood Chain Deployment

**Status:** ✅ **Deployed and verified live on Robinhood Chain Testnet (chain 46630).**

| Contract | Address | Explorer | Status |
|----------|---------|----------|--------|
| **GovernanceContract** | `0x723e444ee6D7da19fADe372f85DA06dD849bF1E0` | [link](https://explorer.testnet.chain.robinhood.com/address/0x723e444ee6D7da19fADe372f85DA06dD849bF1E0) | ✅ Live (38,712 bytes) |
| **GovernedVault** | `0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE` | [link](https://explorer.testnet.chain.robinhood.com/address/0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE) | ✅ Live (7,532 bytes) |

**Deployer:** `0x5912d140b58c62ff007D803D25ea7CcC818548D3` (owns both contracts)
**Deployed at:** 2026-07-12T10:16:41Z · Manifest: `docs/robinhood-chain-deployment.json`

**How to verify on-chain right now:**
```bash
node -e "const {ethers}=require('ethers'); (async()=>{
  const p=new ethers.JsonRpcProvider('https://rpc.testnet.chain.robinhood.com');
  for(const [n,a] of [['Gov','0x723e444ee6D7da19fADe372f85DA06dD849bF1E0'],['Vault','0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE']]) {
    const c=await p.getCode(a); console.log(n+': '+(c==='0x'?'NOT DEPLOYED':'LIVE ('+c.length+' bytes)'));
  }})()"
```

This unlocks the **Robinhood Chain: Founder-in-Residence ($60k)** and
**Robinhood Chain: Innovation Award ($30k)** tracks, plus the reserved
Robinhood Chain prizes in **Open House London: Champions** and
**Best Agentic Project**.

### Why Robinhood Chain — chain-native integration (roadmap)

Today the same GovernanceContract + GovernedVault run on Robinhood Chain and
Arbitrum. The chain-native next steps that make Robinhood Chain the *right* home
for the agent-wallet layer:

- **Account abstraction (ERC-4337) as the enforcing wallet layer.** Robinhood
  Chain ships first-class AA (Alchemy + ZeroDev + native paymaster). Cognivern's
  policy check becomes an on-chain **validator / session-key authority**, turning
  today's *advisory* API governance (deny → audit-flag) into *non-custodial
  enforcement* (deny → the userOp is rejected on-chain) — without taking custody
  of agent funds. Gas-sponsored, session-scoped spend authority (e.g. "≤ $500 to
  this vendor for the next 24h") is a native AA primitive that complements the
  FHE policy layer.
- **Governed tokenized-RWA trading.** Robinhood Chain's stock tokens (equities /
  ETFs as ERC-20s with Chainlink price feeds) let a Cognivern-governed agent run
  a tokenized-equity portfolio under enforced position limits and daily loss
  caps, reading `AggregatorV3Interface.latestRoundData()` inside policy
  evaluation.

> ERC-4337 is chain-agnostic; Robinhood Chain's advantage is that AA is
> native/bundled, making it the natural home for the enforcing wallet layer —
> not that it runs only here.

---

## Testing & Quality

| Suite | Count | Coverage |
|-------|-------|----------|
| Vitest unit/integration | 31+ | auth, health, metrics, Fhenix FHE, intent, sealed-bid, MCP governance, wallets, audit, spend |
| TestSprite CLI (live API) | 21 | Runs against `cognivern.thisyearnofear.com` |
| Hardhat contract tests | 2 files | ConfidentialSpendPolicy + GovernanceContract |
| Playwright E2E | configured | Frontend sealed-bid flow |

CI: `.github/workflows/testsprite.yml` runs on every PR/push.

---

## Live Product & Links

| Resource | Link |
|----------|------|
| Frontend | https://cognivern.vercel.app |
| PromptOS Terminal | https://cognivern.vercel.app/os |
| Public API | https://cognivern.thisyearnofear.com |
| Repository | [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern) |
| Architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Agent runtime | [agent/README.md](./agent/README.md) |
| Product & GTM Canvas | [docs/PRODUCT_GTM_CANVAS.md](./docs/PRODUCT_GTM_CANVAS.md) |
| Deployment manifest (Arbitrum) | `docs/arbitrum-sepolia-deployment.json` |
| Deployment manifest (Robinhood) | `docs/robinhood-chain-deployment.json` |
| Canton submission (companion) | [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md) |
| Canton docs | [docs/CANTON.md](./docs/CANTON.md) |

---

## Platform context — multi-ecosystem

Cognivern is a single platform with primitives deployed across multiple
ecosystems. This submission focuses on the **Arbitrum footprint** (FHE spend
governance on Arbitrum Sepolia, governance + vault contracts on Arbitrum
Sepolia and Robinhood Chain, agent runtime). A companion submission to
HackCanton S2 focuses on the **Canton Network footprint** (structurally-private
sealed-bid vendor selection via Daml's signatory/observer disclosure model,
deployed on Canton DevNet).

| Primitive | Arbitrum implementation | Canton implementation |
|-----------|------------------------|----------------------|
| Sealed-bid vendor selection | FHE-encrypted `euint128` bids on Arbitrum Sepolia (`SealedBidVendorSelection.sol`) | Daml `SealedBidAuction` / `Bid` / `AuctionResult` templates on Canton DevNet |
| Spend policy evaluation | FHE on Arbitrum Sepolia via Fhenix/CoFHE (`ConfidentialSpendPolicy.sol`) | N/A (Canton focuses on the sealed-bid primitive) |
| Governance + execution | `GovernanceContract` + `GovernedVault` on Arbitrum Sepolia + Robinhood Chain | N/A |

The two submissions are complementary, not competing — they showcase different
privacy approaches (FHE vs. structural disclosure) on their native ecosystems,
both built on the same Cognivern control plane.

---

## Roadmap & GTM

**Now:** Live on Arbitrum Sepolia with FHE spend governance, agent runtime,
audit anchoring. 852 commits, 196 TypeScript files, 5 Solidity contracts.

**Next 30 days:** Ship ERC-4337 account abstraction on Robinhood Chain
(ZeroDev / Alchemy) — Cognivern policy as an on-chain validator / session-key
authority, turning advisory governance into non-custodial enforcement ·
Governed tokenized-RWA (stock-token) trading with Chainlink price feeds ·
Verify contracts on Arbiscan + Robinhood explorer · Ship
`FHE.verifyDecryptResult` upgrade · Mainnet Arbitrum One + Robinhood Chain ·
CrewAI/LangChain agent framework plugins.

**GTM (following the Open House London GTM + Product Canvas frameworks):**

Full Product Canvas and GTM Canvas are in [docs/PRODUCT_GTM_CANVAS.md](./docs/PRODUCT_GTM_CANVAS.md).
Summary:

- **Wedge:** policy evaluation layer that intercepts every agent spend before
  signing, with budgets encrypted on-chain via FHE. One API call, zero
  framework changes.
- **Why now:** agent frameworks maturing + FHE coprocessors production-ready on
  Arbitrum + regulatory pressure on autonomous agent spending.
- **Why onchain (necessary, not decorative):** the policy decision must be
  provable to auditors (not a backend assertion); encrypted budgets are only
  possible onchain with FHE; non-repudiable audit trail requires onchain
  anchoring. Without onchain, the policy engine is a trust assumption.
- **Distribution:** borrowed (agent framework integrations — governance is a
  required layer for enterprise agent deployment) + earned (FHE-on-Arbitrum
  narrative) + borrowed (audit/compliance firm partnerships).
- **Revenue:** SaaS control-plane subscription + per-spend evaluation fees +
  enterprise audit compliance packages. No token.
- **Star customer loop:** discover via framework integrations → trust via
  on-chain verifiability → stay via workflow lock-in + compliance dependency →
  share via audit pass narrative + framework plugin demos.

---

## License

MIT
