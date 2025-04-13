import { Agent, AgentMetrics } from '../types/index.js';
import { RecallService } from './RecallService.js';
import logger from '../utils/logger.js';

export class AgentService {
  private recallService: RecallService;
  private agents: Map<string, Agent>;
  private readonly BUCKET_NAME = 'escheat-agents';

  constructor() {
    this.recallService = new RecallService();
    this.agents = new Map();
    logger.info('AgentService initialized');
  }

  async createAgent(name: string, type: Agent['type'], capabilities: string[]): Promise<Agent> {
    try {
      const id = `agent-${Date.now()}`;
      const now = new Date().toISOString();

      const agent: Agent = {
        id,
        name,
        type,
        capabilities,
        status: 'active',
        metrics: {
          responseTime: 0,
          successRate: 100,
          errorRate: 0,
          totalRequests: 0,
          lastActive: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      // Store agent in Recall
      await this.recallService.storeObject(this.BUCKET_NAME, `${id}.json`, agent);

      // Cache in memory
      this.agents.set(id, agent);

      logger.info(`Created new agent: ${id}`, { agentId: id, agentType: type });
      return agent;
    } catch (error) {
      logger.error('Failed to create agent:', error);
      throw new Error(
        `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getAgent(id: string): Promise<Agent | null> {
    try {
      // Check cache first
      const cachedAgent = this.agents.get(id);
      if (cachedAgent) {
        logger.debug(`Retrieved agent from cache: ${id}`);
        return cachedAgent;
      }

      // Fetch from Recall
      const agent = await this.recallService.getObject<Agent>(this.BUCKET_NAME, `${id}.json`);
      if (agent) {
        this.agents.set(id, agent);
        logger.debug(`Retrieved agent from Recall: ${id}`);
        return agent;
      }

      logger.debug(`Agent not found: ${id}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching agent ${id}:`, error);
      throw new Error(
        `Failed to fetch agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listAgents(): Promise<Agent[]> {
    try {
      // Fetch all agent files from Recall
      const agentFiles = await this.recallService.listObjects(this.BUCKET_NAME, '');
      const agents = await Promise.all(
        agentFiles.map(async (file: string) => {
          const id = file.replace('.json', '');
          return this.getAgent(id);
        }),
      );

      const validAgents = agents.filter((agent): agent is Agent => agent !== null);
      logger.info(`Listed ${validAgents.length} agents`);
      return validAgents;
    } catch (error) {
      logger.error('Error listing agents:', error);
      throw new Error(
        `Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async updateAgentMetrics(id: string, metrics: Partial<AgentMetrics>): Promise<Agent> {
    try {
      const agent = await this.getAgent(id);
      if (!agent) {
        const error = new Error(`Agent ${id} not found`);
        logger.error('Failed to update agent metrics:', error);
        throw error;
      }

      const updatedAgent: Agent = {
        ...agent,
        metrics: {
          ...agent.metrics,
          ...metrics,
          lastActive: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      // Update in Recall
      await this.recallService.storeObject(this.BUCKET_NAME, `${id}.json`, updatedAgent);

      // Update cache
      this.agents.set(id, updatedAgent);

      logger.info(`Updated metrics for agent: ${id}`, { agentId: id, metrics });
      return updatedAgent;
    } catch (error) {
      logger.error(`Error updating agent metrics ${id}:`, error);
      throw new Error(
        `Failed to update agent metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
