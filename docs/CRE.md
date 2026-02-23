# Chainlink CRE Integration

## Overview

Cognivern is a **decentralized, consensus-verified prediction market agent** powered by Chainlink Runtime Environment (CRE). Every data fetch, LLM call, and on-chain write runs across a Decentralized Oracle Network (DON) with BFT consensus.

## Target Hackathon Tracks

| Track | Prize Pool | Fit |
| :--- | :--- | :--- |
| **AI Agents: DeFi & Web3** | $10,500 1st / $6,000 2nd | Primary |
| **AI Agents: Multi-agent** | $10,500 1st / $6,000 2nd | Secondary |
| **Grand Prize** | $35,000 | Stretch |

## Architecture: Before & After

### Before (Centralized)
```
[PM2 Cron] → [Single GraphQL] → [Single LLM] → [Single RPC]
     ↓            ↓                 ↓              ↓
  Single server  Endpoint         Provider        Node
```

### After (CRE-Powered)
```
[CRE Cron] → [HTTP Capability] → [Confidential HTTP] → [EVM Write]
     ↓            ↓                    ↓                  ↓
  Workflow DON  Consensus          Consensus          Consensus
  (scheduled)   (market data)      (LLM reasoning)    (attestation)
```

## CRE Workflow Design

### Workflow 1: Forecasting Pipeline (Core)

**Trigger:** `cron.Trigger` — fires every 10 minutes

**Callback Steps:**

1. **Fetch Markets** (`http.Client`) — Query Sapience GraphQL API. DON nodes reach consensus.
2. **Read On-Chain State** (`evm.Client.read`) — Read Chainlink Data Feeds (ETH/USD, BTC/USD).
3. **Generate Forecast** (`confidentialhttp.Client`) — Call LLM API within confidential enclave.
4. **Submit Attestation** (`evm.Client.write`) — Write EAS attestation to Arbitrum.

```typescript
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

    // Step 4: Generate forecast via Confidential HTTP
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

**Trigger:** `evm.Trigger` — fires on EAS attestation events

**Callback:** Monitors resolved markets, updates accuracy score. Stores results to Recall Network.

### Workflow 3: Risk Guardian (Stretch)

**Trigger:** `cron.Trigger` — fires every hour

**Callback:** Reads wallet balance, open positions, attestation count. Enforces governance policies.

## CRE Capabilities Used

| Capability | Purpose |
| :--- | :--- |
| **Cron Trigger** | Schedule forecasting cycles every 10 minutes |
| **HTTP Fetch** | Fetch Sapience market data with DON consensus |
| **Confidential HTTP** | Private LLM API calls (reasoning stays encrypted) |
| **EVM Read** | Read Chainlink Data Feeds, on-chain market state |
| **EVM Write** | Submit EAS attestations to Arbitrum |
| **Secrets** | Secure storage for API keys and private keys |

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
- [ ] Configure CRE secrets for API keys
- [ ] Implement Multi-LLM fallback within CRE callback
- [ ] Add EVM Write for EAS attestation submission

### Phase 3: Polish & Submission (Days 5-8)
- [ ] Deploy workflow to DON (or demonstrate simulation)
- [ ] Update frontend dashboard to show CRE workflow status
- [ ] Record demo video (≤5 min)
- [ ] Write submission README and documentation

## Key Differentiators

### 1. End-to-End Decentralization
Every step — data fetching, price reading, LLM reasoning, attestation — runs across a DON with BFT consensus. No single point of failure.

### 2. Chainlink Data Feeds as Inputs
Agent reads ETH/USD and BTC/USD price feeds via EVM Read, using real-time on-chain data to inform predictions.

### 3. Confidential AI Reasoning
LLM reasoning is private via Confidential HTTP — prevents front-running of predictions. API keys injected via CRE Secrets.

### 4. Multi-LLM Orchestration
Custom failover within CRE callback: Routeway.ai (Kimi K2) primary, Groq (Llama 3.3) fallback.

### 5. Horizon-Weighted Strategy
Agent calculates time-until-resolution and prioritizes markets with longest horizon for maximum accuracy scoring.

## Evidence of Prior Work

### Live On-Chain Activity
- **Agent Wallet:** `0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC`
- **Arbiscan:** [View EAS Attestations](https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC)
- **Proof of Accuracy:** Horizon-Weighted Strategy prioritizes long-horizon markets

### Real-Time Dashboard
Cognivern dashboard shows agent reasoning in real-time:
- Activity Feed shows live forecasts with Multi-LLM generated reasoning
- Multi-LLM Resilience: Primary (Routeway.ai Kimi K2) with automatic failover to Groq

## Judging Criteria Alignment

| Criteria | Evidence |
| :--- | :--- |
| **Technical Execution** | Production-grade agent with Multi-LLM resilience, governance guardrails, live on-chain history |
| **Effective Use of CRE** | 5 capabilities used meaningfully (cron, HTTP, confidential HTTP, EVM read, EVM write) |
| **Blockchain Technology** | EAS attestations on Arbitrum, Chainlink Data Feed consumption, consensus-verified writes |
| **Originality** | First prediction market agent with confidential AI reasoning via CRE |

## Testing the Integration

### Manual Testing
```bash
# Simulate CRE workflow locally
cre simulate forecasting

# View agent logs
pm2 logs cognivern-agent

# Check on-chain attestations
curl https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC
```

### Look for in Logs
```bash
[ForecastingService] Fetching optimal condition...
[ForecastingService] Selected market: "Will [X] happen?"
[ForecastingService] Trying provider: routeway
[ForecastingService] Forecast submitted! Tx: 0x...
```

## Resources

- [CRE Documentation](https://docs.chain.link/cre)
- [CRE Templates](https://github.com/smartcontractkit/cre-templates)
- [CRE Bootcamp 2026](https://smartcontractkit.github.io/cre-bootcamp-2026/)
- [CRE CLI Installation](https://docs.chain.link/cre/getting-started/cli-installation)
- [Chainlink Data Feeds (Arbitrum)](https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum)

## Related Docs

- **[Architecture](./ARCHITECTURE.md)** — System overview and design
- **[Developer Guide](./DEVELOPER.md)** — API reference and testing
- **[Deployment](./DEPLOYMENT.md)** — Release process and operations
