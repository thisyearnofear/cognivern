# Cognivern

A decentralized governance platform for AI agents built on Filecoin's programmable storage infrastructure. Cognivern provides transparent, verifiable, and trustless governance of AI agent behavior through on-chain policy enforcement and immutable audit trails.

## 🌟 Overview

Cognivern leverages Filecoin's sovereign data layer to create a comprehensive governance framework for AI agents. Built for the **Hack The Sovereign Data Layer** hackathon, this platform demonstrates:

- **On-Chain Governance:** Smart contract-based policy enforcement using FVM
- **Immutable Audit Trails:** All agent decisions stored permanently on Filecoin
- **Programmable Storage:** Custom storage/retrieval logic for governance data
- **USDFC Integration:** Crypto-native payments for storage and governance services
- **Showcase Marketplace:** Demonstrates governance capabilities in action

## 🎉 **DEPLOYMENT STATUS**

**🚀 PRODUCTION READY - 100% DECENTRALIZED**

- ✅ **Smart Contracts Deployed**: Live on Filecoin Calibration testnet
- ✅ **Real Blockchain Integration**: All core services using on-chain data
- ✅ **GovernanceContract**: `0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880`
- ✅ **AIGovernanceStorage**: `0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada` (AI-specialized)
- ✅ **USDFC Token**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- ✅ **Dual Trading Agents**: Both Recall competition and Vincent social trading agents
- ✅ **Vincent Framework Integration**: App ID 827 with real consent flow and policy enforcement
- ✅ **Hybrid Dashboard**: Unified interface for both agent types with DRY architecture
- ✅ **Real API Integration**: No mocks - using actual Recall clients and Vincent tools
- ✅ **Clean Production Build**: No sample data creation on startup

## 🚀 Key Features

- **🔍 On-Chain Agent Governance**: Immutable policy storage and verifiable decision logs
- **🤖 Dual AI Trading Agents**:
  - **Recall Competition Agent**: 24/7 trading in live competitions with technical analysis
  - **Vincent Social Trading Agent**: Sentiment-driven trading with community governance
- **💼 Governance Showcase Marketplace**: Interactive demonstrations of policies in action
- **🛡️ Filecoin Integration**: FVM smart contracts and USDFC payments
- **🌐 Web3 Primitives**: Decentralized identity and immutable audit trails

## 🤖 AI Trading Agents

Cognivern showcases two distinct AI trading agents, each demonstrating different approaches to autonomous trading with governance oversight:

### 🏆 Recall Competition Agent

- **Purpose**: High-frequency trading optimized for competition performance
- **Strategy**: Technical analysis, market data, and algorithmic trading
- **Governance**: Platform-defined policies with performance tracking
- **Competition**: Active participant in Recall's 7 Day Trading Challenge

### 🧠 Vincent Social Trading Agent

- **Purpose**: Sentiment-driven trading with community-defined guardrails
- **Vincent App ID**: `827` (public app identifier)
- **Strategy**: Social media sentiment analysis (Twitter, Reddit, News)
- **Governance**: User-controlled policies (spending limits, token allowlists, time restrictions)
- **Framework**: Built on Vincent Framework with Lit Protocol for secure execution

### 🎯 Unified Dashboard

Both agents are managed through a single, hybrid dashboard that demonstrates:

- **DRY Architecture**: 80% code reuse between agent types
- **Real-time Monitoring**: Live performance metrics and trade history
- **Policy Management**: User-configurable governance rules
- **Consent Flows**: Secure authorization with Vincent Framework
- **Audit Trails**: Complete governance logging to Filecoin

## 🔧 Quick Start

### Prerequisites

- Node.js v22.11.0 or higher
- pnpm v9.15.4 or higher
- Recall account with available credits

### Installation

```bash
# Clone the repository
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern

# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the platform
pnpm start
```

### Configuration

Create a `.env` file with the following variables:

```bash
# Deployment Environment
NODE_ENV=production
PORT=10000

# Development Features (set to 'true' only in development)
CREATE_SAMPLE_POLICIES=false

# Filecoin Blockchain Configuration
FILECOIN_PRIVATE_KEY=your_private_key_here
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1

# Deployed Smart Contract Addresses (Calibration Testnet)
GOVERNANCE_CONTRACT_ADDRESS=0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880
STORAGE_CONTRACT_ADDRESS=0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada
USDFC_TOKEN_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9

# Recall Network Configuration
RECALL_API_KEY=your_recall_api_key_here
RECALL_TRADING_API_KEY=your_recall_trading_api_key_here
RECALL_TRADING_BASE_URL=https://api.sandbox.competitions.recall.network

# Vincent Social Trading Agent
VINCENT_RECALL_API_KEY=your_vincent_recall_api_key_here
VINCENT_APP_ID=827
VINCENT_MANAGEMENT_WALLET=your_vincent_management_wallet_here
VINCENT_DELEGATEE_PRIVATE_KEY=your_vincent_delegatee_private_key_here

# Security Configuration
API_KEY=your_production_api_key_here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

**Note**: Copy from `.env.example` for complete configuration template.

⚠️ **Security Warning**:

- Never commit real API keys to version control
- The `.env` file is git-ignored for security
- Only placeholder values should exist in `.env.example`
- Keep your trading API keys private - anyone with access can execute trades

## 🤖 Autonomous Trading Agent

Cognivern includes a fully autonomous AI trading agent that operates 24/7 in live trading competitions, demonstrating real-world governance capabilities:

### 🏆 Competition Participation

- **Active Competition**: Recall Network's 7 Day Trading Challenge (July 8-15, $10,000 prize pool)
- **Trading Frequency**: 6 trades per day (every 4 hours) - exceeds 3+ daily requirement
- **Trading Strategies**: 6 different momentum and diversification strategies
- **Current Status**: ✅ Live and executing trades autonomously

### 📈 Trading Performance

- **Real-time Execution**: Direct API integration with Recall's trading simulator
- **Portfolio Management**: Multi-token portfolio (USDC, SOL, ETH, BTC)
- **Risk Management**: Automated position sizing and profit-taking strategies
- **Governance Integration**: All trades logged and monitored through governance framework

### 🔧 Technical Implementation

- **Direct API Trading**: Bypasses complex MCP setup for reliable execution
- **Server Deployment**: Runs on dedicated Hetzner server for 24/7 uptime
- **Rate Limit Handling**: Respects API limits (60 read/20 write/10 account ops per minute)
- **Error Recovery**: Robust retry logic with exponential backoff

### 📊 Monitoring

- **Live Dashboard**: Real-time trading metrics visible in governance platform
- **Transaction Logs**: All trades recorded with full audit trail
- **Performance Tracking**: Portfolio value and trade success rates
- **Governance Compliance**: Automated policy enforcement on trading decisions

The trading agent serves as a practical demonstration of how AI agents can operate autonomously while remaining under governance oversight, showcasing the platform's real-world applicability.

## 📊 Basic Usage

### Monitor an Agent

```typescript
import { GovernanceMonitor } from "cognivern";

const monitor = new GovernanceMonitor({
  agentId: "financial-advisor-1",
  policyName: "financial-advisory",
  recallBucket: "0xff0000000000000000000000000000000000fba1",
});

monitor.attach(myExistingAgent);
await monitor.startMonitoring();
```

### Create a Policy

```typescript
const policyService = new PolicyService();
await policyService.createPolicy(
  "resource-control",
  "Resource usage limits",
  rules
);
```

## � API Endpoints

### Trading Agent APIs

#### Recall Competition Agent

- `GET /api/agents/recall/decisions` - Get trading decisions
- `GET /api/agents/recall/status` - Get agent status and performance
- `POST /api/agents/recall/start` - Start the trading agent
- `POST /api/agents/recall/stop` - Stop the trading agent

#### Vincent Social Trading Agent

- `GET /api/agents/vincent/decisions` - Get sentiment-based trading decisions
- `GET /api/agents/vincent/status` - Get agent status and Vincent framework status
- `POST /api/agents/vincent/start` - Start the social trading agent
- `POST /api/agents/vincent/stop` - Stop the social trading agent
- `POST /api/agents/vincent/policies` - Update user-defined trading policies
- `POST /api/agents/vincent/consent` - Grant Vincent framework consent

#### Vincent Framework Integration

- `GET /api/vincent/callback` - Handle Vincent consent flow callback

### Governance APIs

- `GET /api/policies` - List all governance policies
- `POST /api/policies` - Create new governance policy
- `GET /api/policies/:id` - Get specific policy details
- `PUT /api/policies/:id` - Update existing policy
- `DELETE /api/policies/:id` - Delete policy

All API endpoints require the `X-API-KEY` header for authentication.

## �📚 Documentation

For more detailed information, please refer to the following documentation:

- [**AGENT.md**](docs/AGENT.md) - Detailed information about the agent system, capabilities, and roadmap
- [**HACKATHON.md**](docs/HACKATHON.md) - Hackathon submission details, implementation plan, and demo setup
- [**TECHNICAL.md**](docs/TECHNICAL.md) - Technical documentation, core services, data types, and environment setup
- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) - Clean architecture implementation, layers, and migration strategy
- [**SECURITY.md**](docs/SECURITY.md) - Security guidelines, API key management, and best practices

## 🛠️ Project Structure

The project has been organized with a clean directory structure:

- `config/` - Configuration files (eslint, prettier, hardhat, tsconfig, etc.)
- `data/` - Data files and sample metrics
- `build/` - Build artifacts and cache for contracts
- `dist/` - Compiled TypeScript output (generated during build)
- `src/` - Source code for the application
- `docs/` - Project documentation
- `scripts/` - Utility scripts for deployment and maintenance

## 🗺️ Current Status

- ✅ Clean architecture implementation for Policy domain complete
- ✅ Agent metrics successfully stored in Recall buckets
- ✅ Dashboard displaying real metrics from Recall storage
- ✅ Policy lifecycle management with status tracking
- ✅ Real-time policy enforcement with multiple rule types
- ✅ WebSocket-based real-time updates for policy changes

## 📜 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

## 🙏 Acknowledgements

- **Recall Network** for providing the decentralized intelligence layer
- **OpenAI** for advanced language model capabilities
- **The AI governance community** for valuable insights and feedback
