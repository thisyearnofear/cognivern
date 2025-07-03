import { AgentService } from '../../domain/agents/AgentService.js';
import { FilecoinService } from '../../infrastructure/storage/FilecoinService.js';
import { Agent } from '../../domain/agents/Agent.js';

// Application service to orchestrate agent creation
export class CreateAgentHandler {
  private agentService: AgentService;
  private filecoinService: FilecoinService;

  constructor(agentService?: AgentService, filecoinService?: FilecoinService) {
    this.agentService = agentService || new AgentService();
    this.filecoinService = filecoinService || new FilecoinService();
  }

  async execute(name: string, type: Agent['type'], capabilities: string[]): Promise<Agent> {
    // Create agent in domain
    const agent = this.agentService.createAgent(name, type, capabilities);
    // Persist agent in infrastructure
    await this.filecoinService.storeData(`agents/${agent.id}`, agent);
    return agent;
  }
}
