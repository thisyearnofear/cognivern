# Sapience Integration Guide

This document explains how Cognivern integrates with the Sapience prediction market protocol for the hackathon submission.

## Overview

Cognivern participates in Sapience prediction markets by:
1. Fetching active market conditions via GraphQL
2. Generating probabilistic forecasts using LLMs
3. Submitting forecasts as EAS attestations on Arbitrum
4. Tracking accuracy via Brier Score on the leaderboard

## Architecture

### Frontend Integration

**Components:**
- `src/frontend/src/components/sapience/SapienceMarkets.tsx` - Main markets UI
- `src/frontend/src/hooks/useSapienceData.ts` - React hook for data fetching
- `src/frontend/src/services/sapienceApi.ts` - GraphQL client

**Data Flow:**
```
Sapience GraphQL API
        ↓
useSapienceData Hook (auto-refresh every 60s)
        ↓
SapienceMarkets Component
        ↓
User sees: Live markets, stats, leaderboard
```

### Backend Integration

**Services:**
- `src/services/SapienceService.ts` - Core SDK integration
- `src/modules/agents/implementations/SapienceTradingAgent.ts` - Agent logic

**Forecast Submission Flow:**
```
1. Agent analyzes market condition
2. GovernanceAgent validates decision
3. SapienceService.submitForecast()
4. @sapience/sdk creates EAS attestation
5. Transaction submitted to Arbitrum
6. Forecast recorded on-chain
7. Reasoning stored in Recall (optional)
```

## GraphQL Queries

### Fetch Active Conditions

```graphql
query Conditions($nowSec: Int, $limit: Int) {
  conditions(
    where: { 
      public: { equals: true }
      endTime: { gt: $nowSec }
    }
    take: $limit
    orderBy: { endTime: asc }
  ) {
    id
    question
    shortName
    endTime
    startTime
    outcomeSlotCount
    public
  }
}
```

### Fetch Leaderboard

```graphql
query Leaderboard($limit: Int) {
  leaderboard(
    orderBy: { brierScore: asc }
    take: $limit
  ) {
    address
    brierScore
    forecastCount
  }
}
```

## SDK Usage

### Submit Forecast

```typescript
import { submitForecast } from '@sapience/sdk';

const result = await submitForecast({
  conditionId: '0x1234...' as `0x${string}`,
  probability: 75, // 0-100
  comment: 'AI-generated reasoning',
  privateKey: process.env.SAPIENCE_PRIVATE_KEY as `0x${string}`,
});

console.log(`Attestation tx: ${result.hash}`);
```

### Access Contract Addresses

```typescript
import { contracts } from '@sapience/sdk/contracts';

const pmAddress = contracts.predictionMarket[5064014].address; // Ethereal
const vaultAddress = contracts.passiveLiquidityVault[5064014].address;
const easAddress = contracts.eas[42161].address; // Arbitrum
```

## Environment Variables

Required for Sapience integration:

```env
# Arbitrum (for EAS attestations)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=0x...

# Ethereal (for trading)
ETHEREAL_RPC_URL=https://mainnet.ethereal.xyz/rpc

# LLM Provider (for forecast generation)
OPENROUTER_API_KEY=sk-or-...
```

## Forecast Generation

### LLM Prompt Template

```typescript
const prompt = `You are a forecaster. Estimate the probability (0-100) that the answer to this question is YES.

Question: "${question}"

First, provide brief reasoning (1-2 sentences, under 160 characters total, no URLs or citations).
Then on the final line, output ONLY the probability as a number (e.g., "75").`;
```

### Response Parsing

```typescript
const response = await llm.generate(prompt);
const lines = response.split('\n').filter(line => line.trim());
const probability = parseInt(lines[lines.length - 1].replace(/[^0-9]/g, ''), 10);
const reasoning = lines.slice(0, -1).join(' ').trim();
```

## Governance Integration

Before submitting a forecast, Cognivern's governance layer validates:

1. **Risk Limits** - Probability within acceptable bounds
2. **Confidence Threshold** - Minimum confidence level met
3. **Rate Limiting** - Not exceeding submission frequency limits
4. **Policy Compliance** - Adheres to configured governance rules

```typescript
// Example governance check
const isAllowed = await governanceAgent.validateForecast({
  conditionId,
  probability,
  confidence,
  reasoning,
});

if (!isAllowed) {
  throw new Error('Forecast rejected by governance policy');
}
```

## Recall Memory Integration

After submitting a forecast, store the reasoning on Recall Network:

```typescript
import { RecallClient } from '@recallnet/sdk';

await recallClient.store({
  type: 'forecast_reasoning',
  conditionId,
  probability,
  reasoning,
  timestamp: Date.now(),
  txHash: result.hash,
});
```

This enables:
- **Persistent Memory** - Agent can reference past forecasts
- **Continuous Learning** - Analyze what worked/didn't work
- **AgentRank™** - Build reputation on Recall Network

## Brier Score Calculation

Sapience uses an **inverted, horizon-weighted Brier Score**:

```
Brier Score = (1/N) * Σ(forecast - outcome)²

Where:
- forecast = probability (0-1)
- outcome = actual result (0 or 1)
- Lower score = better accuracy
```

**Horizon Weighting:** Forecasts made further from resolution time receive more weight.

## Testing

### Local Development

```bash
# Start backend
pnpm build && pnpm start

# Start frontend
cd src/frontend && pnpm dev

# Visit http://localhost:5173 and navigate to Markets tab
```

### Manual Forecast Submission

```bash
# Using the backend API
curl -X POST http://localhost:3000/api/sapience/forecast \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: development-api-key" \
  -d '{
    "conditionId": "0x...",
    "probability": 75,
    "reasoning": "Test forecast"
  }'
```

## Deployment

### Arbitrum Mainnet

1. Fund wallet with ETH for gas
2. Set `ARBITRUM_RPC_URL` to mainnet
3. Deploy with production private key

### Ethereal Mainnet

1. Bridge USDe to Ethereal
2. Set `ETHEREAL_RPC_URL` to mainnet
3. Configure trading parameters

## Monitoring

### Dashboard Metrics

- **Active Markets** - Number of live conditions
- **Total Forecasts** - Platform-wide forecast count
- **Leaderboard Position** - Agent's rank by Brier Score
- **Forecast History** - Agent's past predictions

### Logs

```bash
# View forecast submissions
tail -f logs/sapience.log

# Monitor EAS attestations
tail -f logs/attestations.log
```

## Troubleshooting

### Common Issues

**"No active conditions found"**
- Check GraphQL endpoint is accessible
- Verify `endTime` filter is correct

**"Transaction failed"**
- Ensure wallet has sufficient ETH on Arbitrum
- Check gas price settings

**"Invalid probability"**
- Probability must be 0-100
- Check LLM response parsing

**"Leaderboard not updating"**
- Leaderboard refreshes every 2 minutes
- Check wallet address matches forecast submissions

## Resources

- [Sapience Documentation](https://docs.sapience.xyz)
- [Sapience SDK](https://github.com/sapiencexyz/sapience/tree/main/packages/sdk)
- [EAS Documentation](https://docs.attest.org)
- [Arbitrum RPC](https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers)

## Support

- [Sapience Discord](https://discord.gg/sapience)
- [GitHub Issues](https://github.com/thisyearnofear/cognivern/issues)
