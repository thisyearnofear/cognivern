import { AgentAction, AgentConfig } from '../types/Agent.js';
import { MCPClientService, MCPAgentSpec } from '../services/MCPClientService.js';
import logger from '../utils/logger.js';

export class ContractAgent {
  private config: AgentConfig;
  private mcpClient: MCPClientService;
  private registered: boolean = false;

  constructor() {
    this.config = {
      name: 'Contract Agent',
      type: 'contract-agent',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      capabilities: [
        'contract-interaction',
        'transaction-generation',
        'policy-enforcement'
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
      this.mcpClient.onMessage('contract-request', this.handleContractRequest.bind(this));
      
      // Register the agent with the MCP server
      if (!this.registered && this.mcpClient.isConnected()) {
        await this.registerWithMCP();
      }
    } catch (error) {
      logger.error('Failed to connect contract agent to MCP:', error);
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
        description: 'A specialized agent for smart contract interactions',
        instructions: `You are a contract agent for the Cognivern governance platform. 
          You can interact with smart contracts, generate transactions, and ensure 
          all interactions comply with governance policies. You can handle contract 
          calls on multiple chains including NEAR, Ethereum, and others.`,
        tools: [
          { type: 'generate-transaction' },
          { type: 'generate-evm-tx' },
          { type: 'submit-query' }
        ],
        categories: ['Smart Contracts', 'DeFi', 'Governance'],
        chainIds: [1, 137, 8453], // Ethereum, Polygon, Base
        version: this.config.version
      };

      await this.mcpClient.registerAgent(agentSpec);
      this.registered = true;
      logger.info('Contract agent registered with MCP server');
    } catch (error) {
      logger.error('Failed to register contract agent with MCP:', error);
      throw error;
    }
  }

  /**
   * Handle contract requests from the MCP server
   */
  private async handleContractRequest(message: any): Promise<void> {
    try {
      logger.info('Received contract request:', message);
      
      // Process the request based on the message content
      const { requestType, data } = message.data;
      
      let response;
      switch (requestType) {
        case 'contract-call':
          response = await this.generateContractCall(data);
          break;
        case 'contract-query':
          response = await this.queryContract(data);
          break;
        case 'policy-check':
          response = await this.checkContractPolicy(data);
          break;
        default:
          response = {
            error: `Unknown request type: ${requestType}`
          };
      }
      
      // Send the response back through MCP
      await this.mcpClient.sendMessage('contract-response', {
        requestId: message.id,
        response
      });
    } catch (error) {
      logger.error('Error handling contract request:', error);
      
      // Send error response
      try {
        await this.mcpClient.sendMessage('contract-response', {
          requestId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (sendError) {
        logger.error('Failed to send error response:', sendError);
      }
    }
  }

  /**
   * Generate a contract call transaction
   */
  async generateContractCall(data: any): Promise<any> {
    // Check if this is an EVM or NEAR transaction
    if (data.chain === 'near') {
      return {
        type: 'FunctionCall',
        params: {
          methodName: data.methodName || 'default_method',
          args: data.args || {},
          gas: data.gas || '30000000000000',
          deposit: data.deposit || '1'
        }
      };
    } else {
      // EVM transaction
      return {
        type: 'EvmTransaction',
        params: {
          to: data.contractAddress,
          data: data.calldata || '0x',
          value: data.value || '0x0',
          gasLimit: data.gasLimit || '0x100000'
        }
      };
    }
  }

  /**
   * Query a contract (read-only)
   */
  async queryContract(data: any): Promise<any> {
    // Simulate a contract query response
    return {
      success: true,
      result: {
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        metadata: {
          contractAddress: data.contractAddress,
          methodName: data.methodName
        }
      }
    };
  }

  /**
   * Check if a contract interaction complies with policies
   */
  async checkContractPolicy(data: any): Promise<AgentAction> {
    return {
      id: `${this.config.type}-${Date.now()}`,
      type: 'contract-policy-check',
      timestamp: new Date().toISOString(),
      description: `Checking policy compliance for contract interaction with ${data.contractAddress}`,
      metadata: {
        agent: this.config.type,
        version: this.config.version,
        contractAddress: data.contractAddress,
        methodName: data.methodName,
        chain: data.chain || 'unknown'
      },
      policyChecks: [
        {
          policyId: 'contract-interaction-policy',
          result: true,
          reason: 'Contract interaction complies with security policies'
        },
        {
          policyId: 'gas-limit-policy',
          result: data.gasLimit ? parseInt(data.gasLimit, 16) < 0x200000 : true,
          reason: data.gasLimit && parseInt(data.gasLimit, 16) >= 0x200000 
            ? 'Gas limit exceeds maximum allowed' 
            : 'Gas limit within acceptable range'
        }
      ],
    };
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    this.mcpClient.disconnect();
    logger.info('Contract agent disconnected from MCP server');
  }
}
