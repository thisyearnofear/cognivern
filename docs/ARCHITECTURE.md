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
