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

*   **`src/services/SapienceService.ts`**: Core integration with Sapience SDK. Handles EAS attestations and Ethereal provider connections.
*   **`src/services/GovernanceAgent.ts`**: The "brain" of the agent, managing thought processes, asset discovery (mocked/stubbed for hackathon), and decision making.
*   **`src/modules/agents`**: Contains the specific `SapienceTradingAgent` implementation.

## 📜 License

MIT