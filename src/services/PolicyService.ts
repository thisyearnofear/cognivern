import { Policy, PolicyRule } from "../types/Policy.js";
import logger from "../utils/logger.js";

export class PolicyService {
  private policies: Map<string, Policy>;

  constructor() {
    this.policies = new Map();
    // Initialize sample policies for dev/demo if needed
    if (process.env.NODE_ENV === "development" || process.env.CREATE_SAMPLE_POLICIES === "true") {
       this.initializeSamplePolicies();
    }
    logger.info("PolicyService initialized (Local Mode)");
  }

  async createPolicy(
    name: string,
    description: string,
    rules: PolicyRule[]
  ): Promise<Policy> {
    const id = `policy-${Date.now()}`;
    const now = new Date().toISOString();

    const policy: Policy = {
      id,
      name,
      description,
      version: "1.0.0",
      rules,
      createdAt: now,
      updatedAt: now,
      metadata: {},
      status: "active",
    };

    this.policies.set(id, policy);
    logger.info(`Created new policy: ${id}`);
    return policy;
  }

  async getPolicy(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null;
  }

  async listPolicies(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    const updatedPolicy: Policy = {
      ...policy,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.policies.set(id, updatedPolicy);
    logger.info(`Updated policy: ${id}`);
    return updatedPolicy;
  }

  async updatePolicyStatus(id: string, status: Policy["status"]): Promise<void> {
    await this.updatePolicy(id, { status });
  }

  private initializeSamplePolicies() {
     // Create a default policy
     this.createPolicy("Default Sapience Policy", "Default policy for forecasting agents", []);
  }
}
