# Sapience Forecasting Agent (Cognivern)

An automated forecasting and trading agent built for the **Sapience Prediction Market Protocol**. This agent leverages on-chain attestation via EAS (Ethereum Attestation Service) on Arbitrum and executes trades on the Ethereal network.

## 🌟 Overview

Cognivern is a specialized AI agent designed to participate in prediction markets. It autonomously:
1.  **Analyzes Markets:** Ingests market data to generate probabilistic forecasts.
2.  **Attests Forecasts:** Publishes forecasts on-chain using EAS on Arbitrum One.
3.  **Executes Trades:** Takes positions in markets on the Ethereal network using USDe.

Built using the `@sapience/sdk`, this project demonstrates a modular agent architecture capable of complying with governance policies while participating in decentralized finance.

## 🚀 Key Features

*   **📈 Automated Forecasting:** Generates probability estimates for binary outcome markets.
*   **🔗 On-Chain Attestation:** Uses the Sapience SDK to submit verifiable forecasts to the Arbitrum blockchain.
*   **🛡️ Policy Enforcement:** Integrated governance module ensures agent actions (forecasts/trades) comply with risk parameters.
*   **🏗️ Modular Architecture:** Clean separation of concerns between domain logic, infrastructure, and application layers.

## 🔧 Quick Start

### Prerequisites
*   Node.js v18+
*   pnpm
*   Arbitrum RPC URL
*   Private Key with ETH (Arbitrum) for gas

### Installation

```bash
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern
pnpm install
```

### Configuration

Copy the example configuration and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Sapience / Arbitrum Configuration
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=your_private_key_here

# Security
API_KEY=your_api_key
```

### Running the Agent

**Development Mode:**
```bash
pnpm dev
```

**Production Build:**
```bash
pnpm build
pnpm start
```

## 🏗️ Architecture

### Backend
*   **`src/services/SapienceService.ts`**: Core integration with Sapience SDK. Handles EAS attestations and Ethereal provider connections.
*   **`src/services/GovernanceAgent.ts`**: The "brain" of the agent, managing thought processes and decision making.
*   **`src/modules/agents`**: Contains the `SapienceTradingAgent` implementation.
*   **`src/modules/api`**: REST API with health checks and agent monitoring endpoints.

### Frontend
*   **`src/frontend/src/components/dashboard/ModernDashboard.tsx`**: Main dashboard displaying system health and agent status.
*   **`src/frontend/src/components/auth/Web3Auth.tsx`**: Wallet connection (MetaMask, etc.) with Arbitrum One auto-switching.
*   **`src/frontend/src/components/ui/ConnectionStatus.tsx`**: Connection status indicator with retry mechanism.
*   **`src/frontend/src/services/apiService.ts`**: API client with exponential backoff retry logic.

## 🔗 Frontend Features

- **Sapience Branding**: Dashboard aligned to Sapience forecasting agent
- **Wallet Integration**: Connects to Arbitrum One via Web3Auth
- **Error Handling**: Graceful failures with retry buttons (no mock data masks problems)
- **Connection Status**: Persistent badge showing API connectivity
- **API Resilience**: 3-attempt retry with exponential backoff on network failures

## 🚀 Running the App

### Backend
```bash
pnpm build
PORT=3000 pnpm start
# API available at http://localhost:3000
```

### Frontend (Development)
```bash
cd src/frontend
pnpm dev
# Frontend available at http://localhost:5173
```

### Frontend (Production)
```bash
cd src/frontend
pnpm build
# Build output in dist/
```

## 🧪 Testing

```bash
# Backend tests
curl http://localhost:3000/health
curl http://localhost:3000/api/system/health -H "X-API-KEY: development-api-key"
curl http://localhost:3000/api/agents/monitoring -H "X-API-KEY: development-api-key"
```

## 📜 License

MIT