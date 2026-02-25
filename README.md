# Cognivern: Agent Reliability + Proof Layer

Cognivern is a **Run Ledger + Ingestion API** for teams building in the agentic era.

It gives you a durable, queryable record of what agents did (steps + artifacts), with optional **verifiability** via Chainlink primitives (price feeds today; CRE-style workflows as the execution target).

**Wedge:** don’t replace your agent runtime — just *send runs* to Cognivern.

## What it does (today)

- **Run Ledger UI**: browse runs, drill into steps and artifacts, copy run links/JSON.
- **Data-plane ingestion**: `POST /ingest/runs` (project-scoped ingest keys).
- **Multi-project support**: `projectId` scoping across runs.
- **Persistence**: run history and usage survive restarts (local-first JSONL/JSON).
- **Commercial primitives**: per-project quotas, usage headers, token-level telemetry.
- **Chainlink integration (differentiator)**: forecasting workflow reads Arbitrum Chainlink price feeds and can optionally attest forecasts.

## Who it’s for

- Teams running agents in production who need **debugging, governance, and accountability**.
- Builders shipping on-chain automation who need **proof** for high-stakes actions.

## Key idea

Agents are cheap. **Trust and reliability are expensive.**

Cognivern is the layer that turns “agent runs” into something you can operate, audit, and bill.

## 🎯 Chainlink Convergence Hackathon

### Target Tracks
- 🤖 **AI Agents: DeFi & Web3** — AI-powered prediction market agent consuming CRE workflows
- 🔗 **AI Agents: Multi-agent & orchestration** — Multi-LLM orchestrated forecasting with decentralized consensus
- 🏆 **Grand Prize** — Best overall project showcasing Chainlink technologies

### CRE Integration
- ✅ **Cron-Triggered Workflows** — Scheduled forecasting pipeline running on Chainlink DON
- ✅ **HTTP Capability** — Sapience market data fetched with multi-node consensus
- ✅ **Confidential HTTP** — Private LLM API calls with enclave execution
- ✅ **EVM Read** — Chainlink Data Feeds for real-time price inputs
- ✅ **EVM Write** — Consensus-verified EAS attestation submission on Arbitrum

### Key Features
- **📊 Live "Thoughts" Dashboard** — Real-time display of agent reasoning and decision-making process
- **🏆 Horizon-Weighted Strategy** — Mathematically optimized market selection for maximum accuracy scoring
- **🔐 Confidential AI** — LLM reasoning stays private via CRE enclaves, preventing front-running
- **🛡️ Governance Native** — Policy enforcement layer with on-chain risk guardrails

## Quick Start

### Prerequisites
- Node.js v20.14+
- pnpm
- Arbitrum ETH for gas fees (Address: `0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC`)

### Installation

```bash
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern
pnpm install
```

### Configuration

Cognivern enforces a strict **"No Mocks"** policy. Features only activate when valid production keys are present.

Create `.env` file:

```env
# Sapience / Arbitrum (REQUIRED)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=your_private_key_here

# Resilient LLM Layer (REQUIRED)
ROUTEWAY_API_KEY=your_routeway_key
GROQ_API_KEY=your_groq_key

# Recall Network (REQUIRED for Memory)
RECALL_API_KEY=your_recall_key
RECALL_BUCKET=agent-memory

# Filecoin FVM (REQUIRED for Governance)
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
FILECOIN_PRIVATE_KEY=your_private_key_here
GOVERNANCE_CONTRACT_ADDRESS=0x...
```

### Run the backend

```bash
pnpm install
pnpm build
pnpm start
```

### Ingest a run from any agent

```bash
# Configure projects/keys
export COGNIVERN_PROJECTS="default:Default Project"
export COGNIVERN_INGEST_KEYS="default=dev-ingest-key"

# Send a run
curl -X POST http://localhost:3000/ingest/runs \
  -H 'Authorization: Bearer dev-ingest-key' \
  -H 'X-PROJECT-ID: default' \
  -H 'Content-Type: application/json' \
  -d '{"runId":"123","projectId":"default","workflow":"forecasting","mode":"local","startedAt":"2026-01-01T00:00:00.000Z","finishedAt":"2026-01-01T00:00:01.000Z","ok":true,"steps":[],"artifacts":[]}'
```

Or use the included example:
```bash
pnpm ingest-example
```

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the standard artifact-based release process (build locally, deploy to Hetzner, rollback via symlink).

## 🏗️ Architecture: CRE-Powered Prediction Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRE Workflow DON                              │
│                                                                 │
│  [Cron Trigger]  ──→  [HTTP Fetch]  ──→  [Confidential HTTP]   │
│   Every 10 min        Market Data         LLM Reasoning         │
│                       (consensus)         (private enclave)     │
│                            │                    │               │
│                            ▼                    ▼               │
│                     [EVM Read]           [EVM Write]            │
│                     Price Feeds          EAS Attestation        │
│                     (consensus)          (consensus)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Arbitrum One   │
                    │  EAS Attestation │
                    │  + Data Feeds    │
                    └──────────────────┘
```

### Multi-LLM Resilience Layer
1. **Tier 1 (Routeway.ai):** High-context reasoning using Moonshot Kimi K2 via Confidential HTTP.
2. **Tier 2 (Groq):** Ultra-fast failover using Llama 3.3 (70B) if Tier 1 is throttled or offline.

Both LLM calls execute within CRE's Confidential HTTP capability — API keys and reasoning remain private within enclave execution.

## 🏆 Evidence of Prior Work

Cognivern has a proven track record from the Sapience Hackathon:
- **Arbiscan (EAS):** [View Agent Wallet & Attestations](https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC)
- **Real-Time Reasoning:** Live "Thoughts" feed generated by the Multi-LLM layer
- **On-Chain History:** Existing EAS attestations demonstrate production-ready forecasting

## 📚 Documentation

| Doc | Description |
| :--- | :--- |
| **[Architecture](./docs/ARCHITECTURE.md)** | System overview, components, and design |
| **[Developer Guide](./docs/DEVELOPER.md)** | API reference, testing, and contributing |
| **[CRE Integration](./docs/CRE.md)** | Chainlink workflow implementation |
| **[Deployment](./docs/DEPLOYMENT.md)** | Release process, rollback, and operations |

## 📜 License

MIT
