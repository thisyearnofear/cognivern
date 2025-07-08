import { PolicyService } from "../../domain/policy/PolicyService.js";
import { RecallPolicyRepository } from "../storage/recall/RecallPolicyRepository.js";
import { PolicyApplicationService } from "../../application/policy/PolicyApplicationService.js";
import { PolicyController } from "../../presentation/rest/controllers/PolicyController.js";
import { AgentController } from "../../presentation/rest/controllers/AgentController.js";
import { RecallService } from "../../services/RecallService.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { MetricsService } from "../../services/MetricsService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";

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
  private agentController: AgentController;

  // Services (for AgentController)
  private recallService: RecallService;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;

  constructor() {
    // Initialize infrastructure components
    this.policyRepository = new RecallPolicyRepository();

    // Initialize domain services with their dependencies
    this.policyService = new PolicyService(this.policyRepository);

    // Initialize application services
    this.policyApplicationService = new PolicyApplicationService(
      this.policyService
    );

    // Initialize services for AgentController with real Recall client
    const recallClient = new RecallClient();
    const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS ||
      "0xFf0000000000000000000000000000000000c173") as Address;

    this.recallService = new RecallService(recallClient, bucketAddress);
    this.auditLogService = new AuditLogService(recallClient, bucketAddress);
    this.metricsService = new MetricsService(recallClient, bucketAddress);

    // Initialize controllers
    this.policyController = new PolicyController(this.policyApplicationService);
    this.agentController = new AgentController(
      this.recallService,
      this.auditLogService,
      this.metricsService
    );
  }

  /**
   * Get the policy controller instance
   */
  getPolicyController(): PolicyController {
    return this.policyController;
  }

  /**
   * Get the agent controller instance
   */
  getAgentController(): AgentController {
    return this.agentController;
  }

  /**
   * Get all controllers as an object
   */
  getAllControllers() {
    return {
      policyController: this.policyController,
      agentController: this.agentController,
    };
  }
}

// Create and export a singleton instance
export const dependencyContainer = new DependencyContainer();
