# Hackathons

Cognivern has been submitted to multiple hackathons. This doc tracks them.

| Hackathon                                 | Track                             | Date    | Status                |
| ----------------------------------------- | --------------------------------- | ------- | --------------------- |
| Fhenix Privacy-by-Design Buildathon       | Confidential Policy State         | 2026-Q2 | Submitted (Waves 1-7) |
| X Layer Arena                             | Agent Spend Governance            | 2026-Q2 | Submitted             |
| 0G APAC — Track 3                         | Agentic Economy / Autonomous Apps | 2026-Q2 | Submitted             |
| **0G Bridge by AKINDO**                   | **Governance & Trust for the 0G Agent Economy** | **2026-Q3** | **Entering Wave 1 (Jun 13-26, 2026)** |
| OWS Hackathon — Track 02                  | Agent Spend Governance & Identity | 2026-Q2 | Submitted             |
| Agents Assemble Healthcare AI Endgame     | Healthcare Governance             | 2026-Q2 | Submitted             |
| Agents Under Pressure — Build Your Own OS | PromptOS + DevFactory Grid        | 2026-Q2 | Submitted             |
| Google Cloud Rapid Agent Hackathon        | MongoDB Track                     | 2026-Q2 | **Submitted**           |

## Integration Details

Each hackathon contributed a specific integration. See the respective docs:

- **Fhenix** — [`FHENIX_INTEGRATION.md`](./FHENIX_INTEGRATION.md) — Confidential policy state via CoFHE, cross-chain via Hyperlane
- **OWS** — [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Wallet bootstrap, API keys, governed spend execution
- **ChainGPT** — [`CHAINGPT_INTEGRATION.md`](./CHAINGPT_INTEGRATION.md) — Web3 LLM auditor, contract audit policy rules
- **0G** — `ZeroGStorageService` anchors governance decisions to 0G Storage
- **Agents Assemble** — FHIR/SHARP context adapter, Together AI evaluator, Kestra orchestration, MCP tool endpoint
- **Google Cloud Rapid Agent** — MongoDB MCP integration for persistent agent memory. GCP Agent Builder hosts a governed agent powered by Gemini + Cognivern governance API + MongoDB MCP. Track: MongoDB

### Phase 4 — GCP Showcase Agent (Submission)

**What's done:**
- **Cognivern Copilot agent** (`agent/agent.ts`) — Gemini 3.1 function-calling runtime implementing the multi-step protocol: PLAN → EVIDENCE → PREVIEW → CONFIRM → EXECUTE → AUDIT. CLI entry + HITL gate.
- **Agent Builder import spec** (`agent/agent-builder.yaml`) — registers the agent, the Gemini 3.1 model, the Cognivern governance API as an OpenAPI tool, and the MongoDB MCP server as a sidecar MCP tool.
- **Tool surface** (`agent/tools/`) — 6 Cognivern tools (policies, preview, execute, audit) and 4 MongoDB tools (memory, audit, vendor reputation, run ledger).
- **System prompt** (`agent/instructions.md`) — the agent's mission and behavioral rules.
- **MongoDB persistence** — `MongoDbCreRunPersistence`, `MongoDbMemoryService`, `MongoDbPolicyPersistence` (run ledger, agent memory, policies)
- **MongoDB seed script** (`scripts/db/seed-hackathon.ts`) — loads 100 audit logs, ~30 memories, 10 vendors (mix of trusted and risky), and 20 runs. Indexes for fast judge queries.
- **Smoke test** (`agent/smoke-test.ts`) — runs the agent end-to-end in preview-only mode and asserts the multi-step protocol was followed.
- **Gemini 3.1** is the default reasoning model in `MultiModelRouter.ts` (env override: `GEMINI_MODEL=gemini-3.1-pro-preview`).
- **Docs** — `agent/README.md` is the judge-facing deployment guide; `HACKATHON.md`, `ARCHITECTURE.md`, `DEVELOPER.md`, `DEPLOYMENT.md` reference the new agent.

**Submitter actions (5 minutes each):**
1. Provision a MongoDB Atlas free tier cluster; set `MONGODB_URI` in `.env`.
2. `pnpm db:seed:reset` — load realistic data so judges can poke.
3. Confirm `COGNIVERN_BASE_URL` and `COGNIVERN_API_KEY` point at the live deployment.
4. `pnpm agent:smoke` — verify the multi-step protocol on a real MongoDB cluster.
5. Import `agent/agent-builder.yaml` into the Agent Builder console; record the 3-min demo screencast.

**Track:** MongoDB. **Model:** Gemini 3.1 Pro (`gemini-3.1-pro-preview`). **MCP server:** `@mongodb-js/mongodb-mcp-server`.

## Demo Flow

### Standard Spend Flow

```
Policy → Preview (simulate) → Execute (sign) → Audit (review)
```

1. **Create Policy** — `POST /api/governance/policies`
2. **Bootstrap Wallet** — `POST /api/ows/bootstrap`
3. **Issue API Key** — `POST /api/ows/api-keys`
4. **Preview Spend** — `POST /api/spend/preview`
5. **Execute Spend** — `POST /api/spend`
6. **Review Audit** — `GET /api/audit/logs`

### Fhenix Encrypted Spend Flow

```bash
COGNIVERN_URL=https://cognivern.thisyearnofear.com COGNIVERN_API_KEY=sapience-hackathon-key pnpm demo:fhenix
```

9-step end-to-end demo: encrypted policy creation, FHE spend evaluation, cross-chain anchoring, auditor permits, selective disclosure, encryption sidecar, Privara payroll, sealed-bid vendor selection.

## Deployments

| Layer                 | URL                                         |
| --------------------- | ------------------------------------------- |
| Frontend (Vercel)     | https://cognivern.vercel.app                |
| Backend API (Hetzner) | https://cognivern.thisyearnofear.com              |
| PromptOS Terminal     | https://cognivern.vercel.app/os             |
| Repository            | https://github.com/thisyearnofear/cognivern |

## 0G Bridge by AKINDO — 10-Week, 5-Wave Buildathon

**Program:** [0G Bridge by AKINDO](https://docs.0g.ai/) — 10 weeks, 5 waves, up to $50K in 0G credits, culminating in a Demo Day around Token2049 Singapore (Oct 7-8, 2026).

**Strategic repositioning:** Cognivern's 0G APAC submission framed 0G as *one of seven* partner networks. For the Bridge, we are promoting 0G to the **primary agent-economy rail** and reframing Cognivern as the **governance & trust layer for the 0G agent economy**. The Fhenix / X Layer / Filecoin / ChainGPT / Ledger / MongoDB / Sapience integrations remain as the supporting layer; 0G is the spine.

### 0G Component Plan

| 0G Component | What we ship | Where it lives in the repo |
| --- | --- | --- |
| **0G Chain** (EVM-compatible L1) | Redeploy `GovernanceContract`, `GovernedVault`, and a new `AgentGovernancePolicy` registry contract. On-chain policy checks, evidence hash storage, and per-agent spend counters. | `contracts/src/GovernanceContract.sol`, `contracts/src/GovernedVault.sol`, `contracts/src/AgentGovernancePolicy.sol` (new) |
| **0G Storage** | Dual-anchor evidence (already live on Newton testnet). Mainnet-anchored `zeroGRootHash` in `CreRun.evidence` alongside Filecoin. | `src/backend/services/ZeroGStorageService.ts` |
| **0G Pay** | New service that integrates the 0G Pay SDK. Approved spends from `OwsWalletService` settle natively through 0G Pay, with on-chain receipt recorded in the audit trail. | `src/backend/services/ZeroGPayService.ts` (new) |
| **Agentic ID (ERC-7857)** | New contract + service. Each governed agent becomes a tokenized Agentic ID carrying its intelligence, audit history, and active policy as encrypted metadata. The existing `signingProvider` abstraction, `PolicyService`, and audit ledger all become on-chain properties of the ID. | `contracts/src/AgenticIDRegistry.sol` (new), `src/backend/services/AgenticIDService.ts` (new) |
| **0G Compute** | Verifiable inference for `ChainGPTAuditService` (contract audit) and `ControlEvaluationService` (suspicion scoring). Becomes the default provider for governance-critical decisions; closed-source LLM providers become fallback. | `src/backend/services/ComputeProvider.ts` (new), wired into `MultiModelRouter` |

### Wave-by-Wave Submission Plan

| Wave | Dates | Focus | What we submit | 0G credit |
| --- | --- | --- | --- | --- |
| **1 — Scoping** | Jun 13-26, 2026 | Project scoping & 0G integration plan | This scoping doc, public repo link, README + ARCHITECTURE updates, the 5-component plan above, and a 1-min Loom walkthrough of the existing `/copilot` demo (testnet is acceptable in Wave 1) | $5,000 |
| **2 — Testnet prototype** | Jun 27 - Jul 10, 2026 | Working prototype on 0G testnet with demo | 0G Chain contracts deployed on Newton testnet; `ZeroGStorageService` + new `ZeroGPayService` + `AgenticIDService` wired into the audit pipeline; 3-min demo video showing the full governance loop ending in an Agentic ID mint | $7,500 |
| **3 — Mainnet** | Jul 11-24, 2026 | Ship to 0G mainnet with verified contract addresses | `GovernanceContract` + `GovernedVault` + `AgenticIDRegistry` deployed to **0G mainnet** with verified addresses; 0G Explorer link in the submission; on-chain activity shown via at least one end-to-end governed spend + Agentic ID mint | $15,000 |
| **4 — Traction** | Jul 25 - Aug 7, 2026 | Real users, real usage, real signal | Public frontend driving real users through the `/copilot` flow; per-workspace metrics on-chain (audit root counts, pay tx counts, agentic ID mints); X engagement from `#0GBridge #BuildOn0G` posts | $10,000 |
| **5 — Demo Day** | Aug 8-21, 2026 | Pitch + next-stage roadmap | 3-min Demo Day pitch deck + video; investor-grade roadmap; mainnet metrics roll-up | $12,500 |

**Multi-Wave Completion Bonus:** Submitting all 5 waves unlocks additional credit rewards.

### Mandatory Rule

> *"At least one 0G component must be integrated in every valid submission from Wave 3 onwards. Submissions without real 0G integration may be disqualified."*

We satisfy this with `ZeroGStorageService` (already live) and the 0G Chain contracts redeployed in Wave 2/3. The bar of "real integration" is met by:
- Live on-chain contract addresses on 0G mainnet (Wave 3+)
- Real `zeroGRootHash` values in production audit records (already happening on testnet)
- A verified 0G Pay settlement receipt in the audit trail (Wave 3+)
- At least one minted Agentic ID visible on 0G Explorer (Wave 4+)

### Wave 1 Deliverable Checklist (deadline: Jun 26, 2026, 23:59 UTC)

- [ ] **Project name + 1-line description** (max 30 words) — top of the 0G Bridge section in `README.md`
- [ ] **Short summary** — what it does, the problem, which 0G components it uses (above table)
- [ ] **Public code repo** — `github.com/thisyearnofear/cognivern`
- [ ] **README** with setup instructions — already in place
- [ ] **Architecture diagram or technical description** — `docs/ARCHITECTURE.md` + 0G Bridge section
- [ ] **Local deployment / reproduction steps** — `docs/DEVELOPER.md`
- [ ] **Public X post** with `#0GBridge #BuildOn0G @0G_labs @0G_Builders @AKINDO_io` + demo screenshot/clip
- [ ] **AKINDO submission page** filled out at https://app.akindo.io/0g-bridge

### Why Cognivern is well-positioned for this program

1. **Existing 0G integration is live** — `ZeroGStorageService` is shipping in production today, with 13 unit tests, a circuit breaker, and a health-check probe. This is a head start on Wave 1 and Wave 2.
2. **Multi-network producer** — we already ship 7 partner-network integrations, so the discipline of staged rollouts (testnet → mainnet, dual-anchor) is well rehearsed from the Fhenix Waves 1-7 experience.
3. **Cross-area project** — the buildathon explicitly encourages cross-area work. Cognivern lands in **four** of the six suggested tracks (AI Agents, Trust & Safety, Finance, Data & Infrastructure).
4. **Product is deployed and shipping** — live frontend on Vercel, live API on Hetzner, 181 backend tests, CI, type-strict. The Wave 1 deliverable is mostly a doc effort.
5. **Agentic ID is a perfect fit** — the new ERC-7857 standard for tokenizing AI agents with their intelligence intact is *exactly* what Cognivern already does (governance + signing + policy for agent wallets). The bridge from "we govern agent wallets" to "we mint Agentic IDs for governed agents" is short.
6. **0G Pay is a perfect fit** — governed agent-to-agent settlement is the natural use case for 0G Pay. We can route approved spends from `OwsWalletService` through 0G Pay with minimal new code.

### Related Docs

- [Architecture](./ARCHITECTURE.md) — includes the 0G Bridge target architecture
- [0G Storage service](../src/backend/services/ZeroGStorageService.ts) — already live
- [Developer Guide](./DEVELOPER.md) — setup, local reproduction
- [Deployment](./DEPLOYMENT.md) — production deployment
