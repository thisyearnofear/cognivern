# Technical Documentation

## Architecture Overview

Cognivern creates a modular, verifiable AI agent system. The architecture is designed to separate **domain logic** (decision making), **infrastructure** (blockchain interaction), and **application** (orchestration) concerns.

### System Diagram

```
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
      +-------------------- |  Policy   | <------- |  InMemoryRepository     |
                            |  Service  |          |  (Storage)              |
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

### In-Memory Storage

For the purpose of the hackathon and rapid iteration, the system currently uses **In-Memory Repositories** (`InMemoryPolicyRepository.ts`) for storing policies and logs.

*   **Why?**: Reduces infrastructure complexity (no database to provision).
*   **Trade-off**: Data is lost on server restart.
*   **Future**: Can be easily swapped for `PostgresPolicyRepository` or `FilecoinPolicyRepository` due to the Repository Pattern.

## Configuration (`src/shared/config/index.ts`)

Configuration is centralized and validated using **Zod**.

*   **Required Variables**:
    *   `SAPIENCE_PRIVATE_KEY`: The agent's signing key.
    *   `ARBITRUM_RPC_URL`: Endpoint for Arbitrum One.
*   **Validation**: The app will fail to start if critical keys are missing, preventing runtime errors.

## API Endpoints

The backend exposes a REST API for monitoring the agent.

*   `GET /health`: System status.
*   `GET /api/agents/sapience/status`: Current status of the forecasting agent.
*   `GET /api/agents/sapience/decisions`: Recent forecasts and trades.

## Deployment

The application is deployed using **PM2** on a dedicated server.

*   **Process Name**: `cognivern-agent`
*   **Port**: `10000` (Proxied via Nginx to `api.thisyearnofear.com`)
*   **Logs**: Standard stdout/stderr captured by PM2.