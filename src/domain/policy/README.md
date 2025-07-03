# Policy Domain Implementation

This directory contains the policy domain implementation following Clean Architecture principles.

## Structure

- `Policy.ts` - The Policy entity, which encapsulates domain logic for policies
- `PolicyTypes.ts` - Type definitions used within the policy domain
- `PolicyRepository.ts` - Repository interface for storing and retrieving policies
- `PolicyService.ts` - Domain service containing business logic for policy operations
- `index.ts` - Barrel file that exports all domain components

## Clean Architecture

The policy domain implements the innermost layer of the Clean Architecture, focusing on business rules and domain logic. The key principles applied here are:

1. **Domain entities contain business rules**: The `Policy` class encapsulates the core business rules for policies, including validation and state transitions.

2. **Repositories provide data access abstraction**: The `PolicyRepository` interface defines how policies can be stored and retrieved without specifying implementation details.

3. **Domain services orchestrate business operations**: The `PolicyService` contains business logic that operates on policy entities.

4. **Dependency inversion**: Higher layers depend on interfaces defined in this layer, not on concrete implementations.

## Migration Status

This implementation is part of the ongoing migration to a Clean Architecture approach. Related components:

- **Infrastructure Layer**: `src/infrastructure/storage/recall/RecallPolicyRepository.ts` implements the repository interface.
- **Application Layer**: `src/application/policy/PolicyApplicationService.ts` provides use case orchestration.
- **Presentation Layer**: `src/presentation/rest/controllers/PolicyController.ts` handles HTTP requests.

The older implementation in `src/services/PolicyService.ts` and `src/types/Policy.ts` is being deprecated and will be removed once the migration is complete.
