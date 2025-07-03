import logger from '../utils/logger.js';

export interface WalletInfo {
  address: string;
  balance: string;
  isConnected: boolean;
}

export interface DeploymentTransaction {
  id: string;
  timestamp: string;
  agentId: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  error?: string;
}

export class BitteWalletService {
  private apiKey: string;
  private apiUrl: string;
  private connected: boolean = false;
  private walletInfo: WalletInfo | null = null;
  private deployments: Map<string, DeploymentTransaction> = new Map();

  constructor() {
    this.apiKey = process.env.BITTE_API_KEY || '';
    this.apiUrl = 'https://api.bitte.ai';
    
    if (!this.apiKey) {
      logger.warn('Bitte API key not provided. Wallet functionality will be limited.');
    }
  }

  /**
   * Connect to the Bitte wallet service
   */
  public async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    if (!this.apiKey) {
      logger.error('Cannot connect to Bitte wallet: API key not provided');
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/wallet/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to Bitte wallet: ${response.statusText}`);
      }

      const data = await response.json();
      this.walletInfo = {
        address: data.address,
        balance: data.balance,
        isConnected: true
      };
      
      this.connected = true;
      logger.info(`Connected to Bitte wallet: ${this.walletInfo.address}`);
      return true;
    } catch (error) {
      logger.error('Error connecting to Bitte wallet:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Get wallet information
   */
  public async getWalletInfo(): Promise<WalletInfo | null> {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        return null;
      }
    }

    try {
      const response = await fetch(`${this.apiUrl}/wallet/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get wallet info: ${response.statusText}`);
      }

      const data = await response.json();
      this.walletInfo = {
        address: data.address,
        balance: data.balance,
        isConnected: true
      };
      
      return this.walletInfo;
    } catch (error) {
      logger.error('Error getting wallet info:', error);
      return this.walletInfo; // Return cached info if available
    }
  }

  /**
   * Deploy an agent using the Bitte wallet
   * @param agentId The ID of the agent to deploy
   * @param metadata Additional metadata for the deployment
   */
  public async deployAgent(agentId: string, metadata: any = {}): Promise<DeploymentTransaction> {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Cannot deploy agent: Not connected to Bitte wallet');
      }
    }

    try {
      // Create a deployment transaction record
      const deploymentId = `deploy-${Date.now()}-${agentId}`;
      const deployment: DeploymentTransaction = {
        id: deploymentId,
        timestamp: new Date().toISOString(),
        agentId,
        status: 'pending'
      };
      
      this.deployments.set(deploymentId, deployment);
      
      // Send deployment request to Bitte API
      const response = await fetch(`${this.apiUrl}/agents/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          agentId,
          metadata,
          walletAddress: this.walletInfo?.address
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to deploy agent: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update deployment record
      const updatedDeployment: DeploymentTransaction = {
        ...deployment,
        status: 'confirmed',
        txHash: data.txHash
      };
      
      this.deployments.set(deploymentId, updatedDeployment);
      logger.info(`Agent ${agentId} deployed successfully. Transaction: ${data.txHash}`);
      
      return updatedDeployment;
    } catch (error) {
      logger.error(`Error deploying agent ${agentId}:`, error);
      
      // Update deployment record with error
      const failedDeployment = this.deployments.get(agentId) || {
        id: `deploy-${Date.now()}-${agentId}`,
        timestamp: new Date().toISOString(),
        agentId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      failedDeployment.status = 'failed';
      failedDeployment.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.deployments.set(failedDeployment.id, failedDeployment);
      
      throw error;
    }
  }

  /**
   * Get deployment status
   * @param deploymentId The ID of the deployment
   */
  public getDeploymentStatus(deploymentId: string): DeploymentTransaction | null {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * Get all deployments
   */
  public getAllDeployments(): DeploymentTransaction[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Disconnect from the Bitte wallet service
   */
  public disconnect(): void {
    this.connected = false;
    this.walletInfo = null;
    logger.info('Disconnected from Bitte wallet');
  }
}

// Export a singleton instance
export const bitteWalletService = new BitteWalletService();
