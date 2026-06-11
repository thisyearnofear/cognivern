# Hackathons

Cognivern has been submitted to multiple hackathons. This doc tracks them.

| Hackathon                                 | Track                             | Date    | Status                |
| ----------------------------------------- | --------------------------------- | ------- | --------------------- |
| Fhenix Privacy-by-Design Buildathon       | Confidential Policy State         | 2026-Q2 | Submitted (Waves 1-7) |
| X Layer Arena                             | Agent Spend Governance            | 2026-Q2 | Submitted             |
| 0G APAC — Track 3                         | Agentic Economy / Autonomous Apps | 2026-Q2 | Submitted             |
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

## Related Docs

- [Architecture](./ARCHITECTURE.md)
- [Developer Guide](./DEVELOPER.md)
- [Deployment](./DEPLOYMENT.md)
