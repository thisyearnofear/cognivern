import { Policy, PolicyRule, PolicyRuleType, PolicyActionType } from '../../types/Policy.js';
import { RecallService } from './RecallService.js';
import logger from '../utils/logger.js';

export class PolicyService {
  private recallService: RecallService;
  private policies: Map<string, Policy>;

  constructor() {
    this.recallService = new RecallService();
    this.policies = new Map();
    this.initializeSamplePolicies();
  }

  async createPolicy(name: string, description: string, rules: PolicyRule[]): Promise<Policy> {
    const id = `policy-${Date.now()}`;
    const now = new Date().toISOString();

    const policy: Policy = {
      id,
      name,
      description,
      version: '1.0.0',
      rules,
      createdAt: now,
      updatedAt: now,
      metadata: {},
      status: 'active',
    };

    // Store policy in Recall
    await this.recallService.storeObject('policies', `${id}.json`, policy);

    // Cache in memory
    this.policies.set(id, policy);

    logger.info(`Created new policy: ${id}`);
    return policy;
  }

  private async initializeSamplePolicies() {
    const policies = await this.listPolicies();
    if (policies.length === 0) {
      // Add sample policies
      await this.createPolicy(
        'Resource Usage Control',
        'Enforces limits on computational resources and API usage',
        [
          {
            id: 'cpu-limit',
            type: PolicyRuleType.RATE_LIMIT,
            condition: 'cpu_usage > 80%',
            action: {
              type: PolicyActionType.BLOCK,
              parameters: { threshold: 80, period: '5m' },
            },
            metadata: {},
          },
          {
            id: 'api-rate',
            type: PolicyRuleType.RATE_LIMIT,
            condition: 'requests_per_minute > 100',
            action: {
              type: PolicyActionType.NOTIFY,
              parameters: { threshold: 100, period: '1m' },
            },
            metadata: {},
          },
        ],
      );

      await this.createPolicy(
        'Data Access Governance',
        'Controls access to sensitive data and enforces privacy rules',
        [
          {
            id: 'pii-access',
            type: PolicyRuleType.DENY,
            condition: 'contains_pii = true AND encryption = false',
            action: {
              type: PolicyActionType.BLOCK,
              parameters: { severity: 'high' },
            },
            metadata: {},
          },
          {
            id: 'audit-log',
            type: PolicyRuleType.REQUIRE,
            condition: 'data_access = true',
            action: {
              type: PolicyActionType.LOG,
              parameters: { retention: '90d' },
            },
            metadata: {},
          },
        ],
      );

      await this.createPolicy(
        'Model Behavior Control',
        'Ensures AI models operate within defined ethical boundaries',
        [
          {
            id: 'content-filter',
            type: PolicyRuleType.DENY,
            condition: 'content_risk_score > 0.8',
            action: {
              type: PolicyActionType.ESCALATE,
              parameters: { threshold: 0.8 },
            },
            metadata: {},
          },
          {
            id: 'bias-check',
            type: PolicyRuleType.REQUIRE,
            condition: 'bias_score < 0.2',
            action: {
              type: PolicyActionType.LOG,
              parameters: { threshold: 0.2 },
            },
            metadata: {},
          },
        ],
      );
    }
  }

  async getPolicy(id: string): Promise<Policy | null> {
    // Check cache first
    const cachedPolicy = this.policies.get(id);
    if (cachedPolicy) {
      return cachedPolicy;
    }

    // Fetch from Recall
    try {
      const policy = await this.recallService.getObject<Policy>('policies', `${id}.json`);
      if (policy) {
        this.policies.set(id, policy);
        return policy;
      }
    } catch (error) {
      logger.error(`Error fetching policy ${id}:`, error);
    }

    return null;
  }

  async listPolicies(): Promise<Policy[]> {
    try {
      // Fetch all policy files from Recall
      const policyFiles = await this.recallService.listObjects('policies', '');
      const policies = await Promise.all(
        policyFiles.map(async (file: string) => {
          const id = file.replace('.json', '');
          return this.getPolicy(id);
        }),
      );

      return policies.filter((policy): policy is Policy => policy !== null);
    } catch (error) {
      logger.error('Error listing policies:', error);
      return [];
    }
  }

  async updatePolicyStatus(id: string, status: Policy['status']): Promise<void> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    const updatedPolicy: Policy = {
      ...policy,
      status,
      updatedAt: new Date().toISOString(),
    };

    // Update in Recall
    await this.recallService.storeObject('policies', `${id}.json`, updatedPolicy);

    // Update cache
    this.policies.set(id, updatedPolicy);

    logger.info(`Updated status for policy: ${id}`);
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

    // Store updated policy in Recall
    await this.recallService.storeObject('policies', `${id}.json`, updatedPolicy);

    // Update cache
    this.policies.set(id, updatedPolicy);

    logger.info(`Updated policy: ${id}`);
    return updatedPolicy;
  }
}
