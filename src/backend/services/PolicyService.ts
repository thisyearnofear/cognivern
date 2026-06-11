import { Policy, PolicyRule } from '../types/Policy.js';
import { PolicyPersistence, InMemoryPolicyPersistence } from '../persistence/PolicyPersistence.js';
import { MongoDbPolicyPersistence } from '../persistence/MongoDbPolicyPersistence.js';
import logger from '../utils/logger.js';
import fs from 'node:fs';
import path from 'node:path';

export class PolicyService {
  private persistence: PolicyPersistence;
  private initPromise: Promise<void>;

  constructor(persistence?: PolicyPersistence) {
    this.persistence = persistence || new InMemoryPolicyPersistence();
    this.initPromise = this.initializeBundledPolicies();
    logger.info('PolicyService initialized');
  }

  async createPolicy(
    name: string,
    description: string,
    rules: PolicyRule[],
    metadata?: Record<string, any>,
  ): Promise<Policy> {
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
      metadata: metadata || {},
      status: 'active',
    };

    await this.persistence.create(policy);
    logger.info(`Created new policy: ${id}`);
    return policy;
  }

  async getPolicy(id: string): Promise<Policy | null> {
    await this.initPromise;
    return this.persistence.get(id);
  }

  async listPolicies(): Promise<Policy[]> {
    await this.initPromise;
    return this.persistence.list();
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    await this.initPromise;
    const updated = await this.persistence.update(id, updates);
    logger.info(`Updated policy: ${id}`);
    return updated;
  }

  async updatePolicyStatus(id: string, status: Policy['status']): Promise<void> {
    await this.updatePolicy(id, { status });
  }

  private async initializeBundledPolicies() {
    const bundledPolicyDir = path.join(process.cwd(), 'src', 'policies');
    try {
      const filenames = fs
        .readdirSync(bundledPolicyDir)
        .filter((filename) => filename.endsWith('.json'))
        .sort();

      for (const filename of filenames) {
        const bundledPolicyPath = path.join(bundledPolicyDir, filename);
        const raw = fs.readFileSync(bundledPolicyPath, 'utf8');
        const bundled = JSON.parse(raw) as Policy & {
          rules?: Array<PolicyRule & { action?: unknown }>;
        };

        if (!bundled?.id) {
          continue;
        }

        const exists = await this.persistence.get(bundled.id);
        if (exists) {
          continue;
        }

        const rules = (bundled.rules || []).map((rule) => ({
          ...rule,
          type: String(rule.type).toLowerCase() as PolicyRule['type'],
          action:
            rule.action && typeof rule.action === 'object'
              ? rule.action
              : {
                  type: 'log' as const,
                  parameters: {
                    effect: rule.action || 'none',
                  },
                },
          metadata: rule.metadata || {},
        }));

        const policy: Policy = {
          id: bundled.id,
          name: bundled.name,
          description: bundled.description,
          version: bundled.version || '1.0.0',
          rules,
          createdAt: bundled.createdAt || new Date().toISOString(),
          updatedAt: bundled.updatedAt || new Date().toISOString(),
          metadata: bundled.metadata || {},
          status: bundled.status || 'active',
        };

        await this.persistence.create(policy);
        logger.info(`Loaded bundled policy: ${policy.id}`);
      }
    } catch (error) {
      logger.warn('Failed to load bundled policies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

const persistence = process.env.MONGODB_URI
  ? new MongoDbPolicyPersistence()
  : new InMemoryPolicyPersistence();

export const sharedPolicyService = new PolicyService(persistence);
