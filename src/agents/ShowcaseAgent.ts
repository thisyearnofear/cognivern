import { AgentAction, AgentConfig } from '../types/Agent.js';
import { MCPClientService, MCPAgentSpec } from '../services/MCPClientService.js';
import logger from '../utils/logger.js';

export class ShowcaseAgent {
  private config: AgentConfig;
  private mcpClient: MCPClientService;
  private registered: boolean = false;

  constructor() {
    this.config = {
      name: 'Showcase Agent',
      type: 'showcase',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      capabilities: [
        'policy-enforcement',
        'metric-collection',
        'audit-logging',
        'contract-interaction',
        'transaction-generation'
      ],
    };

    this.mcpClient = new MCPClientService();
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Connect to the MCP server and register the agent
   */
  async connect(): Promise<void> {
    try {
      this.mcpClient.connect();
      
      // Set up message handlers
      this.mcpClient.onMessage('agent-request', this.handleAgentRequest.bind(this));
      
      // Register the agent with the MCP server
      if (!this.registered && this.mcpClient.isConnected()) {
        await this.registerWithMCP();
      }
    } catch (error) {
      logger.error('Failed to connect showcase agent to MCP:', error);
      throw error;
    }
  }

  /**
   * Register the agent with the MCP server
   */
  private async registerWithMCP(): Promise<void> {
    try {
      const agentSpec: MCPAgentSpec = {
        name: this.config.name,
        description: 'A showcase agent demonstrating Cognivern platform capabilities',
        instructions: `You are a showcase agent for the Cognivern governance platform. 
          You can demonstrate policy enforcement, metric collection, audit logging, 
          and other governance capabilities. You can also generate transactions for 
          blockchain interactions.`,
        tools: [
          { type: 'generate-transaction' },
          { type: 'submit-query' }
        ],
        categories: ['Governance', 'Showcase', 'Demo'],
        version: this.config.version
      };

      await this.mcpClient.registerAgent(agentSpec);
      this.registered = true;
      logger.info('Showcase agent registered with MCP server');
    } catch (error) {
      logger.error('Failed to register showcase agent with MCP:', error);
      throw error;
    }
  }

  /**
   * Handle agent requests from the MCP server
   */
  private async handleAgentRequest(message: any): Promise<void> {
    try {
      logger.info('Received agent request:', message);
      
      // Process the request based on the message content
      const { requestType, data } = message.data;
      
      let response;
      switch (requestType) {
        case 'policy-check':
          response = await this.performPolicyCheck(data);
          break;
        case 'generate-transaction':
          response = await this.generateTransaction(data);
          break;
        case 'collect-metrics':
          response = await this.collectMetrics();
          break;
        default:
          response = {
            error: `Unknown request type: ${requestType}`
          };
      }
      
      // Send the response back through MCP
      await this.mcpClient.sendMessage('agent-response', {
        requestId: message.id,
        response
      });
    } catch (error) {
      logger.error('Error handling agent request:', error);
      
      // Send error response
      try {
        await this.mcpClient.sendMessage('agent-response', {
          requestId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (sendError) {
        logger.error('Failed to send error response:', sendError);
      }
    }
  }

  /**
   * Perform a policy check
   */
  async performPolicyCheck(data: any): Promise<AgentAction> {
    return {
      id: `${this.config.type}-${Date.now()}`,
      type: 'policy-check',
      timestamp: new Date().toISOString(),
      description: `Performing policy check for ${data.actionType || 'unknown'} action`,
      metadata: {
        agent: this.config.type,
        version: this.config.version,
        policyId: data.policyId || 'default-policy',
        actionType: data.actionType || 'unknown'
      },
      policyChecks: [
        {
          policyId: data.policyId || 'default-policy',
          result: true,
          reason: 'Action complies with policy'
        }
      ],
    };
  }

  /**
   * Generate a transaction
   */
  async generateTransaction(data: any): Promise<any> {
    return {
      type: 'FunctionCall',
      params: {
        methodName: data.methodName || 'default_method',
        args: data.args || {},
        gas: data.gas || '30000000000000',
        deposit: data.deposit || '1'
      }
    };
  }

  /**
   * Collect metrics
   */
  async collectMetrics(): Promise<any> {
    return {
      responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
      successRate: 98.5,
      errorRate: 1.5,
      totalRequests: 1250,
      lastActive: new Date().toISOString()
    };
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    this.mcpClient.disconnect();
    logger.info('Showcase agent disconnected from MCP server');
  }
}
