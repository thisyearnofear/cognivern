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
- ✅ **Recall Trading API**: Integrated with real competition endpoints
- ✅ **Autonomous Trading Agent**: Live 24/7 trading in Recall's 7 Day Challenge
- ✅ **Clean Production Build**: No sample data creation on startup

## 🚀 Key Features

- **🔍 On-Chain Agent Governance**: Immutable policy storage and verifiable decision logs
- **🤖 Autonomous Trading Agent**: 24/7 AI trading agent participating in live competitions
- **💼 Governance Showcase Marketplace**: Interactive demonstrations of policies in action
- **🛡️ Filecoin Integration**: FVM smart contracts and USDFC payments
- **🌐 Web3 Primitives**: Decentralized identity and immutable audit trails

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

# Security Configuration
API_KEY=your_production_api_key_here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

**Note**: Copy from `.env.example` for complete configuration template.

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

## 📚 Documentation

For more detailed information, please refer to the following documentation:

- [**AGENT.md**](docs/AGENT.md) - Detailed information about the agent system, capabilities, and roadmap
- [**HACKATHON.md**](docs/HACKATHON.md) - Hackathon submission details, implementation plan, and demo setup
- [**TECHNICAL.md**](docs/TECHNICAL.md) - Technical documentation, core services, data types, and environment setup
- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) - Clean architecture implementation, layers, and migration strategy

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
