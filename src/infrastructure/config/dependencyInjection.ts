import { PolicyService } from "../../domain/policy/PolicyService.js";
import { RecallPolicyRepository } from "../storage/recall/RecallPolicyRepository.js";
import { PolicyApplicationService } from "../../application/policy/PolicyApplicationService.js";
import { PolicyController } from "../../presentation/rest/controllers/PolicyController.js";

/**
 * Container for application dependencies
 *
 * This simple dependency injection container creates and wires together
 * all components of the application following clean architecture principles.
 */
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

  /**
   * Get the policy controller instance
   */
  getPolicyController(): PolicyController {
    return this.policyController;
  }

  /**
   * Get all controllers as an object
   */
  getAllControllers() {
    return {
      policyController: this.policyController,
    };
  }
}

// Create and export a singleton instance
export const dependencyContainer = new DependencyContainer();
