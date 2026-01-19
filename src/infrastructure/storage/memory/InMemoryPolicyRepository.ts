import { Policy } from "../../../domain/policy/Policy.js";
import { PolicyRepository } from "../../../domain/policy/PolicyRepository.js";

export class InMemoryPolicyRepository implements PolicyRepository {
  private policies: Map<string, Policy> = new Map();

  async findById(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  async findAll(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }

  async findByStatus(status: string): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.status === status);
  }

  async save(policy: Policy): Promise<void> {
    this.policies.set(policy.id, policy);
  }

  async delete(id: string): Promise<void> {
    this.policies.delete(id);
  }
}
