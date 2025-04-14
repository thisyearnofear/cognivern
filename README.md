# Cognivern

A decentralized platform for auditing, monitoring, and governing AI agents through trusted, verifiable intelligence using Recall's blockchain-based storage infrastructure.

## 🌟 Overview

The Cognivern Platform provides a comprehensive solution for ensuring transparency, accountability, and collaboration between AI agents. By leveraging Recall's decentralized intelligence layer, this platform enables:

- **Verifiable Decision Logs:** Full audit trails for AI agent reasoning and actions
- **Intelligence Marketplace:** Exchange of valuable reasoning patterns between agents
- **Governance Protocols:** Rules-based oversight of agent behavior and performance
- **Multi-Agent Collaboration:** Secure, trustless cooperation between independent agents

This platform helps organizations maintain control and visibility over their AI systems while unlocking new possibilities for agent cooperation and knowledge exchange.

## 🚀 Key Features

### 🔍 Agent Activity Monitoring (MVP)

- ✅ Track all agent decisions with persistent chain-of-thought logs
- ✅ Timestamp and cryptographically sign all agent actions
- ✅ Generate human-readable explanations for complex decisions
- ✅ Real-time performance metrics tracking
- ✅ Compliance monitoring and reporting

### 💼 Reasoning Pattern Marketplace (MVP)

- ✅ List and discover reasoning patterns
- ✅ Subscribe to specialized reasoning services
- ✅ Basic pattern categorization and tagging
- ⏳ Subscription management system
- ⏳ Pattern access control

### 🛡️ Governance Controls (MVP)

- ✅ Implement policy guardrails for agent behavior
- ✅ Create consensus mechanisms for high-stakes decisions
- ✅ Develop exception handling protocols
- ✅ Basic audit logging
- ✅ Performance metrics tracking

### 🤝 Multi-Agent Collaboration (Future)

- 🔜 Enable secure knowledge sharing between trusted agents
- 🔜 Implement verification protocols for shared intelligence
- 🔜 Create collaborative problem-solving workflows
- 🔜 Cross-agent communication protocols
- 🔜 Shared resource management

## 🔧 Technical Architecture

### Core Components

#### **Agent Monitoring Service (MVP)**

- ✅ Intercepts and logs all agent reasoning steps
- ✅ Structures data for efficient storage and retrieval
- ✅ Provides real-time monitoring capabilities
- ✅ Basic metrics collection
- ✅ Simple compliance checks

#### **Recall Integration Layer (MVP)**

- ✅ Manages bucket creation and organization
- ✅ Handles secure, encrypted storage of sensitive data
- ✅ Implements batch synchronization for efficient processing
- ✅ Basic error handling and retries
- ✅ Simple data validation

#### **Verification Engine (Future)**

- 🔜 Validates the integrity of stored reasoning chains
- 🔜 Implements zero-knowledge proofs for private verification
- 🔜 Creates cryptographic attestations of agent behavior
- 🔜 Advanced signature verification
- 🔜 Chain-of-custody tracking

#### **Marketplace Protocol (MVP)**

- ✅ Facilitates listing and discovery of reasoning patterns
- ⏳ Implements basic subscription models
- ⏳ Handles pattern access control
- ✅ Simple pattern categorization
- ⏳ Basic subscription management

#### **Governance Dashboard (MVP)**

- ✅ Provides real-time visibility into agent activities
- ✅ Enables policy configuration and management
- ✅ Offers advanced analytics on agent performance
- ⏳ Interactive policy editor
- ⏳ Advanced visualization tools

## 📋 Implementation Details

### Core Services

#### **PolicyEnforcementService**

The PolicyEnforcementService handles policy validation and enforcement:

- Loads and manages policy configurations from Recall storage
- Evaluates agent actions against policy rules
- Supports multiple rule types: ALLOW, DENY, REQUIRE, RATE_LIMIT
- Provides real-time policy enforcement decisions
- Handles policy lifecycle management (active, draft, archived states)

```typescript
const policyService = new PolicyEnforcementService(recallClient, bucketAddress);
await policyService.loadPolicy('default-policy');
const isAllowed = await policyService.enforcePolicy(agentAction);
```

#### **PolicyService**

The PolicyService manages policy lifecycle and status:

- Creates and updates policy configurations
- Manages policy status transitions (active/draft/archived)
- Provides caching for efficient policy retrieval
- Handles policy versioning and updates

```typescript
const policyService = new PolicyService();
await policyService.createPolicy('resource-control', 'Resource usage limits', rules);
await policyService.updatePolicyStatus(policyId, 'archived');
const policies = await policyService.listPolicies();
```

#### **AuditLogService**

The AuditLogService provides comprehensive action logging:

- Records all agent actions with policy check results
- Stores logs in a structured format in Recall
- Supports time-based log retrieval and searching
- Includes metadata for debugging and compliance

```typescript
const auditService = new AuditLogService(recallClient, bucketAddress);
await auditService.logAction(action, policyChecks, allowed);
const logs = await auditService.searchLogs({
  actionType: 'analysis',
  outcome: 'allowed',
  startTime: '2024-03-01T00:00:00Z',
});
```

#### **MetricsService**

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

### Data Types

#### Policy Structure

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
  status: 'active' | 'draft' | 'archived';
}

interface PolicyRule {
  id: string;
  type: PolicyRuleType; // ALLOW, DENY, REQUIRE, RATE_LIMIT
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

enum PolicyActionType {
  BLOCK = 'block',
  LOG = 'log',
  NOTIFY = 'notify',
  ESCALATE = 'escalate',
}
```

#### Metrics Structure

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

### Recall Storage Structure

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

### Chain-of-Thought Data Format

```json
{
  "agentId": "agent-1",
  "timestamp": "2025-03-31T12:00:00Z",
  "input": "User requested financial analysis of Company X",
  "reasoning": [
    {
      "step": 1,
      "thought": "I need to gather recent financial data for Company X",
      "confidence": 0.95,
      "sources": ["financial-database-1"]
    }
  ],
  "decision": "Recommend caution on Company X investment due to overvaluation concerns",
  "signature": "0x7f9e...b6c5d4e3f2a1b0",
  "metadata": {
    "modelVersion": "GPT-5-turbo",
    "governancePolicy": "financial-advisory-v2",
    "complianceStatus": "compliant"
  }
}
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js v22.11.0 or higher
- pnpm v9.15.4 or higher
- Recall account with available credits
- Private key with sufficient permissions
- Recall CLI installed (`npm install -g @recallnet/cli`)

### Recall Bucket Setup

Before running the application, you need to set up a Recall bucket for storing governance data:

```bash
# Create a new bucket
recall bucket create --private-key YOUR_PRIVATE_KEY --metadata "name=escheat-governance" --metadata "type=agent-storage"

# The command will output a transaction receipt with the new bucket address
# Save this address for your .env file (RECALL_BUCKET_ADDRESS)

# Create and add the agent configuration
echo '{"name": "escheat-agent-1", "type": "governance-agent", "version": "1.0.0", "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "status": "active", "capabilities": ["policy-enforcement", "audit-logging", "performance-monitoring"]}' > agent-config.json

# Add the configuration to your bucket (use YOUR_BUCKET_ADDRESS from the creation step)
recall bucket add --private-key YOUR_PRIVATE_KEY --address YOUR_BUCKET_ADDRESS --key agents/escheat-agent-1/config.json agent-config.json

# Verify the configuration was added correctly
recall bucket get --private-key YOUR_PRIVATE_KEY --address YOUR_BUCKET_ADDRESS --key agents/escheat-agent-1/config.json

# You can also add sample metrics data
echo '{"timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "action": "analysis", "latencyMs": 120, "policyChecks": 3, "policyPassed": true}' > sample-metric.json
recall bucket add --private-key YOUR_PRIVATE_KEY --address YOUR_BUCKET_ADDRESS --key metrics/sample-1 sample-metric.json
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Recall Configuration
RECALL_PRIVATE_KEY="your-private-key"
RECALL_BUCKET_ADDRESS="YOUR_BUCKET_ADDRESS" # From the bucket creation step
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

### Installation

```bash
# Clone the repository
git clone https://github.com/thisyearnofear/ai-agent-governance.git
cd ai-agent-governance

# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the platform
pnpm start
```

## 📊 Usage Examples

### Monitor an Agent

```typescript
import { GovernanceMonitor } from 'ai-agent-governance';

const monitor = new GovernanceMonitor({
  agentId: 'financial-advisor-1',
  policyName: 'financial-advisory',
  recallBucket: '0xff0000000000000000000000000000000000fba1',
});

monitor.attach(myExistingAgent);
await monitor.startMonitoring();
```

### List a Pattern in the Marketplace

```typescript
import { MarketplaceService } from 'ai-agent-governance';

const marketplace = new MarketplaceService();
await marketplace.initialize();

const pattern = {
  id: 'pattern-123',
  title: 'Financial Analysis Pattern',
  description: 'A pattern for analyzing financial data',
  pattern: '// Financial analysis logic here',
  price: 99.99,
  currency: 'USD',
  authorId: 'author-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {
    category: 'finance',
    tags: ['analysis', 'data'],
    version: '1.0.0',
    rating: 4.5,
    downloads: 0,
  },
};

await marketplace.listPattern(pattern);
```

## 🔐 Security Considerations

- ✅ All agent actions are validated against defined policies
- ✅ Policy enforcement happens in real-time before actions are executed
- ✅ Comprehensive audit logging for compliance and debugging
- ✅ Rate limiting and resource monitoring to prevent abuse
- ✅ Secure storage of sensitive data in Recall buckets
- ✅ API key authentication for all endpoints
- ⏳ Regular security audits of the governance infrastructure

## 🗺️ Roadmap

### Phase 1: MVP (Current)

- ✅ Basic agent monitoring and logging
- ✅ Simple marketplace for pattern exchange
- ✅ Basic governance controls
- ✅ Essential security features

### Phase 2: Enhanced Features (Next)

- ⏳ Advanced pattern validation
- ⏳ Payment processing integration
- ⏳ Enhanced subscription management
- ⏳ Improved analytics dashboard

### Phase 3: Advanced Governance

- 🔄 Zero-knowledge proofs
- 🔄 Advanced consensus mechanisms
- 🔄 Cross-agent collaboration
- 🔄 Advanced policy management

### Phase 4: Ecosystem Expansion

- 🔄 API marketplace
- 🔄 Plugin system
- 🔄 Advanced visualization tools
- 🔄 Enterprise features

## 🤝 Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for details on how to get started.

## 📜 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

## 🙏 Acknowledgements

- **Recall Network** for providing the decentralized intelligence layer
- **OpenAI** for advanced language model capabilities
- **The AI governance community** for valuable insights and feedback

## Current Status

The platform has made significant progress in policy management and governance features:

- ✅ Agent metrics are being successfully stored in Recall buckets
- ✅ The dashboard can display real metrics from the Recall storage
- ✅ Error handling and retry mechanisms ensure reliable data access
- ✅ Bucket verification on startup confirms proper infrastructure setup
- ✅ Policy lifecycle management with status tracking (active/draft/archived)
- ✅ Real-time policy enforcement with multiple rule types
- ✅ Efficient policy caching and retrieval system
- ✅ WebSocket-based real-time updates for policy changes

### Next Steps

1. Complete the subscription management system
2. Implement the interactive policy editor with status management UI
3. Enhance visualization tools for metrics analysis
4. Add advanced pattern validation functionality
5. Set up system for regular security audits
6. Implement policy version control and rollback functionality
7. Add policy impact analysis tools
8. Develop policy template system for quick deployment
