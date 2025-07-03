# Recall Storage Infrastructure

This directory contains the infrastructure layer implementation for the Policy domain's storage needs, following Clean Architecture principles.

## Structure

- `RecallPolicyRepository.ts` - Implementation of the PolicyRepository interface
- `index.ts` - Barrel file that exports the repository implementation

## Clean Architecture

The infrastructure layer is the outermost layer of Clean Architecture, responsible for:

1. **Framework integration**: Providing concrete implementations of interfaces defined in the domain layer.

2. **External systems interaction**: Managing interactions with databases, file systems, or external services.

3. **Technical details**: Handling technical details that should be isolated from the domain and application layers.

## RecallPolicyRepository

The `RecallPolicyRepository` implements the `PolicyRepository` interface defined in the domain layer. Currently, it uses an in-memory Map for storage, but in a production environment, it would:

- Connect to a persistent storage system
- Handle serialization/deserialization
- Manage caching
- Implement proper error handling for storage operations

This implementation allows the domain and application layers to remain unaware of the actual storage mechanism, following the Dependency Inversion Principle.

## Future Enhancements

Planned enhancements for this implementation include:

1. Integration with a real Recall storage backend
2. Proper transaction support
3. Caching optimization
4. Error recovery mechanisms

## Migration Status

This implementation is part of the ongoing migration to a Clean Architecture approach. Related components:

- **Domain Layer**: `src/domain/policy/PolicyRepository.ts` defines the interface this class implements.
- **Application Layer**: `src/application/policy/PolicyApplicationService.ts` uses this repository through the domain interface.
- **Presentation Layer**: `src/presentation/rest/controllers/PolicyController.ts` handles HTTP requests using application services.
