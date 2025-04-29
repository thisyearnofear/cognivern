import { Request, Response } from 'express';
import { bitteWalletService } from '../services/BitteWalletService.js';
import logger from '../utils/logger.js';

export class WalletController {
  /**
   * Connect to the Bitte wallet
   */
  public async connect(req: Request, res: Response): Promise<void> {
    try {
      const connected = await bitteWalletService.connect();
      
      if (connected) {
        const walletInfo = await bitteWalletService.getWalletInfo();
        res.status(200).json({
          success: true,
          wallet: walletInfo
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to connect to wallet'
        });
      }
    } catch (error) {
      logger.error('Error connecting to wallet:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get wallet information
   */
  public async getWalletInfo(req: Request, res: Response): Promise<void> {
    try {
      const walletInfo = await bitteWalletService.getWalletInfo();
      
      if (walletInfo) {
        res.status(200).json({
          success: true,
          wallet: walletInfo
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Wallet not connected'
        });
      }
    } catch (error) {
      logger.error('Error getting wallet info:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deploy an agent using the Bitte wallet
   */
  public async deployAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, metadata } = req.body;
      
      if (!agentId) {
        res.status(400).json({
          success: false,
          error: 'Agent ID is required'
        });
        return;
      }
      
      const deployment = await bitteWalletService.deployAgent(agentId, metadata);
      
      res.status(200).json({
        success: true,
        deployment
      });
    } catch (error) {
      logger.error('Error deploying agent:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { deploymentId } = req.params;
      
      if (!deploymentId) {
        res.status(400).json({
          success: false,
          error: 'Deployment ID is required'
        });
        return;
      }
      
      const deployment = bitteWalletService.getDeploymentStatus(deploymentId);
      
      if (deployment) {
        res.status(200).json({
          success: true,
          deployment
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Deployment not found'
        });
      }
    } catch (error) {
      logger.error('Error getting deployment status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all deployments
   */
  public async getAllDeployments(req: Request, res: Response): Promise<void> {
    try {
      const deployments = bitteWalletService.getAllDeployments();
      
      res.status(200).json({
        success: true,
        deployments
      });
    } catch (error) {
      logger.error('Error getting deployments:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export a singleton instance
export const walletController = new WalletController();
