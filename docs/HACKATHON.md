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
| Google Cloud Rapid Agent Hackathon        | MongoDB Track                     | 2026-Q2 | **In Progress**       |

## Integration Details

Each hackathon contributed a specific integration. See the respective docs:

- **Fhenix** — [`FHENIX_INTEGRATION.md`](./FHENIX_INTEGRATION.md) — Confidential policy state via CoFHE, cross-chain via Hyperlane
- **OWS** — [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Wallet bootstrap, API keys, governed spend execution
- **ChainGPT** — [`CHAINGPT_INTEGRATION.md`](./CHAINGPT_INTEGRATION.md) — Web3 LLM auditor, contract audit policy rules
- **0G** — `ZeroGStorageService` anchors governance decisions to 0G Storage
- **Agents Assemble** — FHIR/SHARP context adapter, Together AI evaluator, Kestra orchestration, MCP tool endpoint
- **Google Cloud Rapid Agent** — MongoDB MCP integration for persistent agent memory. GCP Agent Builder hosts a governed agent powered by Gemini + Cognivern governance API + MongoDB MCP. Track: MongoDB

### Phase 4 — GCP Showcase Agent (Pre-Submission Checklist)

**What's done:**
- MongoDB persistence for run ledger (`MongoDbCreRunPersistence`), agent memory (`MongoDbMemoryService`), and policies (`MongoDbPolicyPersistence`)
- `MongoDbService` lazy-connection manager gated by `MONGODB_URI`
- `config/mcp-servers.json` — MongoDB MCP sidecar config for Agent Builder
- Docs: `ARCHITECTURE.md` (MongoDB table), `HACKATHON.md`, `DEPLOYMENT.md`, `DEVELOPER.md`

**Needs before submission:**
- MongoDB Atlas free tier cluster provisioned with credentials in `.env`
- Cognivern backend deployed to a public URL (Hetzner or Railway)
- GCP Agent Builder agent configured with Cognivern API + MongoDB MCP tools
- Screencast of GCP agent calling Cognivern governance API + querying MongoDB memory
- UI accessibility improvements: aria-labels on color-only indicators, keyboard nav on stat cards, loading skeletons for audit/policies (done) — likely the most judge-visible polish

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
