import { AgentAction, AgentConfig } from '../types/Agent.js';

export class TestAgent {
  private config: AgentConfig;

  constructor() {
    this.config = {
      name: 'Test Agent',
      type: 'test',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      capabilities: ['data-analysis', 'resource-intensive'],
    };
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  async performAction(actionType: string): Promise<AgentAction> {
    return {
      id: `${this.config.type}-${Date.now()}`,
      type: actionType,
      timestamp: new Date().toISOString(),
      description: `Performing ${actionType} action`,
      metadata: {
        agent: this.config.type,
        version: this.config.version,
      },
      policyChecks: [],
    };
  }

  async performUnauthorizedAction(): Promise<AgentAction> {
    return this.performAction('unauthorized-access');
  }

  async performHighLoadTest(requestsPerMinute: number): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    for (let i = 0; i < requestsPerMinute; i++) {
      actions.push({
        id: `${this.config.type}-${Date.now()}-${i}`,
        type: 'high-load-test',
        timestamp: new Date().toISOString(),
        description: `High load test iteration ${i}/${requestsPerMinute}`,
        metadata: {
          agent: this.config.type,
          version: this.config.version,
          requestsPerMinute,
          iteration: i,
        },
        policyChecks: [],
      });
    }
    return actions;
  }

  async performResourceIntensiveAction(): Promise<AgentAction> {
    return this.performAction('resource-intensive');
  }
}
