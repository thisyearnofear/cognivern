# Technical Documentation

## Core Services

### PolicyEnforcementService

The PolicyEnforcementService handles policy validation and enforcement:

- Loads and manages policy configurations from Recall storage
- Evaluates agent actions against policy rules
- Supports multiple rule types: ALLOW, DENY, REQUIRE, RATE_LIMIT
- Provides real-time policy enforcement decisions
- Handles policy lifecycle management (active, draft, archived states)

```typescript
const policyService = new PolicyEnforcementService(recallClient, bucketAddress);
await policyService.loadPolicy("default-policy");
const isAllowed = await policyService.enforcePolicy(agentAction);
```

### PolicyService

The PolicyService manages policy lifecycle and status:

- Creates and updates policy configurations
- Manages policy status transitions (active/draft/archived)
- Provides caching for efficient policy retrieval
- Handles policy versioning and updates

```typescript
const policyService = new PolicyService();
await policyService.createPolicy(
  "resource-control",
  "Resource usage limits",
  rules
);
await policyService.updatePolicyStatus(policyId, "archived");
const policies = await policyService.listPolicies();
```

### AuditLogService

The AuditLogService provides comprehensive action logging:

- Records all agent actions with policy check results
- Stores logs in a structured format in Recall
- Supports time-based log retrieval and searching
- Includes metadata for debugging and compliance

```typescript
const auditService = new AuditLogService(recallClient, bucketAddress);
await auditService.logAction(action, policyChecks, allowed);
const logs = await auditService.searchLogs({
  actionType: "analysis",
  outcome: "allowed",
  startTime: "2024-03-01T00:00:00Z",
});
```

### MetricsService

The MetricsService handles performance and resource monitoring:

- Tracks action counts, policy violations, and response times
- Monitors system resource usage (CPU, memory, storage)
- Supports multiple time periods (hourly, daily, weekly, monthly)
- Provides caching for efficient metric retrieval

```typescript
const metricsService = new MetricsService(recallClient, bucketAddress);
await metricsService.recordAction(action, policyChecks, duration);
const metrics = await metricsService.getMetrics(MetricsPeriod.DAILY);
```

## Data Types

### Policy Structure

```typescript
interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  status: "active" | "draft" | "archived";
}

interface PolicyRule {
  id: string;
  type: PolicyRuleType; // ALLOW, DENY, REQUIRE, RATE_LIMIT
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

enum PolicyActionType {
  BLOCK = "block",
  LOG = "log",
  NOTIFY = "notify",
  ESCALATE = "escalate",
}
```

### Metrics Structure

```typescript
interface Metrics {
  timestamp: string;
  period: MetricsPeriod; // HOURLY, DAILY, WEEKLY, MONTHLY
  data: {
    actions: {
      total: number;
      successful: number;
      failed: number;
      blocked: number;
    };
    policies: {
      total: number;
      violations: number;
      enforced: number;
    };
    performance: {
      averageResponseTime: number;
      p95ResponseTime: number;
      maxResponseTime: number;
    };
    resources: {
      cpuUsage: number;
      memoryUsage: number;
      storageUsage: number;
    };
  };
}
```

## Recall Storage Structure

```
governance-bucket/
├── agents/
│   ├── escheat-agent-1/
│   │   ├── config.json           # Agent configuration
│   │   ├── policies/
│   │   │   ├── default-policy.json
│   │   ├── logs/
│   │   │   ├── YYYY-MM-DD-HH-MM-SS-action-id.json
│   │   ├── metrics/
│   │       ├── hourly-YYYY-MM-DD.json
│   │       ├── daily-YYYY-MM-DD.json
│   │       ├── weekly-YYYY-MM-DD.json
│   │       ├── monthly-YYYY-MM.json
```

## Environment Configuration

### Production Environment Setup

Create a `.env` file with the following variables:

```bash
# =============================================================================
# DEPLOYMENT ENVIRONMENT
# =============================================================================
NODE_ENV=production
PORT=10000

# Development Features (set to 'true' only in development)
CREATE_SAMPLE_POLICIES=false

# =============================================================================
# FILECOIN BLOCKCHAIN CONFIGURATION
# =============================================================================
FILECOIN_PRIVATE_KEY=your_private_key_here
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1

# Deployed Smart Contract Addresses (Calibration Testnet)
GOVERNANCE_CONTRACT_ADDRESS=0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880
STORAGE_CONTRACT_ADDRESS=0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada
USDFC_TOKEN_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9

# =============================================================================
# RECALL NETWORK CONFIGURATION
# =============================================================================
RECALL_API_KEY=your_recall_api_key_here
RECALL_NETWORK=calibration
RECALL_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
RECALL_CHAIN_ID=314159
RECALL_BUCKET_ADDRESS=0x0000000000000000000000000000000000000000
RECALL_BUCKET_ALIAS=cognivern-agents-bucket
RECALL_SYNC_INTERVAL=60000
RECALL_BATCH_SIZE=8

# =============================================================================
# RECALL TRADING API CONFIGURATION
# =============================================================================
RECALL_TRADING_API_KEY=your_recall_trading_api_key_here
RECALL_TRADING_BASE_URL=https://api.sandbox.competitions.recall.network

# =============================================================================
# AI & MCP CONFIGURATION
# =============================================================================
OPENAI_API_KEY=your_openai_api_key_here
MODEL_NAME=gpt-4
MCP_SERVER_URL=https://mcp.bitte.ai/sse
BITTE_API_KEY=your_bitte_api_key_here

# =============================================================================
# GOVERNANCE & POLICY CONFIGURATION
# =============================================================================
DEFAULT_POLICY=standard
AUDIT_FREQUENCY=daily

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
API_KEY=your_production_api_key_here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### Key Configuration Notes

- **CREATE_SAMPLE_POLICIES**: Set to `false` in production to prevent automatic sample data creation
- **Contract Addresses**: Updated to use the new AIGovernanceStorage contract optimized for AI governance
- **API Authentication**: Uses `x-api-key` header for API authentication
- **Environment Template**: Complete template available in `.env.example`

## Smart Contract Deployment

### Current Deployed Contracts

The platform uses specialized smart contracts deployed on Filecoin Calibration testnet:

#### GovernanceContract

- **Address**: `0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880`
- **Purpose**: Core governance logic, policy management, agent registration
- **Features**: Policy lifecycle, agent approval, governance statistics

#### AIGovernanceStorage

- **Address**: `0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada`
- **Purpose**: AI-specialized storage for governance data
- **Features**: Agent registration, governance actions, policy violations, approval rates
- **Advantages**: Purpose-built for AI governance vs generic storage

#### USDFC Token

- **Address**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- **Purpose**: Filecoin USDFC stablecoin for payments and governance fees

### Contract Deployment Process

To deploy new contracts or update existing ones:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Calibration testnet
pnpm run deploy-contracts

# Update .env with new addresses
GOVERNANCE_CONTRACT_ADDRESS=<new_governance_address>
STORAGE_CONTRACT_ADDRESS=<new_storage_address>
```

### Contract Architecture

The AIGovernanceStorage contract provides specialized features for AI governance:

- **Agent Registration**: Track AI agents with metadata and capabilities
- **Governance Actions**: Record policy enforcement decisions
- **Violation Tracking**: Monitor and log policy violations
- **Approval Rates**: Calculate governance approval statistics
- **Immutable Audit Trail**: All actions stored permanently on-chain

## Recall Bucket Setup

Before running the application, you need to set up a Recall bucket for storing governance data:

```bash
# Create a new bucket
recall bucket create --private-key YOUR_PRIVATE_KEY --metadata "name=cognivern-governance" --metadata "type=agent-storage"

# The command will output a transaction receipt with the new bucket address
# Save this address for your .env file (RECALL_BUCKET_ADDRESS)

# Create and add the agent configuration
echo '{"name": "cognivern-agent-1", "type": "governance-agent", "version": "1.0.0", "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "status": "active", "capabilities": ["policy-enforcement", "audit-logging", "performance-monitoring"]}' > agent-config.json

# Add the configuration to your bucket (use YOUR_BUCKET_ADDRESS from the creation step)
recall bucket add --private-key YOUR_PRIVATE_KEY --address YOUR_BUCKET_ADDRESS --key agents/cognivern-agent-1/config.json agent-config.json

# Verify the configuration was added correctly
recall bucket get --private-key YOUR_PRIVATE_KEY --address YOUR_BUCKET_ADDRESS --key agents/cognivern-agent-1/config.json
```

## Security Considerations

- ✅ All agent actions are validated against defined policies
- ✅ Policy enforcement happens in real-time before actions are executed
- ✅ Comprehensive audit logging for compliance and debugging
- ✅ Rate limiting and resource monitoring to prevent abuse
- ✅ Secure storage of sensitive data in Recall buckets
- ✅ API key authentication for all endpoints
