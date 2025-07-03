# Policy Application Layer

This directory contains the application layer components for the Policy domain following Clean Architecture principles.

## Structure

- `PolicyDTOs.ts` - Data Transfer Objects for the policy domain
- `PolicyApplicationService.ts` - Application service that orchestrates use cases
- `index.ts` - Barrel file that exports all application layer components

## Clean Architecture

The application layer sits between the domain layer and the presentation layer, acting as a facade that coordinates use cases:

1. **Use case orchestration**: The `PolicyApplicationService` orchestrates the flow of data between the presentation layer and the domain layer.

2. **Data transformation**: Converts between domain entities and DTOs that are suitable for the presentation layer.

3. **Business rules delegation**: Delegates business rules to domain services rather than implementing them directly.

4. **Independence from frameworks**: This layer is framework-agnostic, depending only on the domain layer.

## Data Transfer Objects

DTOs in this layer serve as a contract between the application layer and the presentation layer:

- They decouple the domain model from the presentation layer
- They can be tailored to specific use cases
- They provide a stable interface even when the domain model changes
- They allow for validation specific to the presentation needs

## Migration Status

This implementation is part of the ongoing migration to a Clean Architecture approach. Related components:

- **Domain Layer**: `src/domain/policy/*` contains the business rules and entities.
- **Infrastructure Layer**: `src/infrastructure/storage/recall/RecallPolicyRepository.ts` implements the repository interface.
- **Presentation Layer**: `src/presentation/rest/controllers/PolicyController.ts` handles HTTP requests.
