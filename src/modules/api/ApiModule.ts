/**
 * API Module - Clean Separation of API Concerns
 *
 * This module handles all HTTP API functionality with:
 * - Clean architecture
 * - Dependency injection
 * - Modular routing
 * - Centralized middleware
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { BaseService } from "../../shared/services/BaseService.js";
import { Logger } from "../../shared/logging/Logger.js";
import {
  apiConfig,
  ServiceConfig,
  DependencyHealth,
} from "../../shared/index.js";
import { HealthController } from "./controllers/HealthController.js";
import { AgentsController } from "./controllers/AgentsController.js";
import { TradingController } from "./controllers/TradingController.js";
import { GovernanceController } from "./controllers/GovernanceController.js";
import { MetricsController } from "./controllers/MetricsController.js";
import { SapienceController } from "./controllers/SapienceController.js";
import { RecallController } from "./controllers/RecallController.js";
import { AuditLogController } from "./controllers/AuditLogController.js";

export class ApiModule extends BaseService {
  private app: express.Application;
  private server: any;
  private controllers: Map<string, any> = new Map();

  constructor() {
    const config: ServiceConfig = {
      name: "api",
      version: "1.0.0",
      environment: (process.env.NODE_ENV as any) || "development",
      port: apiConfig.port,
      logLevel: "info",
    };

    super(config);
    this.app = express();
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info("🔧 ApiModule.onInitialize() starting");
    await this.setupMiddleware();
    this.logger.info("🔧 Middleware setup complete");
    await this.setupControllers();
    this.logger.info("🔧 Controllers setup complete");
    await this.setupRoutes();
    this.logger.info("🔧 Routes setup complete");
    await this.startServer();
    this.logger.info("🔧 Server started - ApiModule.onInitialize() complete");
  }

  protected async onShutdown(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          this.logger.info("HTTP server closed");
          resolve();
        });
      });
    }
  }

  protected async checkDependencies(): Promise<
    Record<string, DependencyHealth>
  > {
    // Check if server is listening
    const serverHealth: DependencyHealth = {
      status: this.server?.listening ? "healthy" : "unhealthy",
    };

    return {
      server: serverHealth,
    };
  }

  private async setupMiddleware(): Promise<void> {
    this.logger.info("Setting up middleware...");

    // Trust proxy for rate limiting behind reverse proxy (secure configuration)
    this.app.set('trust proxy', 1); // Trust only first proxy

    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin:
          apiConfig.corsOrigin === "*" ? true : apiConfig.corsOrigin.split(","),
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-API-KEY", "Authorization"],
      })
    );

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: apiConfig.rateLimit.windowMs,
      max: apiConfig.rateLimit.maxRequests,
      message: {
        error: "Too many requests from this IP, please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use("/api/", limiter);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        this.logger.logRequest(req, res, duration);
      });

      next();
    });

    // API key middleware for protected routes
    this.app.use("/api/", this.apiKeyMiddleware.bind(this));
  }

  private apiKeyMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void {
    // Skip API key check for health endpoint
    if (req.path === "/health") {
      return next();
    }

    const apiKey = req.headers["x-api-key"] as string;

    // Accept multiple valid API keys for testing
    const validApiKeys = [
      apiConfig.apiKey,
      "development-api-key",
      "test-api-key",
      "showcase-api-key",
      "hackathon-api-key",
    ];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      res.status(401).json({
        success: false,
        error: "Invalid API key",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }

  private async setupControllers(): Promise<void> {
    this.logger.info("Setting up controllers...");

    const { AgentsModule } = await import("../agents/AgentsModule.js");
    const agentsModule = new AgentsModule();
    await agentsModule.initialize();

    // Initialize controllers with dependency injection
    this.controllers.set("health", new HealthController(agentsModule));
    this.controllers.set("agents", new AgentsController(agentsModule));
    this.controllers.set("trading", new TradingController());
    this.controllers.set("governance", new GovernanceController());
    this.controllers.set("metrics", new MetricsController());
    this.controllers.set("sapience", new SapienceController());
    this.controllers.set("recall", new RecallController());
    this.controllers.set("audit", new AuditLogController());

    // Initialize all controllers
    for (const [name, controller] of this.controllers) {
      if (controller.initialize && name !== "agents") { 
        await controller.initialize();
        this.logger.debug(`${name} controller initialized`);
      }
    }
  }

  private async setupRoutes(): Promise<void> {
    this.logger.info("Setting up routes...");

    // Health check (no API key required)
    this.app.get("/health", (req, res) => {
      this.controllers.get("health").getHealth(req, res);
    });

    // API routes (require API key)
    const apiRouter = express.Router();

    // System health
    apiRouter.get("/system/health", (req, res) => {
      this.controllers.get("health").getSystemHealth(req, res);
    });

    // Agents routes - Showcase agents for AI governance platform
    apiRouter.get("/agents", (req, res) => {
      this.controllers.get("agents").getAgents(req, res);
    });

    // Legacy routes for monitoring (must come before :id routes)
    apiRouter.get("/agents/monitoring", (req, res) => {
      this.controllers.get("agents").getMonitoring(req, res);
    });

    apiRouter.get("/agents/unified", (req, res) => {
      this.controllers.get("agents").getUnified(req, res);
    });

    apiRouter.get("/agents/:id", (req, res) => {
      this.controllers.get("agents").getAgent(req, res);
    });

    apiRouter.get("/agents/:id/status", (req, res) => {
      this.controllers.get("agents").getAgentStatus(req, res);
    });

    apiRouter.post("/agents/:id/start", (req, res) => {
      this.controllers.get("agents").startAgent(req, res);
    });

    apiRouter.post("/agents/:id/stop", (req, res) => {
      this.controllers.get("agents").stopAgent(req, res);
    });

    // Trading routes
    apiRouter.get("/trading/status/:agentId", (req, res) => {
      this.controllers.get("trading").getStatus(req, res);
    });

    apiRouter.get("/trading/decisions/:agentId", (req, res) => {
      this.controllers.get("trading").getDecisions(req, res);
    });

    // Governance routes
    apiRouter.get("/governance/policies", (req, res) => {
      this.controllers.get("governance").getPolicies(req, res);
    });

    apiRouter.post("/governance/policies", (req, res) => {
      this.controllers.get("governance").createPolicy(req, res);
    });

    // Metrics routes
    apiRouter.get("/metrics/daily", (req, res) => {
      this.controllers.get("metrics").getDailyMetrics(req, res);
    });

    // Audit routes
    apiRouter.get("/audit-logs", (req, res) => {
      this.controllers.get("audit").getLogs(req, res);
    });

    // Sapience routes
    apiRouter.get("/sapience/status", (req, res) => {
      this.controllers.get("sapience").getStatus(req, res);
    });

    apiRouter.post("/sapience/forecast", (req, res) => {
      this.controllers.get("sapience").submitForecast(req, res);
    });

    apiRouter.post("/sapience/forecast/auto", (req, res) => {
      this.controllers.get("sapience").submitAutomatedForecast(req, res);
    });

    apiRouter.get("/sapience/wallet", (req, res) => {
      this.controllers.get("sapience").getWallet(req, res);
    });

    // Recall routes
    apiRouter.get("/recall/status", (req, res) => {
      this.controllers.get("recall").getStatus(req, res);
    });

    apiRouter.post("/recall/store", (req, res) => {
      this.controllers.get("recall").storeMemory(req, res);
    });

    apiRouter.get("/recall/query", (req, res) => {
      this.controllers.get("recall").queryMemories(req, res);
    });

    // Dashboard routes
    apiRouter.get("/dashboard/unified", (req, res) => {
      this.controllers.get("agents").getUnified(req, res);
    });

    // Mount API router
    this.app.use("/api", apiRouter);

    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        timestamp: new Date().toISOString(),
      });
    });

    // Error handler
    this.app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        this.logger.error("Unhandled error in API:", error);

        res.status(500).json({
          success: false,
          error: "Internal server error",
          timestamp: new Date().toISOString(),
        });
      }
    );
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`API server listening on port ${this.config.port}`);
        resolve();
      });

      this.server.on("error", (error: Error) => {
        this.logger.error("Server error:", error);
        reject(error);
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}
