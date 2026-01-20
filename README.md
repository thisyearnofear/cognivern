# Cognivern: AI Governance Platform for Decentralized Agents

A unified governance platform for autonomous AI agents operating across **Sapience** (prediction markets), **Recall** (decentralized memory), and **Filecoin** (storage & governance). Built for the [Sapience Hackathon](https://www.sapience.xyz/hackathon).

## 🌟 Overview

Cognivern is a multi-chain AI governance platform that enables autonomous agents to:
1. **Forecast & Trade** - Participate in Sapience prediction markets with EAS attestations on Arbitrum
2. **Store Knowledge** - Persist reasoning and memory on Recall Network
3. **Enforce Governance** - Apply policy-based controls via Filecoin FVM smart contracts

## 🎯 Sapience Hackathon Integration

### Forecasting Agent Track
- ✅ **Real-time Market Data** - GraphQL integration with Sapience API
- ✅ **EAS Attestations** - On-chain forecast submissions via `@sapience/sdk`
- ✅ **Brier Score Tracking** - Accuracy leaderboard integration
- 🚧 **Automated Forecasting** - LLM-powered probability estimation (in progress)
- 🚧 **Trading Execution** - Market position taking on Ethereal (in progress)

### Key Features
- **📊 Live Markets Dashboard** - Real-time display of active Sapience conditions
- **🏆 Leaderboard Integration** - Track agent performance with Brier Scores
- **🔗 Multi-Chain Architecture** - Sapience (forecasts) + Recall (memory) + Filecoin (governance)
- **🛡️ Policy Enforcement** - Governance checks before forecast submission
- **🧠 Persistent Memory** - Store forecast reasoning on Recall Network

## 🚀 Quick Start

### Prerequisites
- Node.js v20.14+
- pnpm
- Arbitrum ETH for gas fees
- OpenRouter API key (for LLM forecasting)

### Installation

```bash
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern
pnpm install
```

### Configuration

**CRITICAL**: This application enforces a strict "No Mocks" policy. You **MUST** provide valid API keys and configuration for all services (Sapience, Recall, Filecoin), or the respective features will fail with explicit errors.

Create `.env` file:

```env
# Sapience Configuration (REQUIRED)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ETHEREAL_RPC_URL=https://mainnet.ethereal.xyz/rpc
SAPIENCE_PRIVATE_KEY=your_private_key_here

# LLM Provider (REQUIRED for Forecasting)
OPENROUTER_API_KEY=your_openrouter_key

# Security (REQUIRED)
API_KEY=your_api_key

# Recall Network (REQUIRED for Memory)
# Get keys from: https://docs.recall.network/
RECALL_API_KEY=your_recall_key
RECALL_BUCKET=agent-memory
RECALL_ENDPOINT=https://api.recall.network/v1

# Filecoin FVM (REQUIRED for Governance)
# Get testnet funds: https://faucet.calibration.filfox.info/
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
FILECOIN_PRIVATE_KEY=your_private_key_here
GOVERNANCE_CONTRACT_ADDRESS=your_deployed_contract_address
```

### Running the Application

**Backend:**
```bash
pnpm build
PORT=3000 pnpm start
```

**Frontend:**
```bash
cd src/frontend
pnpm dev
# Visit http://localhost:5173
```

## 🏗️ Architecture

### Multi-Chain Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    COGNIVERN PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │   SAPIENCE   │   │    RECALL    │   │    FILECOIN      │ │
│  │  (Execution) │   │   (Memory)   │   │  (Governance)    │ │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤ │
│  │ • Forecasts  │   │ • Knowledge  │   │ • Policy Storage │ │
│  │ • Markets    │   │ • Reputation │   │ • Audit Trails   │ │
│  │ • EAS Attest │   │ • AgentRank  │   │ • FVM Contracts  │ │
│  │ • Trading    │   │ • Memory     │   │ • Compliance     │ │
│  └──────────────┘   └──────────────┘   └──────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         UNIFIED GOVERNANCE LAYER (Core Value)           ││
│  │  • Policy enforcement across all agent actions          ││
│  │  • Compliance scoring (multi-chain reputation)          ││
│  │  • Risk management before forecast/trade execution      ││
│  │  • Unified dashboard for multi-chain monitoring         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Backend Components

**Sapience Integration:**
- `src/services/SapienceService.ts` - SDK integration for EAS attestations
- `src/modules/agents/implementations/SapienceTradingAgent.ts` - Forecasting agent

**Frontend Services:**
- `src/frontend/src/services/sapienceApi.ts` - GraphQL client for Sapience API
- `src/frontend/src/hooks/useSapienceData.ts` - React hook for real-time data
- `src/frontend/src/components/sapience/SapienceMarkets.tsx` - Markets UI

**Governance:**
- `src/services/GovernanceAgent.ts` - Policy enforcement engine
- `src/modules/api/controllers/AgentsController.ts` - Agent monitoring

## 📊 Dashboard Features

### Overview Tab
- **Platform Summary** - Real-time stats from Sapience, Recall, and Filecoin
- **System Health** - Multi-chain connectivity status
- **Agent Monitoring** - Performance metrics and compliance scores

### Markets Tab (Sapience)
- **Live Prediction Markets** - Active conditions from Sapience GraphQL
- **Market Statistics** - Total forecasts, active markets, all-time data
- **Accuracy Leaderboard** - Brier Score rankings
- **Submit Forecast** - One-click forecast submission (coming soon)

### Agents Tab
- **Agent Performance** - Uptime, success rate, response time
- **Sapience Profile** - Forecast wins, earnings, reputation
- **Governance Profile** - Policy compliance, audit scores

### Governance Tab
- **Policy Management** - Filecoin FVM smart contracts
- **Compliance Tracking** - Multi-chain governance actions
- **Audit Logs** - Immutable record of agent decisions

## 🔗 API Endpoints

### System
- `GET /health` - Basic health check
- `GET /api/system/health` - Detailed system status

### Agents
- `GET /api/agents/monitoring` - Agent performance metrics
- `GET /api/agents/unified` - Multi-chain agent data

### Sapience (via SDK)
- Forecast submission via `@sapience/sdk`
- Market data via GraphQL (`https://api.sapience.xyz/graphql`)

## 🧪 Testing

```bash
# Backend health
curl http://localhost:3000/health

# System status
curl http://localhost:3000/api/system/health \
  -H "X-API-KEY: development-api-key"

# Agent monitoring
curl http://localhost:3000/api/agents/monitoring \
  -H "X-API-KEY: development-api-key"
```

## 🎓 Sapience SDK Usage

```typescript
import { submitForecast } from '@sapience/sdk';

// Submit forecast with EAS attestation
const { hash } = await submitForecast({
  conditionId: '0x...',
  probability: 75,
  comment: 'AI-generated forecast reasoning',
  privateKey: process.env.SAPIENCE_PRIVATE_KEY as `0x${string}`,
});

console.log(`Attestation tx: ${hash}`);
```

## 🏆 Hackathon Submission

**Track:** Forecasting Agents (Accuracy)

**Scoring:** Inverted, horizon-weighted Brier Score

**Key Differentiators:**
1. **Multi-Chain Governance** - Unique integration of Sapience, Recall, and Filecoin
2. **Policy-First Design** - Governance checks before every forecast
3. **Persistent Memory** - Forecast reasoning stored on Recall for continuous learning
4. **Production-Ready UI** - Real-time dashboard with leaderboard integration

## 📚 Documentation

- [Sapience Docs](https://docs.sapience.xyz)
- [Sapience Hackathon](https://www.sapience.xyz/hackathon)
- [Recall Network](https://recall.network)
- [Filecoin FVM](https://fvm.filecoin.io)

## 🛣️ Roadmap

- [x] Sapience SDK integration
- [x] Real-time market data display
- [x] Leaderboard tracking
- [x] Automated LLM forecasting
- [ ] Trading execution on Ethereal
- [x] Recall memory persistence
- [x] Filecoin governance contracts (Integration)
- [ ] Multi-agent coordination

## 📜 License

MIT

