import { Router } from "express";
import type { WebhookController } from "@backend/modules/api/controllers/WebhookController.js";
import { verifyChainGptWebhook } from "@backend/middleware/webhookSignature.js";

export function createWebhookRoutes(
  webhookController: WebhookController,
): Router {
  const router = Router();

  router.post(
    "/webhooks/chain-gpt-news",
    verifyChainGptWebhook,
    (req, res) => webhookController.handleChainGptNews(req, res),
  );

  router.get("/webhooks/holds", (req, res) =>
    webhookController.listHolds(req, res),
  );

  router.post("/webhooks/holds/:policyId/release", (req, res) =>
    webhookController.releaseHold(req, res),
  );

  return router;
}
