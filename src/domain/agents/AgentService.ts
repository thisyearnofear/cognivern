import { Agent, AgentMetrics } from './Agent.js';

export class AgentService {
  private agents: Map<string, Agent>;

  constructor() {
    this.agents = new Map();
  }

  createAgent(name: string, type: Agent['type'], capabilities: string[]): Agent {
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
    this.agents.set(id, agent);
    return agent;
  }

  getAgent(id: string): Agent | null {
    return this.agents.get(id) || null;
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  updateAgentMetrics(id: string, metrics: Partial<AgentMetrics>): Agent | null {
    const agent = this.getAgent(id);
    if (!agent) return null;
    const updatedAgent: Agent = {
      ...agent,
      metrics: {
        ...agent.metrics,
        ...metrics,
        lastActive: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }
}
