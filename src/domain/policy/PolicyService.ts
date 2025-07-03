import { Policy } from "./Policy.js";
import { PolicyRepository } from "./PolicyRepository.js";
import { PolicyRule } from "./PolicyTypes.js";

/**
 * Domain service for Policy entities
 * Contains business logic for managing policies
 */
export class PolicyService {
  constructor(private policyRepository: PolicyRepository) {}

  /**
   * Create a new policy
   * @param name Policy name
   * @param description Policy description
   * @param rules Policy rules
   * @returns Created policy
   */
  async createPolicy(
    name: string,
    description: string,
    rules: PolicyRule[]
  ): Promise<Policy> {
    // Business logic: create policy entity
    const policy = Policy.create(name, description, rules);

    // Persist using repository
    await this.policyRepository.save(policy);

    return policy;
  }

  /**
   * Get a policy by ID
   * @param id Policy ID
   * @returns Policy or null if not found
   */
  async getPolicy(id: string): Promise<Policy | null> {
    return this.policyRepository.findById(id);
  }

  /**
   * List all policies
   * @returns Array of policies
   */
  async listPolicies(): Promise<Policy[]> {
    return this.policyRepository.findAll();
  }

  /**
   * List active policies
   * @returns Array of active policies
   */
  async listActivePolicies(): Promise<Policy[]> {
    return this.policyRepository.findByStatus("active");
  }

  /**
   * Update a policy
   * @param id Policy ID
   * @param updates Policy updates
   * @returns Updated policy
   */
  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const policy = await this.policyRepository.findById(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    // Business logic: update policy entity
    const updatedPolicy = policy.update(updates);

    // Persist using repository
    await this.policyRepository.save(updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Update policy status
   * @param id Policy ID
   * @param status New status
   */
  async updatePolicyStatus(
    id: string,
    status: "active" | "draft" | "archived"
  ): Promise<Policy> {
    const policy = await this.policyRepository.findById(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    // Business logic: change policy status
    const updatedPolicy = policy.changeStatus(status);

    // Persist using repository
    await this.policyRepository.save(updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Add a rule to a policy
   * @param policyId Policy ID
   * @param rule Rule to add
   * @returns Updated policy
   */
  async addRuleToPolicy(policyId: string, rule: PolicyRule): Promise<Policy> {
    const policy = await this.policyRepository.findById(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    // Business logic: add rule to policy
    const updatedPolicy = policy.addRule(rule);

    // Persist using repository
    await this.policyRepository.save(updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Delete a policy
   * @param id Policy ID
   */
  async deletePolicy(id: string): Promise<void> {
    const policy = await this.policyRepository.findById(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    await this.policyRepository.delete(id);
  }
}
