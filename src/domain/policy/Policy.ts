import {
  PolicyRule,
  PolicyAction,
  PolicyRuleType,
  PolicyActionType,
  PolicyStatus,
} from "./PolicyTypes.js";

/**
 * Policy entity in the domain layer
 * Represents a governance policy with rules for agent behavior
 */
export class Policy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly rules: PolicyRule[];
  readonly metadata: Record<string, any>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: PolicyStatus;

  constructor(
    id: string,
    name: string,
    description: string,
    rules: PolicyRule[],
    version: string = "1.0.0",
    metadata: Record<string, any> = {},
    createdAt?: string,
    updatedAt?: string,
    status: PolicyStatus = "active"
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.rules = [...rules];
    this.version = version;
    this.metadata = { ...metadata };

    const now = new Date().toISOString();
    this.createdAt = createdAt || now;
    this.updatedAt = updatedAt || now;
    this.status = status;
  }

  /**
   * Create a new policy with a generated ID
   */
  static create(
    name: string,
    description: string,
    rules: PolicyRule[],
    metadata: Record<string, any> = {}
  ): Policy {
    const id = `policy-${Date.now()}`;
    return new Policy(id, name, description, rules, "1.0.0", metadata);
  }

  /**
   * Update policy with new values
   */
  update(updates: Partial<Policy>): Policy {
    return new Policy(
      this.id,
      updates.name || this.name,
      updates.description || this.description,
      updates.rules || this.rules,
      updates.version || this.version,
      updates.metadata || this.metadata,
      this.createdAt,
      new Date().toISOString(),
      updates.status || this.status
    );
  }

  /**
   * Change policy status
   */
  changeStatus(status: PolicyStatus): Policy {
    return new Policy(
      this.id,
      this.name,
      this.description,
      this.rules,
      this.version,
      this.metadata,
      this.createdAt,
      new Date().toISOString(),
      status
    );
  }

  /**
   * Add a new rule to the policy
   */
  addRule(rule: PolicyRule): Policy {
    return new Policy(
      this.id,
      this.name,
      this.description,
      [...this.rules, rule],
      this.version,
      this.metadata,
      this.createdAt,
      new Date().toISOString(),
      this.status
    );
  }
}

// Using PolicyStatus from PolicyTypes.js
