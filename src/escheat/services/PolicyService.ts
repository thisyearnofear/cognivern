import { Policy, PolicyRule, PolicyRuleType, PolicyActionType } from '../../types/Policy.js';
import { RecallService } from './RecallService.js';
import logger from '../utils/logger.js';
import type { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';

export class PolicyService {
  private policies: Map<string, Policy>;
  private recallService: RecallService;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.policies = new Map();
    this.recallService = new RecallService(recall, bucketAddress);
    this.initializeSamplePolicies().catch((error) => {
      logger.error('Failed to initialize sample policies:', error);
    });
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

    try {
      await this.recallService.storeObject('policies', `${id}.json`, policy);
      this.policies.set(id, policy);
      logger.info(`Created new policy: ${id}`);
      return policy;
    } catch (error) {
      logger.error('Error creating policy:', error);
      throw new Error(
        `Failed to create policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPolicy(id: string): Promise<Policy | null> {
    // Check cache first
    const cachedPolicy = this.policies.get(id);
    if (cachedPolicy) {
      return cachedPolicy;
    }

    try {
      const policy = await this.recallService.getObject<Policy>('policies', `${id}.json`);
      if (policy) {
        this.policies.set(id, policy);
      }
      return policy;
    } catch (error) {
      logger.error(`Error fetching policy ${id}:`, error);
      return null;
    }
  }

  async listPolicies(): Promise<Policy[]> {
    try {
      const keys = await this.recallService.listObjects('policies');
      const policies = await Promise.all(
        keys.map(async (key) => {
          const id = key.replace('policies/', '').replace('.json', '');
          return this.getPolicy(id);
        }),
      );

      return policies.filter((policy): policy is Policy => policy !== null);
    } catch (error) {
      logger.error('Error listing policies:', error);
      return [];
    }
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

    try {
      await this.recallService.storeObject('policies', `${id}.json`, updatedPolicy);
      this.policies.set(id, updatedPolicy);
      logger.info(`Updated policy: ${id}`);
      return updatedPolicy;
    } catch (error) {
      logger.error(`Error updating policy ${id}:`, error);
      throw new Error(
        `Failed to update policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async initializeSamplePolicies() {
    const policies = await this.listPolicies();
    if (policies.length === 0) {
      await this.createPolicy(
        'Resource Usage Control',
        'Enforces limits on computational resources and API usage',
        [
          {
            id: 'cpu-limit',
            type: 'rate_limit',
            condition: 'cpu_usage > 80%',
            action: {
              type: 'block',
              parameters: { threshold: 80, period: '5m' },
            },
            metadata: {},
          },
          {
            id: 'api-rate',
            type: 'rate_limit',
            condition: 'requests_per_minute > 100',
            action: {
              type: 'notify',
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
            type: 'deny',
            condition: 'contains_pii = true AND encryption = false',
            action: {
              type: 'block',
              parameters: { severity: 'high' },
            },
            metadata: {},
          },
          {
            id: 'audit-log',
            type: 'require',
            condition: 'data_access = true',
            action: {
              type: 'log',
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
            type: 'deny',
            condition: 'content_risk_score > 0.8',
            action: {
              type: 'escalate',
              parameters: { threshold: 0.8 },
            },
            metadata: {},
          },
          {
            id: 'bias-check',
            type: 'require',
            condition: 'bias_score < 0.2',
            action: {
              type: 'log',
              parameters: { threshold: 0.2 },
            },
            metadata: {},
          },
        ],
      );
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
}
