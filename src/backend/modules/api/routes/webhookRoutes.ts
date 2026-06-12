import { Router } from "express";
import type { WebhookController } from "../controllers/WebhookController.js";

export function createWebhookRoutes(
  webhookController: WebhookController,
): Router {
  const router = Router();

  router.post("/webhooks/chain-gpt-news", (req, res) =>
    webhookController.handleChainGptNews(req, res),
  );

  router.get("/webhooks/holds", (req, res) =>
    webhookController.listHolds(req, res),
  );

  router.post("/webhooks/holds/:policyId/release", (req, res) =>
    webhookController.releaseHold(req, res),
  );

  return router;
}
