import express, { Router } from 'express';
import { walletController } from '../controllers/WalletController.js';
import { apiKeyMiddleware } from '../middleware/apiKeyMiddleware.js';

const router: Router = express.Router();

// Apply API key middleware to all wallet routes
router.use(apiKeyMiddleware);

// Wallet routes
router.post('/connect', walletController.connect.bind(walletController));
router.get('/info', walletController.getWalletInfo.bind(walletController));
router.post('/deploy', walletController.deployAgent.bind(walletController));
router.get('/deployments', walletController.getAllDeployments.bind(walletController));
router.get(
  '/deployments/:deploymentId',
  walletController.getDeploymentStatus.bind(walletController),
);

export default router;
