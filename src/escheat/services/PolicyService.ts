import { Policy } from '../types/index.js';
import { RecallService } from './RecallService.js';
import logger from '../utils/logger.js';

export class PolicyService {
  private recallService: RecallService;
  private policies: Map<string, Policy>;

  constructor() {
    this.recallService = new RecallService();
    this.policies = new Map();
  }

  async createPolicy(name: string, description: string, rules: string[]): Promise<Policy> {
    const id = `policy-${Date.now()}`;
    const now = new Date().toISOString();

    const policy: Policy = {
      id,
      name,
      description,
      rules,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    // Store policy in Recall
    await this.recallService.storeObject('policies', `${id}.json`, policy);

    // Cache in memory
    this.policies.set(id, policy);

    logger.info(`Created new policy: ${id}`);
    return policy;
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
}
