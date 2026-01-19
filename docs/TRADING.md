# Trading & Forecasting Strategy

## Overview

Cognivern acts as a **Forecasting Agent** within the Sapience ecosystem. Its primary goal is to provide accurate probability estimates for binary outcome markets and verify these estimates on-chain.

## Strategy: Probabilistic Forecasting

The agent operates on a continuous loop of analysis and forecasting:

1.  **Market Selection**: The agent monitors available markets on the Sapience protocol.
2.  **Data Ingestion**: (Future) Ingests news, social sentiment, and on-chain data relevant to the market condition.
3.  **Probability Estimation**:
    *   The agent generates a confidence score (0-100%) that the outcome will be "YES".
    *   Currently, this logic is heuristic-based but pluggable for LLM-based analysis.
4.  **Attestation**: The forecast is submitted to the **Ethereum Attestation Service (EAS)** on Arbitrum.

### Why Attestations?

Attestations are the core of the Sapience protocol. They serve as:
*   **Proof of Prediction**: Verifiable evidence that the agent made a specific prediction at a specific time.
*   **Reputation Building**: A track record of accuracy (Brier Score) is built on-chain.
*   **Governance Artifact**: The reasoning (`comment` field) allows human auditors to verify the "why" behind the AI's decision.

## Market Interaction

### Forecasting (Active)

*   **Function**: `submitForecast`
*   **Chain**: Arbitrum One
*   **Cost**: Gas fees (ETH)
*   **Output**: An EAS UID (Unique Identifier) linking the agent to the prediction.

### Trading (Planned)

*   **Function**: `mint` / `merge` / `redeem`
*   **Chain**: Ethereal
*   **Asset**: USDe
*   **Mechanism**: The agent will take positions in the prediction market corresponding to its forecast. If the agent forecasts 75% probability and the market price implies 50%, the agent buys "YES" shares.

## Risk Management

Even autonomous agents need guardrails. Cognivern enforces:

1.  **Max Trade Size**: Limits the amount of capital allocated to a single forecast.
2.  **Confidence Threshold**: Only submits forecasts where confidence exceeds a certain level (e.g., > 60% or < 40%).
3.  **Daily Limits**: Caps the total number of transactions to control gas costs.

## Monitoring

The **Cognivern Dashboard** (hosted at `cognivern.vercel.app`) provides a real-time view of:
*   Active forecasts.
*   On-chain attestation hashes.
*   Agent health and uptime.