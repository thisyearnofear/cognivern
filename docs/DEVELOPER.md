# Developer Guide & API Reference

## Quick Start

### Prerequisites
- Node.js v20.14+
- pnpm
- Arbitrum ETH for gas fees

### Installation
```bash
git clone https://github.com/thisyearnofear/cognivern.git
cd cognivern
pnpm install
pnpm build
pnpm start
```

## API Reference

### Data Plane Endpoints

#### `POST /ingest/runs`
Ingest a run from any agent.

**Headers:**
- `Authorization: Bearer <ingestKey>`
- `X-PROJECT-ID: <projectId>`
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  runId: string;
  projectId: string;
  workflow: string;
  mode: 'local' | 'cre';
  startedAt: string;  // ISO timestamp
  finishedAt: string;
  ok: boolean;
  steps: CreStep[];
  artifacts: CreArtifact[];
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/ingest/runs \
  -H 'Authorization: Bearer dev-ingest-key' \
  -H 'X-PROJECT-ID: default' \
  -H 'Content-Type: application/json' \
  -d '{"runId":"123","projectId":"default","workflow":"forecasting","mode":"local","startedAt":"2026-01-01T00:00:00.000Z","finishedAt":"2026-01-01T00:00:01.000Z","ok":true,"steps":[],"artifacts":[]}'
```

### Control Plane Endpoints

| Endpoint | Description | Response |
| :--- | :--- | :--- |
| `GET /api/cre/runs` | List runs (projectId, limit, offset) | `{ runs: CreRun[], total: number }` |
| `GET /api/cre/runs/:runId` | Get run details | `{ run: CreRun }` |
| `GET /api/projects` | List all projects | `{ projects: [{ id, name }] }` |
| `GET /api/projects/:projectId/usage` | Get quota usage | `{ usage: { runs, limit, resetAt } }` |
| `GET /api/projects/:projectId/tokens` | Get token telemetry | `{ tokens: [{ ingestKeyId, lastSeen, runCount }] }` |
| `GET /health` | Health check | `{ status: 'ok' \| 'degraded', timestamp }` |

## Agent Comparison Feature

### Overview
Compare performance metrics across multiple agents in real-time with filtering, sorting, and aggregate statistics.

### Architecture

**Core Components:**
- **AgentMetricsAggregator**: Unified metrics source with caching (30s TTL), filtering, sorting
- **API Service**: Centralized endpoints for comparison, leaderboard, stats
- **Filter Schema**: Type-safe filter definitions (inspired by OpenStatus)
- **Trading Dashboard**: UI with progressive disclosure, client-side filtering

**Key Methods:**
```typescript
getComparisonMetrics(agentIds, filters)   // Filtered comparison data
calculateAggregateMetrics(metrics)        // Averages, best/worst
sortMetrics(metrics, sort)                // Sort by any field
clearCache(agentId?)                      // Cache management
```

### User Guide

**Accessing Comparison View:**
1. Navigate to Trading Dashboard
2. Click "Show Agent Comparison"
3. Click "Show Filters" for advanced options

**Filtering:**
- **Search**: Type agent name or type
- **Agent Types**: Recall, Vincent, Sapience, Custom
- **Status**: Active, Inactive, Paused, Error
- **Ranges**: Win rate, return, Sharpe ratio, latency

**Sorting:** Click any column header (click again to reverse)

**Metrics:**
- **Win Rate**: ≥50% (green), <50% (gray)
- **Return**: Positive (green), Negative (red)
- **Sharpe Ratio**: >1.0 good, <1.0 poor
- **Latency**: Lower is better (ms)

**Aggregate Statistics:** Total agents, avg win rate, avg return, total trades

### API Endpoints

**`GET /api/agents/compare`** - Multi-agent comparison with filters

**Query Parameters:**
```typescript
{
  agentIds?: string;        // Comma-separated IDs
  agentTypes?: string;      // Comma-separated types
  ecosystems?: string;      // Comma-separated ecosystems
  status?: string;          // Comma-separated statuses
  startDate?: string;       // ISO timestamp
  endDate?: string;         // ISO timestamp
  sortBy?: string;          // Field name
  sortDirection?: 'asc'|'desc';
}
```

**Response:**
```typescript
{
  data: AgentComparisonMetrics[];
  success: boolean;
  error?: string;
}
```

**`GET /api/agents/leaderboard`** - Ecosystem-wide rankings

**Query Parameters:** `ecosystem`, `metric` (default: totalReturn), `limit` (default: 10)

**`GET /api/agents/stats`** - Aggregate statistics

**Response:**
```typescript
{
  data: {
    totalAgents: number;
    avgWinRate: number;
    avgReturn: number;
    totalTrades: number;
  };
}
```

### Filter Schema

**Purpose:** Type-safe filter definitions with auto-inferred TypeScript types.

**Filter Types:**
- **Selection**: agentIds, agentTypes, ecosystems, status
- **Ranges**: winRate, totalReturn, sharpeRatio, avgLatency
- **Time**: timeRange (start/end timestamps)
- **Sorting**: sortBy, sortDirection
- **Search**: text search across agents

**Field Builders:**
```typescript
field.string()                    // String fields
field.array(innerField)           // Array fields with delimiter
field.range()                     // Numeric ranges [min, max]
field.stringLiteral(['a', 'b'])   // Type-safe enums
field.timestamp()                 // Date fields
```

### Adding New Filters

1. Update schema (`src/frontend/src/lib/store/agentComparisonSchema.ts`):
```typescript
export const agentComparisonSchema = {
  myNewFilter: field.array(field.stringLiteral(['option1', 'option2'])),
} as const;
```

2. Update filter definitions with key, label, type, and options.

### Backend Implementation

```typescript
router.get('/agents/compare', async (req, res) => {
  const filters = parseComparisonFilters(req.query);
  const aggregator = new AgentMetricsAggregator();
  const agentIds = await getAgentIds(filters);
  const metrics = await aggregator.getComparisonMetrics(agentIds, filters);
  const sorted = aggregator.sortMetrics(metrics, {
    field: filters.sortBy || 'totalReturn',
    direction: filters.sortDirection || 'desc',
  });
  res.json({ data: sorted, success: true });
});
```

### Performance Optimizations

- **Caching**: 30s TTL in AgentMetricsAggregator
- **Client-side filtering**: useMemo for instant feedback
- **Lazy loading**: Only fetch when comparison view shown

**Target Metrics:** Initial load < 500ms, filter < 50ms, API < 1s, cache hit > 80%

## Core Services

### SapienceService
Primary gateway to Sapience ecosystem. Initializes ethers providers, manages wallet, submits forecasts via `@sapience/sdk`.

### GovernanceAgent
Represents autonomous entity. Maintains thought history, logs actions and metrics.

### AgentsModule
Manages agent lifecycle — initialize, start, orchestrate, status endpoints.

## Testing

```bash
# Test comparison endpoint
curl "http://localhost:3000/api/agents/compare?agentTypes=recall,vincent&sortBy=winRate"

# Test leaderboard
curl "http://localhost:3000/api/agents/leaderboard?ecosystem=sapience&limit=5"

# Test stats
curl "http://localhost:3000/api/agents/stats?agentTypes=recall"
```

## Troubleshooting

| Problem | Solutions |
| :--- | :--- |
| **No data showing** | Check agents registered, verify API, clear filters |
| **Slow performance** | Check cache hit rate, verify indexes, reduce agents |
| **Incorrect metrics** | Verify data sources, clear cache, check time filters |

## Contributing

1. Read [Architecture](./ARCHITECTURE.md) for system overview
2. Follow enhancement-first, DRY, clean code principles
3. Add tests for new functionality
4. Update documentation
5. Submit PR with clear description

## Related Docs

- **[Architecture](./ARCHITECTURE.md)** — System overview and design
- **[CRE Integration](./CRE.md)** — Chainlink workflow implementation
- **[Deployment](./DEPLOYMENT.md)** — Release process and operations
