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

Create a `.env` file with the following variables:

```bash
# Recall Configuration
RECALL_PRIVATE_KEY="your-private-key"
RECALL_BUCKET_ADDRESS="YOUR_BUCKET_ADDRESS"
RECALL_NETWORK="testnet"

# Sync Configuration
RECALL_SYNC_INTERVAL="60000"
RECALL_BATCH_SIZE="8"

# Provider Configuration
OPENAI_API_KEY="your-api-key"
MODEL_NAME="gpt-4"

# Governance Configuration
DEFAULT_POLICY="standard"
AUDIT_FREQUENCY="daily"
```

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
