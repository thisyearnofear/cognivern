# Chainlink CRE Integration Plan

## Overview

Cognivern pivots from a centralized AI forecasting agent into a **decentralized, consensus-verified prediction market agent** powered by the **Chainlink Runtime Environment (CRE)**. Every data fetch, every LLM call, and every on-chain write runs across a Decentralized Oracle Network (DON) with BFT consensus — eliminating single points of failure and making the agent's operations verifiable end-to-end.

## Target Hackathon Tracks

| Track | Prize Pool | Fit |
| :--- | :--- | :--- |
| **AI Agents** (DeFi & Web3) | $10,500 1st / $6,000 2nd | Primary — AI-powered prediction market agent consuming CRE workflows |
| **AI Agents** (Multi-agent & orchestration) | $10,500 1st / $6,000 2nd | Secondary — Multi-LLM orchestration with consensus-verified outputs |
| **Grand Prize** | $35,000 | Stretch — best overall use of Chainlink + sponsor tech |

## Why CRE + Cognivern?

Today, Cognivern runs as a centralized Node.js process:
- Market data fetched from a single GraphQL endpoint
- LLM reasoning via a single API call (with manual fallback)
- EAS attestation submitted via a single RPC connection

**With CRE**, each of these steps becomes decentralized:
- Market data fetched by **multiple DON nodes** with consensus on the result
- LLM calls executed via **Confidential HTTP** with privacy-preserving enclave execution
- On-chain writes performed through **EVM Write capability** with multi-node verification
- The entire pipeline orchestrated by a **cron-triggered CRE workflow**

## Architecture: Before & After

### Before (Centralized Agent)
```
[PM2 Cron Loop] → [Single GraphQL Fetch] → [Single LLM API Call] → [Single RPC Write]
     ↓                    ↓                        ↓                       ↓
  Single server      Single endpoint          Single provider         Single node
```

### After (CRE-Powered Agent)
```
[CRE Cron Trigger] → [HTTP Capability]    → [Confidential HTTP]  → [EVM Write]
     ↓                    ↓                        ↓                     ↓
  Workflow DON        DON consensus on       DON consensus on      DON consensus on
  (scheduled)         market data            LLM reasoning         attestation tx
```

## CRE Workflow Design

### Workflow 1: Forecasting Pipeline (Core)

**Trigger**: `cron.Trigger` — fires every 10 minutes

**Callback Steps**:
1. **Fetch Markets** (`http.Client`) — Query Sapience GraphQL API for active prediction markets. DON nodes independently fetch and reach consensus on available markets.
2. **Read On-Chain State** (`evm.Client.read`) — Read Chainlink Data Feeds for relevant price data (ETH/USD, BTC/USD) to inform predictions. Read existing attestation state.
3. **Generate Forecast** (`confidentialhttp.Client`) — Call LLM API (Routeway.ai / Groq) within a confidential enclave. The reasoning and API keys remain private; only the final probability output is shared with the DON.
4. **Submit Attestation** (`evm.Client.write`) — Write the EAS attestation to Arbitrum with the consensus-verified forecast.

```typescript
// Pseudocode — CRE TypeScript SDK
import { cre } from "@aspect-build/cre-sdk";
import { cron } from "@aspect-build/cre-sdk/triggers";
import { http, confidentialhttp, evm } from "@aspect-build/cre-sdk/capabilities";

cre.Handler(
  cron.Trigger({ schedule: "0 */10 * * * *" }), // Every 10 minutes
  async (config, runtime, trigger) => {
    const httpClient = http.Client(runtime);
    const evmClient = evm.Client(runtime);
    const confidentialClient = confidentialhttp.Client(runtime);

    // Step 1: Fetch active markets (consensus-verified)
    const marketsPromise = httpClient.fetch({
      url: "https://api.sapience.xyz/graphql",
      method: "POST",
      body: JSON.stringify({
        query: `query { conditions(where: { public: true }, take: 10) { id question endTime } }`
      }),
    });

    // Step 2: Read Chainlink price feeds (consensus-verified)
    const pricePromise = evmClient.read({
      chainId: 42161, // Arbitrum
      contractAddress: "0x...", // ETH/USD Data Feed
      method: "latestAnswer",
      abi: DATA_FEED_ABI,
    });

    // Await consensus results
    const [markets, price] = await Promise.all([marketsPromise, pricePromise]);

    // Step 3: Select optimal market (horizon-weighted strategy)
    const selectedMarket = selectByHorizon(markets.data.conditions);

    // Step 4: Generate forecast via Confidential HTTP (private LLM call)
    const forecast = await confidentialClient.fetch({
      url: "https://api.routeway.ai/v1/chat/completions",
      method: "POST",
      headers: { Authorization: "Bearer {{secrets.ROUTEWAY_API_KEY}}" },
      body: JSON.stringify({
        model: "kimi-k2-0905",
        messages: [{ role: "user", content: buildPrompt(selectedMarket, price) }],
      }),
    });

    // Step 5: Submit EAS attestation (consensus-verified write)
    await evmClient.write({
      chainId: 42161,
      contractAddress: EAS_CONTRACT,
      method: "attest",
      abi: EAS_ABI,
      args: [encodeForecast(selectedMarket, forecast)],
    });
  }
);
```

### Workflow 2: Market Resolution Monitor (Stretch)

**Trigger**: `evm.Trigger` — fires on EAS attestation events

**Callback**: Monitors resolved markets and updates the agent's accuracy score. Stores results to Recall Network for persistent memory.

### Workflow 3: Risk Guardian (Stretch)

**Trigger**: `cron.Trigger` — fires every hour

**Callback**: Reads the agent's wallet balance, open positions, and recent attestation count. Enforces governance policies (max daily forecasts, minimum ETH balance for gas).

## Implementation Phases

### Phase 1: Core CRE Workflow (Days 1-3)
- [ ] Install CRE CLI and set up project structure
- [ ] Build Workflow 1 (Forecasting Pipeline) in TypeScript
- [ ] Integrate Sapience GraphQL fetch via HTTP capability
- [ ] Integrate Chainlink Data Feeds via EVM Read
- [ ] Simulate workflow locally with `cre simulate`
- [ ] Request Early Access for deployment

### Phase 2: Confidential LLM Integration (Days 3-5)
- [ ] Integrate Confidential HTTP for private LLM calls
- [ ] Configure CRE secrets for API keys (ROUTEWAY_API_KEY, GROQ_API_KEY)
- [ ] Implement Multi-LLM fallback within the CRE callback
- [ ] Add EVM Write for EAS attestation submission

### Phase 3: Polish & Submission (Days 5-8)
- [ ] Deploy workflow to DON (or demonstrate simulation)
- [ ] Update frontend dashboard to show CRE workflow status
- [ ] Record demo video (≤5 min)
- [ ] Write submission README and documentation
- [ ] Stretch: Implement Workflows 2 & 3

## CRE Capabilities Used

| Capability | Purpose in Cognivern |
| :--- | :--- |
| **Cron Trigger** | Schedule forecasting cycles every 10 minutes |
| **HTTP Fetch** | Fetch Sapience market data with DON consensus |
| **Confidential HTTP** | Private LLM API calls (reasoning stays encrypted) |
| **EVM Read** | Read Chainlink Data Feeds, on-chain market state |
| **EVM Write** | Submit EAS attestations to Arbitrum |
| **Secrets** | Secure storage for API keys and private keys |

## Key Differentiators for Judges

1. **Real Use Case**: Not a demo — Cognivern has live on-chain attestations on Arbitrum from the Sapience hackathon.
2. **Meaningful CRE Usage**: Every step of the prediction pipeline benefits from decentralized consensus.
3. **Confidential AI**: LLM reasoning is private via Confidential HTTP — prevents front-running of predictions.
4. **Data Feed Integration**: Uses Chainlink's own price feeds as inputs to the forecasting model.
5. **Production Architecture**: Multi-LLM resilience, horizon-weighted strategy, governance guardrails.

## Resources

- [CRE Documentation](https://docs.chain.link/cre)
- [CRE Templates Repository](https://github.com/smartcontractkit/cre-templates)
- [CRE Bootcamp 2026](https://smartcontractkit.github.io/cre-bootcamp-2026/)
- [CRE CLI Installation](https://docs.chain.link/cre/getting-started/cli-installation)
- [Chainlink Data Feeds (Arbitrum)](https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum)
