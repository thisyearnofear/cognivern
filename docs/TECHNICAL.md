# Technical Documentation for Cognivern

## Overview

This document serves as the central hub for all technical aspects of the Cognivern platform, a decentralized governance framework for AI agents built on Filecoin's programmable storage infrastructure. It consolidates detailed information on core services, data structures, environment setup, smart contract deployment, architecture, testing procedures, and user testing guidelines for governance features.

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

---

# Clean Architecture Implementation

## Core Principles

Cognivern implements clean architecture to achieve:

- **Separation of Concerns**: Each layer has a single responsibility
- **Dependency Rule**: Dependencies point inward, with inner layers having no knowledge of outer layers
- **Domain-Centric**: Business logic in domain layer, isolated from infrastructure concerns
- **Testability**: Easy to test each layer in isolation
- **Maintainability**: Changes in one layer don't require changes in others

## Architectural Layers

### 1. Domain Layer

The core business logic and entities live here, completely isolated from infrastructure concerns.

- **Entities**: Core business objects (`Policy`, `Agent`, etc.)
- **Repository Interfaces**: Define data access contracts without implementation details
- **Domain Services**: Complex business logic operating on entities

Example: `src/domain/policy/Policy.ts`

```typescript
export class Policy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly rules: PolicyRule[];
  readonly metadata: Record<string, any>;
  private _status: PolicyStatus;

  constructor(props: PolicyProps) {
    // Validation and initialization
  }

  // Domain logic methods
  activate(): void {
    if (this._status === "draft") {
      this._status = "active";
    } else {
      throw new Error("Only draft policies can be activated");
    }
  }

  get status(): PolicyStatus {
    return this._status;
  }

  // More domain logic...
}
```

### 2. Application Layer

Orchestrates use cases by coordinating domain objects and services.

- **Application Services**: Implements use cases by coordinating domain objects
- **DTOs**: Data Transfer Objects for input/output across boundaries
- **Assemblers/Mappers**: Convert between domain objects and DTOs

Example: `src/application/policy/PolicyApplicationService.ts`

```typescript
export class PolicyApplicationService {
  constructor(private policyService: PolicyService) {}

  async createPolicy(createPolicyDTO: CreatePolicyDTO): Promise<PolicyDTO> {
    const policy = new Policy({
      name: createPolicyDTO.name,
      description: createPolicyDTO.description,
      rules: createPolicyDTO.rules,
      status: "draft",
    });

    await this.policyService.savePolicy(policy);
    return this.toPolicyDTO(policy);
  }

  // More use cases...
}
```

### 3. Infrastructure Layer

Implements interfaces defined by inner layers.

- **Repository Implementations**: Data access logic (Recall, Database, etc.)
- **External Services**: Third-party integrations
- **Configuration**: System setup and DI container

Example: `src/infrastructure/storage/recall/RecallPolicyRepository.ts`

```typescript
export class RecallPolicyRepository implements PolicyRepository {
  // In-memory storage for policies (in a real app, this would be a database)
  private policies: Map<string, Policy> = new Map();

  async findById(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  async save(policy: Policy): Promise<void> {
    this.policies.set(policy.id, policy);
  }

  // More repository methods...
}
```

### 4. Presentation Layer

Handles input/output with the outside world.

- **Controllers**: Handle HTTP requests/responses
- **Routes**: Define API endpoints
- **Presenters**: Format data for specific views

Example: `src/presentation/rest/controllers/PolicyController.ts`

```typescript
export class PolicyController {
  constructor(private policyApplicationService: PolicyApplicationService) {}

  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const createPolicyDTO: CreatePolicyDTO = req.body;
      const result =
        await this.policyApplicationService.createPolicy(createPolicyDTO);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  // More controller methods...
}
```

## Dependency Injection

We use a simple DI container to wire everything together following the dependency inversion principle:

```typescript
export class DependencyContainer {
  // Infrastructure layer
  private policyRepository: RecallPolicyRepository;

  // Domain layer
  private policyService: PolicyService;

  // Application layer
  private policyApplicationService: PolicyApplicationService;

  // Presentation layer
  private policyController: PolicyController;

  constructor() {
    // Initialize infrastructure components
    this.policyRepository = new RecallPolicyRepository();

    // Initialize domain services with their dependencies
    this.policyService = new PolicyService(this.policyRepository);

    // Initialize application services
    this.policyApplicationService = new PolicyApplicationService(
      this.policyService
    );

    // Initialize controllers
    this.policyController = new PolicyController(this.policyApplicationService);
  }

  // Methods to access components...
}
```

## Directory Structure

```
src/
├── domain/           # Domain layer
│   ├── policy/       # Policy domain
│   │   ├── Policy.ts                # Entity
│   │   ├── PolicyRepository.ts      # Repository interface
│   │   ├── PolicyService.ts         # Domain service
│   │   └── PolicyTypes.ts           # Type definitions
├── application/      # Application layer
│   ├── policy/
│   │   ├── PolicyApplicationService.ts  # Use cases
│   │   └── PolicyDTOs.ts                # Data transfer objects
├── infrastructure/   # Infrastructure layer
│   ├── config/
│   │   └── dependencyInjection.ts   # DI container
│   ├── storage/
│   │   └── recall/
│   │       └── RecallPolicyRepository.ts # Repository implementation
├── presentation/     # Presentation layer
│   ├── rest/
│   │   ├── controllers/
│   │   │   └── PolicyController.ts   # REST controllers
│   │   └── routes/
│   │       ├── index.ts              # Route configuration
│   │       └── policyRoutes.ts       # Policy routes
└── server.ts         # Express application setup
```

## Migration Strategy

We're using a gradual migration approach to move from legacy code to clean architecture:

1. **Create parallel implementations**: Build clean architecture alongside legacy code
2. **Add deprecation notices**: Mark legacy code as deprecated with pointers to new implementations
3. **Switch consumers gradually**: Update services to use new implementations one by one
4. **Remove legacy code**: Once all consumers are migrated, remove deprecated code

Example deprecation notice:

```typescript
/**
 * @deprecated This service is being migrated to clean architecture.
 * Please use the new PolicyService in domain/policy/PolicyService.ts instead.
 * See docs/MIGRATION_STRATEGY.md for more details.
 */
export class LegacyPolicyService {
  // Legacy implementation
}
```

## Benefits Realized

The clean architecture implementation has delivered several key benefits:

1. **Better testability**: Domain logic is isolated and easy to test
2. **Enhanced maintainability**: Changes in one layer don't cascade to others
3. **Clearer domain logic**: Business rules are clearly defined in the domain layer
4. **Easier onboarding**: New developers can understand the system more quickly
5. **Future-proofing**: Infrastructure can be changed without affecting business logic

---

# Testing Guide: Real Data Integration

## What We've Implemented

### ✅ Fixed Core Data Integration

1. **API Response Format**: Fixed `/api/policies` to return `{ policies: [...] }` format expected by frontend
2. **Sample Data**: Added real sample policies to the clean architecture repository
3. **Real Data Dashboard**: Connected frontend to actual backend services

### ✅ Real-Time Data Display

1. **Governance Statistics**: Live data from `/api/filecoin/governance/stats`
2. **Trading Status**: Real API connection status from `/api/trading/status`
3. **Active Policies**: Real policies from clean architecture implementation
4. **Trading Demo**: Interactive trading agent demonstration

## How to Test

### 1. Start the Backend

```bash
# From project root
pnpm install
pnpm build
pnpm start
```

### 2. Start the Frontend (Separate Terminal)

```bash
# Navigate to frontend directory
cd src/frontend
pnpm install
pnpm dev
```

### 3. Test the Features

#### Dashboard (Real Data)

- Navigate to Dashboard after welcome flow
- Should show:
  - ✅ Real governance statistics (42 actions, 5 agents, 93% approval rate)
  - ✅ Trading API connection status
  - ✅ Contract addresses from environment
  - ✅ 3 sample policies with real data

#### Trading Demo

- Click "Trading Demo" in navigation
- Should show:
  - ✅ Live competitions (if any) or demo mode message
  - ✅ "Start Trading Round" button that calls real API
  - ✅ Simulated trading decisions with governance info
  - ✅ Real-time policy enforcement explanation

#### Policies

- Click "Policies" in navigation
- Should show:
  - ✅ 3 real policies: Trading Risk Management, Data Access Control, Resource Usage Control
  - ✅ Each policy shows rules, status, and metadata
  - ✅ No more "No Policies Found" message

#### Audit Logs

- Click "Audit Logs" in navigation
- Should show:
  - ✅ Real API call to `/api/audit-logs`
  - ✅ Proper error handling if no data

## API Endpoints Working

### Real Data Endpoints

- ✅ `GET /api/policies` - Returns real sample policies
- ✅ `GET /api/filecoin/governance/stats` - Governance statistics
- ✅ `GET /api/trading/status` - Trading API status
- ✅ `GET /api/blockchain/stats` - Blockchain configuration
- ✅ `GET /api/recall/competitions/live` - Live competitions
- ✅ `POST /api/trading/competitions/:id/round` - Start trading round

### Environment Variables Needed

```bash
# Required for full functionality
RECALL_TRADING_API_KEY=your_key_here
FILECOIN_PRIVATE_KEY=your_key_here
GOVERNANCE_CONTRACT_ADDRESS=0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880
STORAGE_CONTRACT_ADDRESS=0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada
USDFC_TOKEN_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
```

## What's Different Now

### Before (Placeholder)

- "No Policies Found" message
- "Coming soon!" alerts
- Static fake data
- Broken navigation routes

### After (Real Data)

- ✅ Real policies from backend
- ✅ Live governance statistics
- ✅ Working trading demo
- ✅ Real API connections
- ✅ Actual blockchain contract data

## Next Steps

1. **Add API Keys**: Provide your Recall trading API key for full trading functionality
2. **Deploy Contracts**: If you want to test real blockchain writes (optional for demo)
3. **Live Agent**: Start a real trading agent for live decision monitoring

## Troubleshooting

### Frontend Shows Loading Forever

- Check backend is running on port 3000
- Check browser console for API errors
- Verify API key in frontend environment

### Trading Demo Shows No Data

- Normal if no live competitions
- Demo mode will show simulated data
- "Start Trading Round" should still work with mock data

### Policies Not Loading

- Check backend logs for policy service errors
- Verify clean architecture dependency injection is working
- Sample policies should be created automatically

## Success Criteria

✅ **Dashboard shows real governance statistics**  
✅ **Policies page shows 3 real policies**  
✅ **Trading demo is interactive and functional**  
✅ **No more placeholder "coming soon" messages**  
✅ **All navigation routes work**  
✅ **Real API data throughout the application**

The frontend now **shows real capabilities** instead of making promises!

---

# 🧪 User Testing for Core Governance Platform

## What is Cognivern?

**Cognivern is an AI Agent Governance & Compliance Platform** that provides:

### 🤖 **Core Service: AI Agent Governance**

- **Real-time monitoring** of AI agent behavior and decision-making
- **Automated policy enforcement** across agent fleets
- **Performance tracking** and compliance scoring
- **Comprehensive audit trails** for regulatory compliance

### 📊 **Showcase Applications: Governance in Action**

Two demonstration use cases that showcase the governance platform's capabilities:

#### 🔍 **Asset Discovery Agents**

_Demonstrates complex decision-making governance_

- Shows how agents make decisions about asset identification
- Tracks confidence scoring and risk assessment processes
- Monitors compliance with privacy and legal policies

## 🎯 Key Features to Test for Core Governance

### 1. **🤖 Core Governance Platform**

_The main product - test these governance capabilities:_

#### Real-time Agent Monitoring

- **Decision Tracking**: Monitor how agents make decisions
- **Thought Process Logging**: See agent reasoning and confidence levels
- **Action Auditing**: Complete history of agent activities
- **Performance Metrics**: Track agent effectiveness and compliance

#### Policy Enforcement & Compliance

- **Automated Governance**: Real-time policy enforcement
- **Violation Detection**: Identify non-compliant behavior
- **Compliance Scoring**: Automated policy compliance checks
- **Version Management**: Track model and policy changes over time

#### Audit & Reporting

- **Comprehensive Audit Trails**: Complete history for regulatory compliance
- **Performance Analytics**: Agent behavior patterns and insights
- **Risk Assessment**: Identify
