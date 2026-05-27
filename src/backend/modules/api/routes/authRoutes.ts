import { Router } from "express";
import type { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/auth/nonce", (req, res) => authController.getNonce(req, res));
  router.post("/auth/verify", (req, res) => authController.verify(req, res));
  router.get("/auth/me", authMiddleware, (req, res) =>
    authController.getMe(req, res),
  );

  return router;
}
