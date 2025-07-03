import { Policy } from "../../../domain/policy/Policy.js";
import { PolicyRepository } from "../../../domain/policy/PolicyRepository.js";
import { PolicyStatus } from "../../../domain/policy/PolicyTypes.js";

/**
 * RecallPolicyRepository implementation
 *
 * This class implements the PolicyRepository interface from the domain layer
 * using an in-memory storage mechanism. In a real application, this would be
 * replaced with a database or other persistent storage.
 */
export class RecallPolicyRepository implements PolicyRepository {
  // In-memory storage for policies
  private policies: Map<string, Policy> = new Map();

  /**
   * Find a policy by its ID
   * @param id Policy ID
   * @returns Policy or null if not found
   */
  async findById(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  /**
   * Find all policies
   * @returns Array of policies
   */
  async findAll(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }

  /**
   * Find policies by status
   * @param status Policy status
   * @returns Array of policies with the specified status
   */
  async findByStatus(status: PolicyStatus): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(
      (policy) => policy.status === status
    );
  }

  /**
   * Save a policy (create or update)
   * @param policy Policy to save
   */
  async save(policy: Policy): Promise<void> {
    this.policies.set(policy.id, policy);
  }

  /**
   * Delete a policy by ID
   * @param id Policy ID
   */
  async delete(id: string): Promise<void> {
    this.policies.delete(id);
  }
}
