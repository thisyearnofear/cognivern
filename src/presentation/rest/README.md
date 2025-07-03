# REST API Presentation Layer

This directory contains the presentation layer components for the REST API following Clean Architecture principles.

## Structure

- `controllers/` - Controllers that handle HTTP requests and responses
  - `PolicyController.ts` - Controller for policy-related endpoints
- `routes/` - Route definitions that map URLs to controller methods
  - `policyRoutes.ts` - Routes for policy-related endpoints
  - `index.ts` - Main router that combines all route definitions

## Clean Architecture

The presentation layer is the outermost layer in Clean Architecture that:

1. **Handles I/O**: Processes incoming HTTP requests and formats outgoing HTTP responses.

2. **Adapts protocols**: Translates between the HTTP protocol and the application layer's interface.

3. **Framework integration**: Contains framework-specific code (Express.js in this case).

4. **Input validation**: Validates input data before passing it to the application layer.

## Controllers

Controllers in this layer:

- Parse and validate request data
- Call appropriate methods on application services
- Handle errors and format responses
- Do not contain business logic
- Are stateless and focused on handling HTTP concerns

## Routes

Routes in this layer:

- Define URL endpoints
- Map HTTP methods to controller methods
- Configure route-specific middleware
- Group related endpoints for organization

## Dependency Injection

Controllers receive their dependencies (application services) through constructor injection, allowing for:

- Loose coupling between layers
- Easier testing through mocking
- Flexibility in changing implementations

## Migration Status

This implementation is part of the ongoing migration to a Clean Architecture approach. Related components:

- **Domain Layer**: `src/domain/policy/*` contains the business rules and entities.
- **Application Layer**: `src/application/policy/PolicyApplicationService.ts` orchestrates use cases.
- **Infrastructure Layer**: `src/infrastructure/storage/recall/RecallPolicyRepository.ts` implements storage.

The older monolithic implementation is being gradually replaced with this clean architecture approach.
