import { GovernanceStorageService, GovernanceObject } from './GovernanceStorageService.js';
import { AssetMatch } from '../types/index.js';

export interface AgentThought {
  timestamp: string;
  thought: string;
  confidence: number;
  metadata?: {
    modelVersion?: string;
    policyVersion?: string;
    context?: any;
  };
}

export interface AgentAction {
  timestamp: string;
  action: string;
  input: any;
  output: any;
  metadata?: {
    modelVersion?: string;
    policyVersion?: string;
    context?: any;
  };
}

export interface AgentMetrics {
  performance: {
    responseTime: number;
    successRate: number;
    errorRate: number;
  };
  compliance: {
    policyViolations: number;
    lastAudit: string;
    auditScore: number;
  };
}

export class GovernanceAgent {
  private storageService!: GovernanceStorageService;
  private agentId: string;
  private thoughtHistory: AgentThought[];
  private actionHistory: AgentAction[];
  private metrics: AgentMetrics;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.thoughtHistory = [];
    this.actionHistory = [];
    this.metrics = {
      performance: {
        responseTime: 0,
        successRate: 0,
        errorRate: 0,
      },
      compliance: {
        policyViolations: 0,
        lastAudit: new Date().toISOString(),
        auditScore: 100,
      },
    };
  }

  async initialize(): Promise<void> {
    this.storageService = new GovernanceStorageService();
    await this.storageService.initializeSystem();
    await this.loadState();
  }

  private async loadState(): Promise<void> {
    try {
      // Load thought history
      const thoughts = await this.storageService.listObjects('agents', `${this.agentId}/thoughts/`);
      this.thoughtHistory = thoughts.map((t) => t.data as AgentThought);

      // Load action history
      const actions = await this.storageService.listObjects('agents', `${this.agentId}/actions/`);
      this.actionHistory = actions.map((a) => a.data as AgentAction);

      // Load metrics
      const metricsObj = await this.storageService.getObject(
        'agents',
        `${this.agentId}/metrics.json`,
      );
      if (metricsObj) {
        this.metrics = metricsObj.data as AgentMetrics;
      }
    } catch (error) {
      console.error('Error loading agent state:', error);
    }
  }

  async logThought(thought: string, confidence: number, metadata?: any): Promise<void> {
    const agentThought: AgentThought = {
      timestamp: new Date().toISOString(),
      thought,
      confidence,
      metadata: {
        ...metadata,
        modelVersion: '1.0.0', // TODO: Get from actual model
        policyVersion: '1.0.0', // TODO: Get from actual policy
      },
    };

    // Store locally
    this.thoughtHistory.push(agentThought);

    // Store in Recall
    const object: GovernanceObject = {
      key: `${this.agentId}/thoughts/${Date.now()}.json`,
      size: JSON.stringify(agentThought).length,
      timestamp: Date.now(),
      data: agentThought,
      metadata: {
        agentId: this.agentId,
        type: 'cot-log',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('agents', object);
  }

  async logAction(action: string, input: any, output: any, metadata?: any): Promise<void> {
    const agentAction: AgentAction = {
      timestamp: new Date().toISOString(),
      action,
      input,
      output,
      metadata: {
        ...metadata,
        modelVersion: '1.0.0', // TODO: Get from actual model
        policyVersion: '1.0.0', // TODO: Get from actual policy
      },
    };

    // Store locally
    this.actionHistory.push(agentAction);

    // Store in Recall
    const object: GovernanceObject = {
      key: `${this.agentId}/actions/${Date.now()}.json`,
      size: JSON.stringify(agentAction).length,
      timestamp: Date.now(),
      data: agentAction,
      metadata: {
        agentId: this.agentId,
        type: 'action',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('agents', object);
  }

  async updateMetrics(metrics: Partial<AgentMetrics>): Promise<void> {
    this.metrics = {
      ...this.metrics,
      ...metrics,
    };

    const object: GovernanceObject = {
      key: `${this.agentId}/metrics.json`,
      size: JSON.stringify(this.metrics).length,
      timestamp: Date.now(),
      data: this.metrics,
      metadata: {
        agentId: this.agentId,
        type: 'metric',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('agents', object);
  }

  getThoughtHistory(): AgentThought[] {
    return this.thoughtHistory;
  }

  getActionHistory(): AgentAction[] {
    return this.actionHistory;
  }

  getMetrics(): AgentMetrics {
    return this.metrics;
  }

  async scanForAssets(userIdentifiers: string[]): Promise<AssetMatch[]> {
    if (!this.storageService) {
      throw new Error('GovernanceAgent not initialized. Call initialize() first.');
    }

    await this.logThought(
      `Scanning for assets with identifiers: ${userIdentifiers.join(', ')}`,
      0.95,
    );

    // Mock asset match for demonstration
    const mockAssetMatch: AssetMatch = {
      id: 'asset-123',
      amount: 1000.0,
      source: 'Bank XYZ',
      assetType: 'bank',
      lastKnownDate: new Date(),
      confidence: 0.95,
      ownerIdentifiers: userIdentifiers,
      documentationRequired: ['ID', 'Proof of Address'],
    };

    // Store the asset match in Recall
    const object: GovernanceObject = {
      key: `asset-matches/match-${mockAssetMatch.id}.json`,
      size: JSON.stringify(mockAssetMatch).length,
      timestamp: Date.now(),
      data: {
        ...mockAssetMatch,
        lastKnownDate: mockAssetMatch.lastKnownDate.toISOString(),
      },
      metadata: {
        agentId: this.agentId,
        type: 'asset-match',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('agents', object);

    await this.logThought(`Found asset match: ${JSON.stringify(mockAssetMatch)}`, 0.95);
    return [mockAssetMatch];
  }
}
