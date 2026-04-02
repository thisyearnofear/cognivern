# Architecture & Overview

## Mission

**Make agent systems operable: every run is observable, auditable, and (when needed) provable.**

Cognivern is an **AI Governance Command Center** — a coordination and coordination layer that turns agent runs into something you can operate, audit, and bill.

## Core Value Propositions

1. **Multi-Chain Governance**: Leveraging **Filecoin (FVM)** for verifiable forensic evidence and **Polkadot Hub (REVM/PVM)** for high-performance coordination.
2. **Confidential AI**: LLM reasoning executes in confidential enclaves, ensuring private decision-making.
3. **Voice of Governance**: High-quality AI audio briefings powered by **ElevenLabs**, synthesizing agent thoughts and actions into conversational summaries.
4. **Agentic UX**: A high-fidelity, spatial HUD for visualizing agent networks, cognitive paths, and behavioral compliance.
5. **Verifiable Intent**: On-chain proof of decision-making process, moving beyond simple result tracking.
6. **Real-Time Guardrails**: Low-latency policy enforcement using stateful **Cloudflare Durable Objects** for edge-native governance.

## System Architecture

Cognivern utilizes a Cloudflare-native, hybrid multi-chain architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers Edge                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         GovernanceAgent (Durable Object)                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  Persistent  │  │   Policy     │  │   Voice      │  │   │
│  │  │  State (DO)  │  │   Engine     │  │   Briefing   │  │   │
│  │  │  - thoughts  │  │  - evaluate  │  │  - AI script │  │   │
│  │  │  - actions   │  │  - enforce   │  │  - ElevenLabs│  │   │
│  │  │  - metrics   │  │  - rate limit│  │  - streaming │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌──────────┐   ┌───────┴───────┐   ┌──────────────────┐      │
│  │ D1 DB    │   │ Workers AI    │   │ Cron Triggers    │      │
│  │ agents,  │   │ (on-edge      │   │ (hourly audits,  │      │
│  │ policies,│   │  inference)   │   │  cleanup)        │      │
│  │ audits   │   └───────────────┘   └──────────────────┘      │
│  └──────────┘                                                  │
└─────────────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────┐
    │ Arbitrum/EAS │ │  Recall  │ │ Filecoin │
    │ Attestations │ │  Memory  │ │ Forensic │
    └──────────────┘ └──────────┘ └──────────┘
```

## Two-Plane Design

Cognivern separates concerns into two planes:

### Data Plane (`/ingest/*`)

- High-volume write path for agent run ingestion.
- Ingest-key authentication (`Authorization: Bearer <ingestKey>`).
- Project-scoped via `X-PROJECT-ID` header.
- Multi-chain data anchoring (Polkadot Hub for coordination, Filecoin for forensics).

### Control Plane (`/api/*`)

- UI + admin APIs.
- Real-time ecosystem visualization and forensic timeline reconstruction.
- Behavioral governance management and policy orchestration.

## Core Components

### Application Layer

- **Agent Controller**: Handles incoming requests and orchestrates workflows
- **Voice of Governance**: Edge-native service integrating ElevenLabs for high-fidelity audio briefings.
- **Agentic UI/UX**:
  - **Intent-Driven Bridge**: Natural language interface with Generative UI responses (`StatCard`, `ForensicTimeline`, `ActionForm`)
  - **Ecosystem Visualizer**: Spatial, interactive HUD for network state
  - **Forensic Transparency**: High-fidelity cognitive path reconstruction
  - **Unified Dashboard**: Real-time view of agent thoughts, actions, and metrics

### Domain Layer

- **Governance Engine**: Centralized policy management (`governanceStore`) with visual safety scores
- **Governance Agent (Cloudflare DO)**: Stateful agent running on the edge, maintaining thought history and enforcing policies.
- **Policy Service**: Validates actions against risk management rules
- **Privacy Engine**: Implements PII redaction and ZK-attestations for confidential agent reasoning (supporting OpenClaw, Hermes).
- **Trading Agent**: Executes forecasting and trading strategies

### Infrastructure Layer

- **Cloudflare Workers**: High-performance compute platform for governance agents.
- **ElevenLabs API**: AI voice synthesis for conversational briefings.
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

### Cloudflare D1 (Production)

- **agents**: Registered agent metadata, capabilities, and status
- **policies**: Governance rules and enforcement configurations
- **action_logs**: Audit trail of all agent actions and decisions
- **policy_decisions**: Detailed decision records with AI reasoning
- **agent_metrics**: Aggregated performance and compliance metrics
- **thought_history**: Cognitive transparency log

### Durable Objects (Per-Agent State)

- Persistent thought history and action logs via `ctx.storage`
- Rate limiting counters and policy enforcement state
- Voice briefing rate limits (10 per hour)
- Metrics and configuration snapshots

### Local Fallback

- Runs: `data/cre-runs.jsonl` (append-only JSONL)
- Quota Usage: `data/usage.json`
- Token Telemetry: `data/token-telemetry.json`

## Configuration

Centralized config with Zod validation (`src/shared/config/index.ts`):

```env
# Sapience / Arbitrum (Trading)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ETHEREAL_RPC_URL=https://ethereal-rpc.sapience.xyz
SAPIENCE_PRIVATE_KEY=your_private_key

# Cloudflare (Governance Agents)
CLOUDFLARE_ACCOUNT_ID=your_id
CLOUDFLARE_API_TOKEN=your_token

# ElevenLabs (Voice Briefings)
ELEVENLABS_API_KEY=your_elevenlabs_key

# LLM Providers (at least one required)
FIREWORKS_API_KEY=
OPENROUTER_API_KEY=

# Recall Network (Agent Memory)
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
logger.info("Forecast submitted", { marketId, probability, txHash });
logger.error("Policy violation", { action, reason, agentId });
logger.warn("LLM fallback triggered", { provider, error });
```

## Live On-Chain Activity

- **Agent Wallet**: `0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC`
- **Arbiscan**: [View EAS Attestations](https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC)
- **Proof of Accuracy**: Horizon-Weighted Strategy prioritizes long-horizon markets

## Related Docs

- **[Developer Guide](./DEVELOPER.md)** — API reference, adding features, testing
- **[CRE Integration](./CRE.md)** — Chainlink workflow design and implementation
- **[Deployment](./DEPLOYMENT.md)** — Release process, rollback, operations
