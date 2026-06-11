import { Policy } from '../types/Policy.js';

export interface PolicyPersistence {
  create(policy: Policy): Promise<Policy>;
  get(id: string): Promise<Policy | null>;
  list(): Promise<Policy[]>;
  update(id: string, updates: Partial<Policy>): Promise<Policy>;
}

export class InMemoryPolicyPersistence implements PolicyPersistence {
  private policies: Map<string, Policy> = new Map();

  async create(policy: Policy): Promise<Policy> {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async get(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  async list(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }

  async update(id: string, updates: Partial<Policy>): Promise<Policy> {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`Policy ${id} not found`);
    }
    const updated: Policy = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(id, updated);
    return updated;
  }
}
