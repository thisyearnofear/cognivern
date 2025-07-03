import { Policy } from "../../domain/policy/Policy.js";
import { PolicyService } from "../../domain/policy/PolicyService.js";
import { PolicyRule } from "../../domain/policy/PolicyTypes.js";
import {
  CreatePolicyDTO,
  PolicyDTO,
  PolicyRuleDTO,
  UpdatePolicyDTO,
} from "./PolicyDTOs.js";

/**
 * Policy Application Service
 *
 * This service implements application-specific use cases and acts as a facade for the presentation layer.
 * It translates between DTOs and domain entities and coordinates with the domain services.
 */
export class PolicyApplicationService {
  constructor(private policyService: PolicyService) {}

  /**
   * Convert a domain Policy to a PolicyDTO
   */
  private toPolicyDTO(policy: Policy): PolicyDTO {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      version: policy.version,
      rules: policy.rules,
      metadata: policy.metadata,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      status: policy.status,
    };
  }

  /**
   * Convert PolicyRuleDTO to domain PolicyRule
   */
  private toDomainRule(ruleDTO: PolicyRuleDTO): PolicyRule {
    return {
      id: ruleDTO.id,
      type: ruleDTO.type,
      condition: ruleDTO.condition,
      action: {
        type: ruleDTO.action.type,
        parameters: ruleDTO.action.parameters,
      },
      metadata: ruleDTO.metadata,
    };
  }

  /**
   * Create a new policy
   */
  async createPolicy(createPolicyDTO: CreatePolicyDTO): Promise<PolicyDTO> {
    // Convert DTO to domain objects
    const domainRules = createPolicyDTO.rules.map((rule) =>
      this.toDomainRule(rule)
    );

    // Use domain service
    const policy = await this.policyService.createPolicy(
      createPolicyDTO.name,
      createPolicyDTO.description,
      domainRules
    );

    // Convert result back to DTO
    return this.toPolicyDTO(policy);
  }

  /**
   * Get policy by ID
   */
  async getPolicy(id: string): Promise<PolicyDTO | null> {
    const policy = await this.policyService.getPolicy(id);
    return policy ? this.toPolicyDTO(policy) : null;
  }

  /**
   * List all policies
   */
  async listPolicies(): Promise<PolicyDTO[]> {
    const policies = await this.policyService.listPolicies();
    return policies.map((policy) => this.toPolicyDTO(policy));
  }

  /**
   * List active policies
   */
  async listActivePolicies(): Promise<PolicyDTO[]> {
    const policies = await this.policyService.listActivePolicies();
    return policies.map((policy) => this.toPolicyDTO(policy));
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    id: string,
    updatePolicyDTO: UpdatePolicyDTO
  ): Promise<PolicyDTO> {
    // Convert DTO to domain update object
    const domainUpdates: Partial<Policy> = {
      ...updatePolicyDTO,
      rules: updatePolicyDTO.rules?.map((rule) => this.toDomainRule(rule)),
    };

    // Use domain service
    const updatedPolicy = await this.policyService.updatePolicy(
      id,
      domainUpdates
    );

    // Convert result back to DTO
    return this.toPolicyDTO(updatedPolicy);
  }

  /**
   * Update policy status
   */
  async updatePolicyStatus(
    id: string,
    status: "active" | "draft" | "archived"
  ): Promise<PolicyDTO> {
    const updatedPolicy = await this.policyService.updatePolicyStatus(
      id,
      status
    );
    return this.toPolicyDTO(updatedPolicy);
  }

  /**
   * Add rule to policy
   */
  async addRuleToPolicy(
    policyId: string,
    ruleDTO: PolicyRuleDTO
  ): Promise<PolicyDTO> {
    const domainRule = this.toDomainRule(ruleDTO);
    const updatedPolicy = await this.policyService.addRuleToPolicy(
      policyId,
      domainRule
    );
    return this.toPolicyDTO(updatedPolicy);
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<void> {
    await this.policyService.deletePolicy(id);
  }
}
