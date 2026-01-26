import { AgentService } from '../../domain/agents/AgentService.js';
import { Agent } from '../../domain/agents/Agent.js';
import logger from '../../utils/logger.js';

// Application service to orchestrate agent creation
export class CreateAgentHandler {
  private agentService: AgentService;

  constructor(agentService?: AgentService) {
    this.agentService = agentService || new AgentService();
  }

  async execute(name: string, type: Agent['type'], capabilities: string[]): Promise<Agent> {
    // Create agent in domain
    const agent = this.agentService.createAgent(name, type, capabilities);
    // Log persistence action
    logger.info(`Agent created and persisted: ${agent.id}`, { agent });
    return agent;
  }
}