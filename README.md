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

**🚀 PRODUCTION READY - 90% DECENTRALIZED**

- ✅ **Smart Contracts Deployed**: Live on Filecoin Calibration testnet
- ✅ **Real Blockchain Integration**: All core services using on-chain data
- ✅ **Governance Contract**: `0xa226c82f1b6983aBb7287Cd4d83C2aEC802A183F`
- ✅ **Storage Contract**: `0xA78d4FcDaee13A11c11AEaD7f3a68CD15E8CB722`

## 🚀 Key Features

- **🔍 On-Chain Agent Governance**: Immutable policy storage and verifiable decision logs
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
# Recall Configuration
RECALL_PRIVATE_KEY="your-private-key"
RECALL_BUCKET_ADDRESS="YOUR_BUCKET_ADDRESS"
RECALL_NETWORK="testnet"

# Governance Configuration
DEFAULT_POLICY="standard"
AUDIT_FREQUENCY="daily"
```

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
