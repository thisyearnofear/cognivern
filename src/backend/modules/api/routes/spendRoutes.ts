import { Router } from 'express';
import type { SpendController } from '@backend/modules/api/controllers/SpendController.js';
import type { OwsController } from '@backend/modules/api/controllers/OwsController.js';
import type { OwsWalletController } from '@backend/modules/api/controllers/OwsWalletController.js';
import type { OwsApiKeyController } from '@backend/modules/api/controllers/OwsApiKeyController.js';
import type { OwsPermissionsController } from '@backend/modules/api/controllers/OwsPermissionsController.js';
import type { CleanverseController } from '@backend/modules/api/controllers/CleanverseController.js';
import type { Erc8004Controller } from '@backend/modules/api/controllers/Erc8004Controller.js';
import type { PasskeyVaultController } from '@backend/modules/api/controllers/PasskeyVaultController.js';
import type { EnvioController } from '@backend/modules/api/controllers/EnvioController.js';
import { sharedAgentPreferenceService } from '@backend/services/ai/AgentPreferenceService.js';

export function createSpendRoutes(
  spendController: SpendController,
  owsController: OwsController,
  owsWalletController: OwsWalletController,
  owsApiKeyController: OwsApiKeyController,
  owsPermissionsController: OwsPermissionsController,
  cleanverseCtrl?: CleanverseController,
  erc8004Ctrl?: Erc8004Controller,
  passkeyVaultCtrl?: PasskeyVaultController,
  envioCtrl?: EnvioController,
): Router {
  const router = Router();

  // SpendOS routes
  router.post('/spend/authorizations', (req, res) =>
    spendController.createSourceAuthorization(req, res),
  );
  router.post('/spend', (req, res) => spendController.requestSpend(req, res));
  router.post('/spend/encrypted', (req, res) => spendController.requestEncryptedSpend(req, res));
  router.post('/spend/preview', (req, res) => spendController.previewSpend(req, res));
  router.get('/spend/status', (req, res) => spendController.getStatus(req, res));
  router.get('/spend/scan', (req, res) => spendController.scanContract(req, res));
  router.post('/spend/:decisionId/confirm', (req, res) =>
    spendController.confirmDecision(req, res),
  );

  // Cleanverse CVI/CVA demo + status
  if (cleanverseCtrl) {
    router.get('/cleanverse/status', (req, res) => cleanverseCtrl.getStatus(req, res));
    router.get('/cleanverse/deposit-address', (req, res) =>
      cleanverseCtrl.getDepositAddress(req, res),
    );
    router.post('/cleanverse/screen', (req, res) => cleanverseCtrl.screen(req, res));
  }

  // ERC-8004 agent identity + reputation on Monad
  if (erc8004Ctrl) {
    router.get('/erc8004/status', (req, res) => erc8004Ctrl.getStatus(req, res));
    router.post('/erc8004/register', (req, res) => erc8004Ctrl.register(req, res));
    router.get('/erc8004/agents/:agentId', (req, res) =>
      erc8004Ctrl.getAgent(req, res),
    );
    router.post('/erc8004/agents/:agentId/feedback', (req, res) =>
      erc8004Ctrl.giveFeedback(req, res),
    );
    router.get('/erc8004/agents/:agentId/reputation', (req, res) =>
      erc8004Ctrl.getReputation(req, res),
    );
  }

  // Passkey vault — one passkey wraps the root, many agent keys derive from it
  if (passkeyVaultCtrl) {
    router.get('/passkey-vault/status', (req, res) =>
      passkeyVaultCtrl.getStatus(req, res),
    );
    router.post('/passkey-vault/enroll/begin', (req, res) =>
      passkeyVaultCtrl.enrollBegin(req, res),
    );
    router.post('/passkey-vault/enroll/commit', (req, res) =>
      passkeyVaultCtrl.enrollCommit(req, res),
    );
    router.post('/passkey-vault/unlock/begin', (req, res) =>
      passkeyVaultCtrl.unlockBegin(req, res),
    );
    router.post('/passkey-vault/unlock/commit', (req, res) =>
      passkeyVaultCtrl.unlockCommit(req, res),
    );
    router.post('/passkey-vault/lock', (req, res) =>
      passkeyVaultCtrl.lock(req, res),
    );
    router.get('/passkey-vault/agent-keys', (req, res) =>
      passkeyVaultCtrl.listAgentKeys(req, res),
    );
    router.post('/passkey-vault/agent-keys', (req, res) =>
      passkeyVaultCtrl.deriveAgentKey(req, res),
    );
  }

  // Envio — pull indexed chain events into signed CRE evidence
  if (envioCtrl) {
    router.get('/envio/status', (req, res) => envioCtrl.getStatus(req, res));
    router.get('/envio/events', (req, res) => envioCtrl.listEvents(req, res));
    router.post('/envio/sync', (req, res) => envioCtrl.sync(req, res));
  }

  // OWS status
  router.get('/ows/status', (req, res) => owsController.getStatus(req, res));

  // Wallet routes
  router.get('/ows/health', (req, res) => owsWalletController.getHealth(req, res));
  router.get('/ows/dashboard', (req, res) => owsWalletController.getDashboard(req, res));
  router.post('/ows/bootstrap', (req, res) => owsWalletController.bootstrap(req, res));
  router.get('/ows/wallets', (req, res) => owsWalletController.listWallets(req, res));
  router.get('/ows/wallets/:id', (req, res) => owsWalletController.getWallet(req, res));
  router.post('/ows/wallets/connect', (req, res) => owsWalletController.connectExternal(req, res));
  router.post('/ows/wallets/import', (req, res) => owsWalletController.importWallet(req, res));
  router.patch('/ows/wallets/:id', (req, res) => owsWalletController.updateWallet(req, res));

  // Agent routes
  router.get('/ows/agents', (req, res) => owsWalletController.listAgents(req, res));
  router.post('/ows/agents', (req, res) => owsWalletController.createAgent(req, res));

  // API Key routes
  router.get('/ows/api-keys', (req, res) => owsApiKeyController.listApiKeys(req, res));
  router.get('/ows/api-keys/:id', (req, res) => owsApiKeyController.getApiKey(req, res));
  router.post('/ows/api-keys', (req, res) => owsApiKeyController.createApiKey(req, res));
  router.delete('/ows/api-keys/:id', (req, res) => owsApiKeyController.deleteApiKey(req, res));

  // Permissions routes
  router.post('/ows/permissions', (req, res) =>
    owsPermissionsController.requestPermissions(req, res),
  );
  router.get('/ows/permissions/:walletId', (req, res) =>
    owsPermissionsController.getPermissions(req, res),
  );

  // Agent preferences
  router.get('/agents/:agentId/preferences', async (req, res) => {
    const prefs = await sharedAgentPreferenceService.getPreferences(req.params.agentId);
    res.json({ success: true, data: prefs });
  });
  router.delete('/agents/:agentId/preferences', async (req, res) => {
    await sharedAgentPreferenceService.resetPreferences(req.params.agentId);
    res.json({ success: true });
  });

  return router;
}
