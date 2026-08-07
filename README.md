# Cognivern

**SpendOS for agent teams.**

Control plane for agent operations: governed wallet spend + AI spend governance across IDE, CLI, and agent workflows. Every spend is policy-checked, privacy-preserving, efficiency-aware, and audit-ready.

**Live:** [Frontend](https://cognivern.persidian.com) · [API](https://api.cognivern.persidian.com) · [PromptOS Terminal](https://cognivern.persidian.com/os)

## Focus

- **Canton DevNet** — sealed-bid RFP auctions with structural sub-transaction privacy and atomic multi-party reveal.
- **SigNoz** — OpenTelemetry-native observability for the full agent governance decision tree.
- **Agentic commerce** — governed wallets, policy-checked spend, FHE-encrypted evaluation, durable audit trail.

## Quick Start

```bash
pnpm install
pnpm build
pnpm start
```

Minimum `.env`:

```env
API_KEY=your-api-key-here
OWS_VAULT_SECRET=your-vault-secret
CHAINGPT_API_KEY=your-chain-gpt-key   # Optional: Web3 LLM + audit
```

For local setup, API reference, and production deployment, see the [Developer Guide](./docs/DEVELOPER.md).

## Documentation

### For developers

| Doc | What's in it |
 | --- | --- |
| [Developer guide](./docs/DEVELOPER.md) | Local setup, API reference, testing, production readiness |
| [Architecture](./docs/ARCHITECTURE.md) | System design, data flows, Fhenix / Canton / ChainGPT / Ledger integrations |
| [Deployment](./docs/DEPLOYMENT.md) | Hetzner / PM2 / nginx, env vars, health checks |
| [Tester guide](./docs/TESTER_GUIDE.md) | Operator orientation for the canonical live/demo environment |
| [Agent governance integration spec](./docs/AGENT_GOVERNANCE_INTEGRATION_SPEC.md) | Wire the sealed-bid auction to the agent-governance layer |
| [Prompt-injection controls plan](./docs/PROMPT_INJECTION_CONTROLS_PLAN.md) | Source-aware authorization, spend enforcement, and adversarial test plan |
| [Product UX vision](./docs/UX_VISION.md) | Experience principles, route blueprint, and UX delivery plan |
| [UX validation checklist](./docs/UX_VALIDATION_CHECKLIST.md) | Task-based acceptance checks for the core product workflows |
| [UX implementation plan](./docs/UX_IMPLEMENTATION_PLAN.md) | Phased work plan for Audit, shared states, Settings, Runs, analytics, and validation |
| [User-testing protocol](./docs/USER_TESTING_PROTOCOL.md) | Moderated pilot tasks, safety boundaries, observation sheet, and go/no-go criteria |
| [Agent guidance for AI / humans](./AGENTS.md) | How to verify Canton runtime state without re-diagnosing it |
| [HydraDB integration](./docs/HYDRADB.md) | Optional agentic-memory / cross-source retrieval layer (toggleable, free tier) |
| [Iteration log](./LOOP.md) | Write-verify-fix history of the build |

### Canton / DevNet

| Doc | What's in it |
| --- | --- |
| [Canton](./docs/CANTON.md) | Daml sealed-bid model, hydration, sandbox + DevNet runbooks |
| [Canton DevNet materials](./docs/HACKCANTON_DEVNET_MATERIALS.md) | Endpoints, auth, allocated parties, Daml user id |
| [Canton final submission runbook](./docs/FINAL_SUBMISSION_RUNBOOK.md) | Cutover / config that is already done for DevNet |

### Submissions & demo archive

| Doc | What's in it |
| --- | --- |
| [Canton hackathon submission](./docs/HACKATHON_SUBMISSION_CANTON.md) | Track 1: Canton private RFP — enterprise framing, DevNet proof pack |
| [SigNoz submission](./docs/HACKATHON_SUBMISSION_SIGNOZ.md) | OpenTelemetry instrumentation of the full agent governance decision tree |
| [KeeperHub — Agents Onchain submission](./docs/HACKATHON_SUBMISSION_KEEPERHUB.md) | Sapience-driven rebalance loop through KeeperHub Direct Execution + MCP for editor agents, with a local round-trip test rig |
| [SigNoz dashboard definitions](./docs/signoz-dashboards.json) | 3 dashboards: governance overview, LLM provider health, HTTP SLO + audit |
| [Agentic commerce demo runbook](./docs/AGENTIC_COMMERCE_DEMO_RUNBOOK.md) | End-to-end demo path for the agentic-commerce track |
| [Agentic commerce demo script](./docs/demo-video-script-agent-governance.md) | Narration + timing for the agent-governance demo |
| [Canton demo script](./docs/demo-video-script.md) | Narration + timing for the Canton sealed-bid demo |
| [Pitch deck source](./docs/pitch-deck-source.md) | Source for the open-house / pitch deck |
| [Product & GTM canvas](./docs/PRODUCT_GTM_CANVAS.md) | Product Canvas + GTM Canvas — wedge, why-now, why-onchain, distribution loops |
| [Prava hackathon](./docs/PRAVA_HACKATHON.md) | Agents of Commerce — Cognivern as governance layer + Prava as payment execution |

## License

MIT
