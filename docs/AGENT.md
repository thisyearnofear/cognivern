# Cognivern Agent System

## Mission & Vision

**Mission Statement**: "Showcase best-in-class decentralized AI governance for prediction markets, powered by Chainlink CRE — building trust in autonomous forecasting agents through consensus-verified operations."

### Core Value Propositions

1.  **Decentralized Consensus**: Every operation — data fetching, LLM reasoning, on-chain writes — verified by DON nodes via CRE.
2.  **Confidential AI**: LLM predictions execute in CRE's confidential enclaves, preventing front-running.
3.  **Trust & Transparency**: On-chain verifiable forecasts via Ethereum Attestation Service (EAS) with Chainlink Data Feed inputs.
4.  **Autonomous Forecasting**: 24/7 CRE-orchestrated market analysis and probability estimation.
5.  **Policy Enforcement**: Automated compliance with risk management rules enforced on-chain.

## Overview

Cognivern is a specialized forecasting agent built for **prediction markets**, powered by the **Chainlink Runtime Environment (CRE)**. Unlike centralized trading bots, Cognivern's entire prediction pipeline runs across Decentralized Oracle Networks — from market data ingestion to LLM reasoning to on-chain attestation. Every forecast is cryptographically signed, consensus-verified, and attested on Arbitrum One.

## Agent Capabilities

-   **CRE-Orchestrated Forecasting**: Cron-triggered workflows on Chainlink DON for scheduled market analysis.
-   **Probabilistic Forecasting**: Analyzes market questions and assigns probability estimates (0-100%).
-   **Confidential LLM Reasoning**: Private AI inference via CRE Confidential HTTP capability.
-   **Chainlink Data Feed Consumption**: Reads on-chain price data (ETH/USD, BTC/USD) as forecasting inputs.
-   **On-Chain Attestation**: Publishes forecasts to Arbitrum via consensus-verified EVM Write.
-   **Governance Compliance**: Validates actions against internal policy rules before execution.

## Agent Structure

### Core Components

-   **SapienceService**: The bridge to the blockchain. Handles EAS attestations and Ethereal contract interactions.
-   **GovernanceAgent**: The "brain" of the system. Manages the decision loop, generates thoughts, and maintains the context window.
-   **AgentsModule**: A modular wrapper that orchestrates the agent's lifecycle within the application.

### Decision Flow

1.  **Market Analysis**: The agent identifies an active market on the Sapience protocol.
2.  **Forecast Generation**: Based on available data, the agent calculates a probability (e.g., "75% chance ETH > $3000").
3.  **Policy Check**: The internal governance engine checks if the action allows for this trade size and risk level.
4.  **Attestation**: If approved, the forecast is submitted to Arbitrum via `SapienceService.submitForecast`.
5.  **Execution**: The agent may optionally take a financial position on Ethereal via `SapienceService.executeTrade`.

## Forecasting Agent

### 🤖 Agent Architecture

```typescript
class SapienceTradingAgent {
  // Configuration
  private readonly config: TradingAgentConfig;
  private readonly sapienceService: SapienceService;

  // Autonomous execution
  async executeTrade(decision: TradingDecision): Promise<TradeResult> {
    // 1. Check governance compliance
    const compliance = await this.checkCompliance(decision);
    if (!compliance.isCompliant) return { status: 'failed', ... };

    // 2. Submit forecast to Sapience (EAS Attestation)
    const txHash = await this.sapienceService.submitForecast({
      marketId: decision.symbol,
      probability: decision.confidence,
      reasoning: decision.reasoning
    });

    // 3. Log result
    return { status: 'executed', id: txHash, ... };
  }
}
```

### 📊 Performance Tracking

The agent's performance is tracked through:
-   **Brier Score**: Accuracy of probabilistic forecasts over time.
-   **PnL**: Profit and loss from trading positions on Ethereal.
-   **Attestation History**: Verifiable on-chain log of all predictions.

## Security Features

-   **Private Key Management**: Keys are stored in secure environment variables, never exposed in code.
-   **RPC Security**: Communication with Arbitrum and Ethereal nodes occurs over HTTPS.
-   **Policy Guardrails**: Hard-coded limits on trade size and frequency prevent runaway bot behavior.