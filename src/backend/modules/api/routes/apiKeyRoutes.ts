import { Router } from "express";
import type { ApiKeyController } from "@backend/modules/api/controllers/ApiKeyController.js";
import { authMiddleware } from "@backend/middleware/authMiddleware.js";

export function createApiKeyRoutes(apiKeyController: ApiKeyController): Router {
  const router = Router();

  router.get("/api-keys", authMiddleware, (req, res) =>
    apiKeyController.listKeys(req, res),
  );
  router.post("/api-keys", authMiddleware, (req, res) =>
    apiKeyController.createKey(req, res),
  );
  router.delete("/api-keys/:keyId", authMiddleware, (req, res) =>
    apiKeyController.revokeKey(req, res),
  );

  return router;
}
