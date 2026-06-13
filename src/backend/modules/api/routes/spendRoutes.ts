import { Router } from "express";
import type { SpendController } from "../controllers/SpendController.js";
import type { OwsController } from "../controllers/OwsController.js";
import type { OwsWalletController } from "../controllers/OwsWalletController.js";
import type { OwsApiKeyController } from "../controllers/OwsApiKeyController.js";
import type { OwsPermissionsController } from "../controllers/OwsPermissionsController.js";
import { sharedAgentPreferenceService } from "../../../services/AgentPreferenceService.js";

export function createSpendRoutes(
  spendController: SpendController,
  owsController: OwsController,
  owsWalletController: OwsWalletController,
  owsApiKeyController: OwsApiKeyController,
  owsPermissionsController: OwsPermissionsController,
): Router {
  const router = Router();

  // SpendOS routes
  router.post("/spend", (req, res) => spendController.requestSpend(req, res));
  router.post("/spend/encrypted", (req, res) =>
    spendController.requestEncryptedSpend(req, res),
  );
  router.post("/spend/preview", (req, res) =>
    spendController.previewSpend(req, res),
  );
  router.get("/spend/status", (req, res) =>
    spendController.getStatus(req, res),
  );
  router.get("/spend/scan", (req, res) =>
    spendController.scanContract(req, res),
  );
  router.post("/spend/:decisionId/confirm", (req, res) =>
    spendController.confirmDecision(req, res),
  );

  // OWS status
  router.get("/ows/status", (req, res) => owsController.getStatus(req, res));

  // Wallet routes
  router.get("/ows/health", (req, res) =>
    owsWalletController.getHealth(req, res),
  );
  router.get("/ows/dashboard", (req, res) =>
    owsWalletController.getDashboard(req, res),
  );
  router.post("/ows/bootstrap", (req, res) =>
    owsWalletController.bootstrap(req, res),
  );
  router.get("/ows/wallets", (req, res) =>
    owsWalletController.listWallets(req, res),
  );
  router.get("/ows/wallets/:id", (req, res) =>
    owsWalletController.getWallet(req, res),
  );
  router.post("/ows/wallets/connect", (req, res) =>
    owsWalletController.connectExternal(req, res),
  );
  router.post("/ows/wallets/import", (req, res) =>
    owsWalletController.importWallet(req, res),
  );

  // Agent routes
  router.get("/ows/agents", (req, res) =>
    owsWalletController.listAgents(req, res),
  );
  router.post("/ows/agents", (req, res) =>
    owsWalletController.createAgent(req, res),
  );

  // API Key routes
  router.get("/ows/api-keys", (req, res) =>
    owsApiKeyController.listApiKeys(req, res),
  );
  router.get("/ows/api-keys/:id", (req, res) =>
    owsApiKeyController.getApiKey(req, res),
  );
  router.post("/ows/api-keys", (req, res) =>
    owsApiKeyController.createApiKey(req, res),
  );
  router.delete("/ows/api-keys/:id", (req, res) =>
    owsApiKeyController.deleteApiKey(req, res),
  );

  // Permissions routes
  router.post("/ows/permissions", (req, res) =>
    owsPermissionsController.requestPermissions(req, res),
  );
  router.get("/ows/permissions/:walletId", (req, res) =>
    owsPermissionsController.getPermissions(req, res),
  );

  // Agent preferences
  router.get("/agents/:agentId/preferences", async (req, res) => {
    const prefs = await sharedAgentPreferenceService.getPreferences(req.params.agentId);
    res.json({ success: true, data: prefs });
  });
  router.delete("/agents/:agentId/preferences", async (req, res) => {
    await sharedAgentPreferenceService.resetPreferences(req.params.agentId);
    res.json({ success: true });
  });

  return router;
}
