import { Agent, AgentMetrics } from '../types/index.js';
import { RecallService } from './RecallService.js';
import logger from '../utils/logger.js';

export class AgentService {
  private recallService: RecallService;
  private agents: Map<string, Agent>;

  constructor() {
    this.recallService = new RecallService();
    this.agents = new Map();
  }

  async createAgent(name: string, type: Agent['type'], capabilities: string[]): Promise<Agent> {
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
    await this.recallService.storeObject('agents', `${id}.json`, agent);

    // Cache in memory
    this.agents.set(id, agent);

    logger.info(`Created new agent: ${id}`);
    return agent;
  }

  async getAgent(id: string): Promise<Agent | null> {
    // Check cache first
    const cachedAgent = this.agents.get(id);
    if (cachedAgent) {
      return cachedAgent;
    }

    // Fetch from Recall
    try {
      const agent = await this.recallService.getObject<Agent>('agents', `${id}.json`);
      if (agent) {
        this.agents.set(id, agent);
        return agent;
      }
    } catch (error) {
      logger.error(`Error fetching agent ${id}:`, error);
    }

    return null;
  }

  async listAgents(): Promise<Agent[]> {
    try {
      // Fetch all agent files from Recall
      const agentFiles = await this.recallService.listObjects('agents', '');
      const agents = await Promise.all(
        agentFiles.map(async (file: string) => {
          const id = file.replace('.json', '');
          return this.getAgent(id);
        }),
      );

      return agents.filter((agent: Agent | null): agent is Agent => agent !== null);
    } catch (error) {
      logger.error('Error listing agents:', error);
      return [];
    }
  }

  async updateAgentMetrics(id: string, metrics: Partial<AgentMetrics>): Promise<void> {
    const agent = await this.getAgent(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
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
    await this.recallService.storeObject('agents', `${id}.json`, updatedAgent);

    // Update cache
    this.agents.set(id, updatedAgent);

    logger.info(`Updated metrics for agent: ${id}`);
  }
}
