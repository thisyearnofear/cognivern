import { Policy, PolicyRule } from "../types/Policy.js";
import logger from "../utils/logger.js";
import fs from "node:fs";
import path from "node:path";

export class PolicyService {
  private policies: Map<string, Policy>;

  constructor() {
    this.policies = new Map();
    this.initializeBundledPolicies();
    logger.info("PolicyService initialized (Local Mode)");
  }

  async createPolicy(
    name: string,
    description: string,
    rules: PolicyRule[],
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

  async updatePolicyStatus(
    id: string,
    status: Policy["status"],
  ): Promise<void> {
    await this.updatePolicy(id, { status });
  }

  private initializeBundledPolicies() {
    const bundledPolicyPath = path.join(
      process.cwd(),
      "src",
      "policies",
      "trading-competition-policy.json",
    );

    try {
      const raw = fs.readFileSync(bundledPolicyPath, "utf8");
      const bundled = JSON.parse(raw) as Policy & {
        rules?: Array<PolicyRule & { action?: unknown }>;
      };

      if (!bundled?.id || this.policies.has(bundled.id)) {
        return;
      }

      const rules = (bundled.rules || []).map((rule) => ({
        ...rule,
        type: String(rule.type).toLowerCase() as PolicyRule["type"],
        action:
          rule.action && typeof rule.action === "object"
            ? rule.action
            : {
                type: "log" as const,
                parameters: {
                  effect: rule.action || "none",
                },
              },
        metadata: rule.metadata || {},
      }));

      const policy: Policy = {
        id: bundled.id,
        name: bundled.name,
        description: bundled.description,
        version: bundled.version || "1.0.0",
        rules,
        createdAt: bundled.createdAt || new Date().toISOString(),
        updatedAt: bundled.updatedAt || new Date().toISOString(),
        metadata: bundled.metadata || {},
        status: bundled.status || "active",
      };

      this.policies.set(policy.id, policy);
      logger.info(`Loaded bundled policy: ${policy.id}`);
    } catch (error) {
      logger.warn("Failed to load bundled policies", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
