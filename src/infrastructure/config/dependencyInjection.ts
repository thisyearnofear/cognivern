import { PolicyService } from "../../domain/policy/PolicyService.js";
import { PolicyApplicationService } from "../../application/policy/PolicyApplicationService.js";
import { PolicyController } from "../../presentation/rest/controllers/PolicyController.js";
import { AgentController } from "../../presentation/rest/controllers/AgentController.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { MetricsService } from "../../services/MetricsService.js";
import { InMemoryPolicyRepository } from "../storage/memory/InMemoryPolicyRepository.js";

export class DependencyContainer {
  private policyRepository: InMemoryPolicyRepository;
  private policyService: PolicyService;
  private policyApplicationService: PolicyApplicationService;
  private policyController: PolicyController;
  private agentController: AgentController;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;

  constructor() {
    this.policyRepository = new InMemoryPolicyRepository();
    this.policyService = new PolicyService(this.policyRepository);
    this.policyApplicationService = new PolicyApplicationService(this.policyService);

    this.auditLogService = new AuditLogService();
    this.metricsService = new MetricsService();

    this.policyController = new PolicyController(this.policyApplicationService);
    // Pass null for deleted RecallService
    this.agentController = new AgentController(
      null, 
      this.auditLogService,
      this.metricsService
    );
  }

  getPolicyController(): PolicyController {
    return this.policyController;
  }

  getAgentController(): AgentController {
    return this.agentController;
  }

  getAllControllers() {
    return {
      policyController: this.policyController,
      agentController: this.agentController,
    };
  }
}

export const dependencyContainer = new DependencyContainer();