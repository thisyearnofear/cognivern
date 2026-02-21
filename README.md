# Cognivern: Decentralized AI Prediction Agent powered by Chainlink CRE

A consensus-verified AI forecasting agent that uses **Chainlink Runtime Environment (CRE)** to orchestrate prediction market analysis, LLM reasoning, and on-chain attestations — all executed across Decentralized Oracle Networks with Byzantine Fault Tolerant consensus.

Built for [Convergence: A Chainlink Hackathon](https://chain.link/hackathon) (Feb 6 – Mar 1, 2026).

## 🌟 Overview

Cognivern transforms autonomous AI agents from centralized bots into **decentralized, verifiable prediction systems**:

1. **CRE-Orchestrated Forecasting** — Cron-triggered CRE workflows fetch market data, generate predictions, and submit attestations — every step consensus-verified by a DON.
2. **Confidential AI Reasoning** — LLM calls execute via Confidential HTTP capability, keeping prediction logic private until attested on-chain.
3. **Chainlink Data Feeds** — On-chain price data (ETH/USD, BTC/USD) consumed as inputs to the forecasting model via EVM Read capability.
4. **Multi-LLM Resilience** — Fallback across Routeway.ai (Kimi K2) and Groq (Llama 3.3) within CRE callbacks.

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

## 🚀 Quick Start (Production Setup)

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

### Running the Live Agent

**Start the Unified Service (API + Forecasting Brain):**
```bash
pnpm build
pm2 start dist/index.js --name cognivern-agent
```

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

- [Chainlink CRE Integration Plan](./docs/CHAINLINK_INTEGRATION.md) - **Start Here** — CRE workflow design, implementation phases, and architecture
- [Judges Guide](./docs/JUDGES_GUIDE.md) - Quick evidence and evaluation guide
- [Technical Architecture](./docs/TECHNICAL.md) - Deep dive into modular design
- [Sapience Integration](./docs/SAPIENCE_INTEGRATION.md) - Prediction market strategy details

## 📜 License

MIT