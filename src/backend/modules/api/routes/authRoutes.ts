import { Router } from "express";
import type { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Wallet auth (SIWE)
  router.post("/auth/nonce", (req, res) => authController.getNonce(req, res));
  router.post("/auth/verify", (req, res) => authController.verify(req, res));

  // Email/password auth
  router.post("/auth/register", (req, res) => authController.register(req, res));
  router.post("/auth/login", (req, res) => authController.login(req, res));
  router.post("/auth/verify-email", (req, res) =>
    authController.verifyEmail(req, res),
  );
  router.post("/auth/forgot-password", (req, res) =>
    authController.forgotPassword(req, res),
  );
  router.post("/auth/reset-password", (req, res) =>
    authController.resetPassword(req, res),
  );

  // Protected routes
  router.get("/auth/me", authMiddleware, (req, res) =>
    authController.getMe(req, res),
  );
  router.post("/auth/logout", authMiddleware, (req, res) =>
    authController.logout(req, res),
  );

  return router;
}
