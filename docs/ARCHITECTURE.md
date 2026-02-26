# Architecture & Overview

## Mission

**Make agent systems operable: every run is observable, auditable, and (when needed) provable.**

Cognivern is an **AI Governance Command Center** — a coordination and coordination layer that turns agent runs into something you can operate, audit, and bill.

## Core Value Propositions

1. **Multi-Chain Governance**: Leveraging **Filecoin (FVM)** for verifiable forensic evidence and **Polkadot Hub (REVM/PVM)** for high-performance coordination.
2. **Confidential AI**: LLM reasoning executes in confidential enclaves, ensuring private decision-making.
3. **Agentic UX**: A high-fidelity, spatial HUD for visualizing agent networks, cognitive paths, and behavioral compliance.
4. **Verifiable Intent**: On-chain proof of decision-making process, moving beyond simple result tracking.
5. **Real-Time Guardrails**: Low-latency policy enforcement that scales with autonomous agent speeds.

## System Architecture

Cognivern utilizes a hybrid multi-chain architecture to balance high-fidelity evidence with high-performance execution:

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Agent Runtime  │ ───→  │    Cognivern     │ ───→  │  Ecosystem Visual│
│ (User's Agents)  │       │   Control Plane  │       │      (Frontend)  │
└──────────────────┘       └────────┬─────────┘       └──────────────────┘
                                    │
                                    ▼
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
      ┌──────────────────┐                  ┌──────────────────┐
      │  Filecoin (FVM)  │                  │   Polkadot Hub   │
      │                  │                  │    (REVM/PVM)    │
      ├──────────────────┤                  ├──────────────────┤
      │ Forensic Storage │                  │ Real-Time Gov.   │
      │ + Evidence Proof │                  │ + Coordination   │
      └──────────────────┘                  └──────────────────┘
```

## Two-Plane Design

Cognivern separates concerns into two planes:

### Data Plane (`/ingest/*`)
- High-volume write path for agent run ingestion
- Ingest-key authentication (`Authorization: Bearer <ingestKey>`)
- Project-scoped via `X-PROJECT-ID` header
- Accepts `CreRun` objects with steps + artifacts

### Control Plane (`/api/*`)
- UI + admin APIs
- API key authentication (OAuth/RBAC in future)
- Run ledger queries, usage reporting, token telemetry

## Core Components

### Application Layer
- **Agent Controller**: Handles incoming requests and orchestrates workflows
- **Agentic UI/UX**:
    - **Intent-Driven Bridge**: Natural language interface with Generative UI responses (`StatCard`, `ForensicTimeline`, `ActionForm`)
    - **Ecosystem Visualizer**: Spatial, interactive HUD for network state
    - **Forensic Transparency**: High-fidelity cognitive path reconstruction
    - **Unified Dashboard**: Real-time view of agent thoughts, actions, and metrics

### Domain Layer
- **Governance Engine**: Centralized policy management (`governanceStore`) with visual safety scores
- **Governance Agent**: Maintains thought history, logs actions, enforces policies
- **Policy Service**: Validates actions against risk management rules
- **Trading Agent**: Executes forecasting and trading strategies

### Infrastructure Layer
- **SapienceService**: EAS attestations, Ethereal contract interactions
- **Chainlink Integration**: Data Feeds (EVM Read), CRE workflows, EVM Write
- **Recall Network**: Persistent memory for agent reasoning

## Agent Structure

```typescript
class SapienceTradingAgent {
  private readonly config: TradingAgentConfig;
  private readonly sapienceService: SapienceService;

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

## Decision Flow

1. **Market Analysis**: Identify active markets on Sapience protocol
2. **Forecast Generation**: Calculate probability (0-100%) based on available data
3. **Policy Check**: Governance engine validates trade size and risk level
4. **Attestation**: Submit forecast to Arbitrum via `SapienceService.submitForecast`
5. **Execution**: Optionally take position on Ethereal via `SapienceService.executeTrade`
6. **Memory**: Store reasoning to Recall Network for auditability

## Trading Strategy

### Horizon-Weighted Market Selection
Cognivern optimizes for accuracy scoring by prioritizing markets with the longest time until resolution:

1. Batch fetch up to 50 active conditions from GraphQL API
2. Calculate `Time Until Resolution` for each market
3. Sort markets by horizon (furthest `endTime` first)
4. Submit forecasts to highest-value markets first

### Multi-LLM Resilience
```
Tier 1 (Primary): Routeway.ai — Kimi K2 0905 (best reasoning)
                      ↓ (on timeout/5xx)
Tier 2 (Fallback): Groq — Llama 3.3 70B (ultra-fast)
```

Both execute within CRE Confidential HTTP — API keys and reasoning stay private.

## Performance Tracking

- **Brier Score**: Accuracy of probabilistic forecasts (horizon-weighted)
- **PnL**: Profit/loss from Ethereal trading positions
- **Attestation History**: Verifiable on-chain log of all predictions
- **Operational Metrics**: Uptime, latency, success rate, error rate

## Data Persistence

Local-first persistence (survives restarts, no database required):

- **Runs**: `data/cre-runs.jsonl` (append-only JSONL)
- **Quota Usage**: `data/usage.json`
- **Token Telemetry**: `data/token-telemetry.json`

## Configuration

Centralized config with Zod validation (`src/shared/config/index.ts`):

```env
# Required
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=your_private_key

# LLM Layer
ROUTEWAY_API_KEY=your_routeway_key
GROQ_API_KEY=your_groq_key

# Memory
RECALL_API_KEY=your_recall_key
RECALL_BUCKET=agent-memory
```

## Security Features

- **Private Key Management**: Keys in environment variables, never in code
- **RPC Security**: HTTPS communication with Arbitrum/Ethereal nodes
- **Policy Guardrails**: Hard-coded limits on trade size and frequency
- **Input Validation**: Zod schemas validate all configuration and inputs
- **Rate Limiting**: Per-project quotas with usage headers

## Monitoring & Observability

### Key Metrics
- API response time (p50, p95, p99)
- Cache hit rate
- Filter application time
- Agent uptime and latency
- Forecast accuracy (Brier Score)

### Logging Strategy
```typescript
logger.info('Forecast submitted', { marketId, probability, txHash });
logger.error('Policy violation', { action, reason, agentId });
logger.warn('LLM fallback triggered', { provider, error });
```

## Live On-Chain Activity

- **Agent Wallet**: `0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC`
- **Arbiscan**: [View EAS Attestations](https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC)
- **Proof of Accuracy**: Horizon-Weighted Strategy prioritizes long-horizon markets

## Related Docs

- **[Developer Guide](./DEVELOPER.md)** — API reference, adding features, testing
- **[CRE Integration](./CRE.md)** — Chainlink workflow design and implementation
- **[Deployment](./DEPLOYMENT.md)** — Release process, rollback, operations
