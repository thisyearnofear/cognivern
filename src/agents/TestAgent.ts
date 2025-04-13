import { v4 as uuidv4 } from 'uuid';
import { AgentAction, AgentConfig } from '../types/Agent';

export class TestAgent {
  private config: AgentConfig;
  private requestsPerMinute: number = 0;
  private lastMinuteReset: number = Date.now();

  constructor() {
    this.config = {
      name: 'test-agent-1',
      type: 'test',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'active',
      capabilities: ['data-analysis', 'decision-making', 'resource-management'],
    };
  }

  // Simulates different types of actions to test policy enforcement
  async performAction(type: string, authenticated: boolean = true): Promise<AgentAction> {
    // Update rate limiting counter
    this.updateRequestCount();

    const action: AgentAction = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type,
      description: `Performing ${type} action`,
      metadata: {
        authenticated,
        requestsPerMinute: this.requestsPerMinute,
        resourceUsage: {
          cpu: Math.random() * 100,
          memory: Math.random() * 1024,
        },
      },
      policyChecks: [], // Will be filled by PolicyEnforcementService
    };

    // Simulate action execution time
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

    return action;
  }

  // Simulates a high-load scenario
  async performHighLoadTest(numRequests: number): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    for (let i = 0; i < numRequests; i++) {
      const action = await this.performAction('high-load-test');
      actions.push(action);
    }
    return actions;
  }

  // Simulates unauthorized access attempt
  async performUnauthorizedAction(): Promise<AgentAction> {
    return this.performAction('sensitive-operation', false);
  }

  // Simulates resource-intensive operation
  async performResourceIntensiveAction(): Promise<AgentAction> {
    const action = await this.performAction('resource-intensive');
    action.metadata.resourceUsage = {
      cpu: 90 + Math.random() * 10,
      memory: 900 + Math.random() * 124,
    };
    return action;
  }

  private updateRequestCount(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60000) {
      this.requestsPerMinute = 1;
      this.lastMinuteReset = now;
    } else {
      this.requestsPerMinute++;
    }
  }

  getConfig(): AgentConfig {
    return this.config;
  }
}
