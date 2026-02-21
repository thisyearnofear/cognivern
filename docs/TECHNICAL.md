# Technical Documentation

## Architecture Overview

Cognivern is an **Agent Reliability + Proof Layer**.

It is designed as two planes:

- **Data plane** (`/ingest/*`): high-volume write path for agent run ingestion (ingest-key auth).
- **Control plane** (`/api/*`): UI + admin APIs (API key today; OAuth/RBAC later).

Chainlink integration remains a differentiator (verified inputs / proof), not the core wedge.

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CRE Workflow DON                             │
│                                                                      │
│  [Cron Trigger] → [HTTP: Market Data] → [Confidential HTTP: LLM]   │
│                   [EVM Read: Price Feeds]   [EVM Write: Attestation] │
└──────────────────────────────────────────────────────────────────────┘
         │                                            │
         ▼                                            ▼
[ Application Layer ]       [ Domain Layer ]           [ Infrastructure Layer ]
      |                           |                              |
      v                           v                              v
+----------------+      +-------------------+      +-------------------------+
|  Agent         | ---> |  Governance       | ---> |  SapienceService        |
|  Controller    |      |  Agent            |      |  (EAS / Arbitrum)       |
+----------------+      +-------------------+      +-------------------------+
      ^                           ^                              |
      |                           |                              v
      |                     +-----------+          +-------------------------+
      +-------------------- |  Policy   | <------- |  Chainlink Data Feeds   |
                            |  Service  |          |  (EVM Read)             |
                            +-----------+          +-------------------------+
```

## Core Services

### SapienceService (`src/services/SapienceService.ts`)

This is the primary gateway to the Sapience ecosystem.

*   **Responsibilities**:
    *   Initialize `ethers` providers for Arbitrum and Ethereal.
    *   Manage the agent's wallet.
    *   Submit forecasts using the `@sapience/sdk` `submitForecast` function.
    *   (Future) Execute trades on Ethereal Prediction Markets.
*   **Key Integration**: Uses the official Sapience SDK to handle EAS Schema encoding and attestation submission.

### GovernanceAgent (`src/services/GovernanceAgent.ts`)

Represents the autonomous entity.

*   **Responsibilities**:
    *   Maintain "Thought History" (Chain of Thought).
    *   Log actions and metrics.
    *   (Mocked) Asset discovery and external data gathering.
*   **Data Models**:
    *   `AgentThought`: Timestamped reasoning step.
    *   `AgentAction`: Executed decision.

### AgentsModule (`src/modules/agents/AgentsModule.ts`)

Manages the lifecycle of multiple agents.

*   **Responsibilities**:
    *   Initialize and start specific agent implementations (e.g., `SapienceTradingAgent`).
    *   Orchestrate the main loop (although currently event-driven).
    *   Provide status endpoints for the API.

## Data Persistence

Cognivern uses **local-first persistence** so runs survive restarts without requiring a database.

- Runs: `data/cre-runs.jsonl` (append-only JSONL)
- Quota usage: `data/usage.json`
- Token telemetry: `data/token-telemetry.json`

This is intentionally simple for early adoption and can later be replaced by Postgres + object storage.

## Configuration (`src/shared/config/index.ts`)

Configuration is centralized and validated using **Zod**.

*   **Required Variables**:
    *   `SAPIENCE_PRIVATE_KEY`: The agent's signing key.
    *   `ARBITRUM_RPC_URL`: Endpoint for Arbitrum One.
*   **Validation**: The app will fail to start if critical keys are missing, preventing runtime errors.

## API Endpoints

### Data Plane

- `POST /ingest/runs`: Ingest a run (`Authorization: Bearer <ingestKey>`, `X-PROJECT-ID`)

### Control Plane

- `GET /api/cre/runs?projectId=...`: List runs for a project
- `GET /api/cre/runs/:runId`: Run details
- `POST /api/cre/forecast`: Trigger internal forecasting workflow
- `GET /api/projects`: List projects (discovery-safe)
- `GET /api/projects/:projectId/usage`: Quota usage
- `GET /api/projects/:projectId/tokens`: Token telemetry

### Health
- `GET /health`

## Deployment

The application is deployed using **PM2** on a dedicated server.

*   **Process Name**: `cognivern-agent`
*   **Port**: `10000` (Proxied via Nginx to `api.thisyearnofear.com`)
*   **Logs**: Standard stdout/stderr captured by PM2.