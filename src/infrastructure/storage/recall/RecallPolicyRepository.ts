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

  constructor() {
    // Initialize with sample policies for demo
    this.initializeSamplePolicies();
  }

  /**
   * Initialize sample policies for demonstration
   */
  private initializeSamplePolicies(): void {
    const samplePolicies = [
      Policy.create(
        "Trading Risk Management",
        "Enforces risk limits and compliance for trading agents",
        [
          {
            id: "max-position-size",
            type: "deny",
            condition: "trade_value > 50000",
            action: {
              type: "block",
              parameters: { threshold: 50000 },
            },
            metadata: { severity: "high", category: "risk_management" },
          },
          {
            id: "high-risk-trades",
            type: "deny",
            condition: "risk_score > 85",
            action: {
              type: "block",
              parameters: { threshold: 85 },
            },
            metadata: { severity: "high", category: "risk_management" },
          },
        ]
      ),
      Policy.create(
        "Data Access Control",
        "Controls access to sensitive data and enforces privacy rules",
        [
          {
            id: "pii-access",
            type: "deny",
            condition: "contains_pii = true AND encryption = false",
            action: {
              type: "block",
              parameters: { severity: "high" },
            },
            metadata: { category: "privacy" },
          },
          {
            id: "audit-log",
            type: "require",
            condition: "data_access = true",
            action: {
              type: "log",
              parameters: { retention: "90d" },
            },
            metadata: { category: "compliance" },
          },
        ]
      ),
      Policy.create(
        "Resource Usage Control",
        "Enforces limits on computational resources and API usage",
        [
          {
            id: "cpu-limit",
            type: "rate_limit",
            condition: "cpu_usage > 80%",
            action: {
              type: "throttle",
              parameters: { threshold: 80, period: "5m" },
            },
            metadata: { category: "performance" },
          },
        ]
      ),
    ];

    samplePolicies.forEach((policy) => {
      this.policies.set(policy.id, policy);
    });
  }

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
