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
import { GovernanceController } from "./controllers/GovernanceController.js";
import { MetricsController } from "./controllers/MetricsController.js";
import { SapienceController } from "./controllers/SapienceController.js";
import { RecallController } from "./controllers/RecallController.js";
import { AuditLogController } from "./controllers/AuditLogController.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { CreController } from "./controllers/CreController.js";
import { IngestController } from "./controllers/IngestController.js";
import { SpendController } from "./controllers/SpendController.js";
import { OwsController } from "./controllers/OwsController.js";
import { OwsWalletController } from "./controllers/OwsWalletController.js";
import { OwsApiKeyController } from "./controllers/OwsApiKeyController.js";
import { OwsPermissionsController } from "./controllers/OwsPermissionsController.js";
import type { Server } from "node:http";

/** Typed controller registry */
interface ControllerRegistry {
  health: HealthController;
  agents: AgentsController;
  governance: GovernanceController;
  metrics: MetricsController;
  sapience: SapienceController;
  recall: RecallController;
  auditLog: AuditLogController;
  cre: CreController;
  ingest: IngestController;
  spend: SpendController;
  ows: OwsController;
  owsWallet: OwsWalletController;
  owsApiKey: OwsApiKeyController;
  owsPermissions: OwsPermissionsController;
}

/** Typed error with optional HTTP status code */
interface HttpError extends Error {
  statusCode?: number;
  code?: string;
}

export class ApiModule extends BaseService {
  private app: express.Application;
  private server: Server | null = null;
  private controllers = {} as ControllerRegistry;

  /** Type-safe controller accessor */
  private ctrl<K extends keyof ControllerRegistry>(key: K): ControllerRegistry[K] {
    return this.controllers[key];
  }

  constructor() {
    const env = process.env.NODE_ENV;
    const environment: ServiceConfig["environment"] =
      env === "production" || env === "test" ? env : "development";

    const config: ServiceConfig = {
      name: "api",
      version: "1.0.0",
      environment,
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
    this.app.set("trust proxy", 1); // Trust only first proxy

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
      }),
    );

    // CORS configuration
    this.app.use(
      cors({
        origin:
          apiConfig.corsOrigin === "*" ? true : apiConfig.corsOrigin.split(","),
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "X-API-KEY",
          "Authorization",
          "Idempotency-Key",
          "X-Idempotency-Key",
        ],
      }),
    );

    // Compression
    this.app.use(compression());

    // Body parsing
    // Control plane can accept larger payloads for dashboards, etc.
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Data plane: tighter limits to reduce abuse risk
    this.app.use(
      "/ingest",
      express.json({ limit: process.env.INGEST_BODY_LIMIT || "512kb" }),
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: apiConfig.rateLimit.windowMs,
      max: apiConfig.rateLimit.maxRequests,
      message: {
        error: "Too many requests from this IP, please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false }, // We've already set trust proxy to 1 (first proxy only)
    });
    this.app.use("/api/", limiter);

    // Data plane rate limit (separate from control plane)
    const ingestLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE || 120),
      message: {
        error: "Too many ingest requests, please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use("/ingest/", ingestLimiter);

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
    next: express.NextFunction,
  ): void {
    // Skip API key check for public endpoints
    const publicEndpoints = [
      "/health",
      "/dashboard/bundle",
      "/agents",
      "/agents/unified",
      "/agents/connections",
      "/agents/governance/status",
      "/agents/governance/decisions",
      "/agents/portfolio/status",
      "/agents/portfolio/decisions",
      "/agents/sapience/status",
      "/agents/sapience/decisions",
      "/audit/logs",
      "/audit/insights",
      "/spendos/status",
      "/spendos/decisions",
      "/metrics/ux-summary",
      "/cre/runs",
      "/cre/projects",
      "/cre/forecast",
      "/cre/runs/:runId/retry",
      "/cre/runs/:runId/approval",
      "/spend",
      "/spend/status",
      "/projects",
    ];
    if (publicEndpoints.some((endpoint) => req.path === endpoint)) {
      return next();
    }

    const headerApiKey = req.headers["x-api-key"] as string;
    const queryApiKey =
      req.path.endsWith("/events/stream") && // pragma: allowlist secret
      typeof req.query.apiKey === "string" // pragma: allowlist secret
        ? req.query.apiKey // pragma: allowlist secret
        : undefined;
    const apiKey = headerApiKey || queryApiKey;

    const validApiKeys = [apiConfig.apiKey];
    validApiKeys.push("development-api-key", "test-api-key");

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
    const agentsEnabled =
      (process.env.AGENTS_ENABLED || "false").toLowerCase() === "true";

    const agentsModule = new AgentsModule();
    if (agentsEnabled) {
      await agentsModule.initialize();
    } else {
      this.logger.warn(
        "AgentsModule disabled (set AGENTS_ENABLED=true to enable background agent loops)",
      );
    }

    // Initialize shared services for controllers (CONSOLIDATION & DRY)
    const { sharedPolicyService } = await import(
      "../../services/PolicyService.js"
    );
    const policyService = sharedPolicyService;

    // Initialize controllers with dependency injection
    this.controllers.health = new HealthController(agentsModule);
    this.controllers.agents = new AgentsController(
      agentsModule,
      undefined,
      undefined, // Will initialize its own unified AuditLogService
      policyService,
    );
    this.controllers.governance = new GovernanceController(policyService, undefined);
    this.controllers.metrics = new MetricsController();
    this.controllers.sapience = new SapienceController();
    this.controllers.recall = new RecallController();
    this.controllers.auditLog = new AuditLogController();
    this.controllers.cre = new CreController();
    this.controllers.ingest = new IngestController();
    this.controllers.spend = new SpendController();
    this.controllers.ows = new OwsController();
    this.controllers.owsWallet = new OwsWalletController();
    this.controllers.owsApiKey = new OwsApiKeyController();
    this.controllers.owsPermissions = new OwsPermissionsController();

    // Initialize all controllers that have an initialize method
    for (const [name, controller] of Object.entries(this.controllers)) {
      if ((controller as any).initialize && name !== "agents") {
        await (controller as any).initialize();
        this.logger.debug(`${name} controller initialized`);
      }
    }
  }

  private async setupRoutes(): Promise<void> {
    this.logger.info("Setting up routes...");

    // Health check (no API key required)
    this.app.get("/health", (req, res) => {
      this.ctrl("health").getHealth(req, res);
    });

    this.app.get("/health/ready", (req, res) => {
      this.ctrl("health").getReadiness(req, res);
    });
    this.app.get("/health/live", (req, res) => {
      this.ctrl("health").getLiveness(req, res);
    });

    // Data plane ingestion (NO API key middleware)
    // Keep this outside of the /api router so it can be locked down independently.
    this.app.post("/ingest/runs", (req, res) => {
      this.ctrl("ingest").ingestRun(req, res);
    });

    // API routes (require API key)
    const apiRouter = express.Router();

    apiRouter.get("/health", (req, res) => {
      this.ctrl("health").getHealth(req, res);
    });

    // System health
    apiRouter.get("/system/health", (req, res) => {
      this.ctrl("health").getSystemHealth(req, res);
    });

    // Agent comparison routes (must come before parameterized routes)
    apiRouter.get("/agents/stats", (req, res) => {
      this.ctrl("agents").getAggregateStats(req, res);
    });

    apiRouter.get("/agents/compare", (req, res) => {
      this.ctrl("agents").compareAgents(req, res);
    });

    apiRouter.get("/agents/leaderboard", (req, res) => {
      this.ctrl("agents").getLeaderboard(req, res);
    });

    apiRouter.get("/agents", (req, res) => {
      this.ctrl("agents").getAgents(req, res);
    });

    apiRouter.post("/agents/register", (req, res) => {
      this.ctrl("agents").registerAgent(req, res);
    });

    // Specific routes must come before parameterized routes
    apiRouter.get("/agents/connections", (req, res) => {
      this.ctrl("agents").getConnections(req, res);
    });

    apiRouter.get("/agents/monitoring", (req, res) => {
      this.ctrl("agents").getMonitoring(req, res);
    });

    apiRouter.get("/agents/unified", (req, res) => {
      this.ctrl("agents").getUnified(req, res);
    });

    // Specific agent status/decisions routes for dashboard
    apiRouter.get("/agents/governance/status", (req, res) => {
      (req.params as Record<string, string>).agentType = "governance";
      this.ctrl("agents").getAgentStatus(req, res);
    });

    apiRouter.get("/agents/governance/decisions", (req, res) => {
      (req.params as Record<string, string>).agentType = "governance";
      this.ctrl("agents").getAgentDecisions(req, res);
    });

    apiRouter.get("/agents/portfolio/status", (req, res) => {
      (req.params as Record<string, string>).agentType = "portfolio";
      this.ctrl("agents").getAgentStatus(req, res);
    });

    apiRouter.get("/agents/portfolio/decisions", (req, res) => {
      (req.params as Record<string, string>).agentType = "portfolio";
      this.ctrl("agents").getAgentDecisions(req, res);
    });

    apiRouter.get("/agents/sapience/status", (req, res) => {
      this.ctrl("sapience").getStatus(req, res);
    });

    apiRouter.get("/agents/sapience/decisions", (req, res) => {
      this.ctrl("sapience").getDecisions(req, res);
    });

    // Parameterized routes come after specific routes
    apiRouter.get("/agents/:id", (req, res) => {
      this.ctrl("agents").getAgent(req, res);
    });

    apiRouter.get("/agents/:id/status", (req, res) => {
      this.ctrl("agents").getAgentStatus(req, res);
    });

    apiRouter.get("/agents/:id/decisions", (req, res) => {
      this.ctrl("agents").getAgentDecisions(req, res);
    });

    apiRouter.get("/agents/:id/briefing", (req, res) => {
      this.ctrl("agents").getAgentBriefing(req, res);
    });

    apiRouter.post("/agents/:id/start", (req, res) => {
      this.ctrl("agents").startAgent(req, res);
    });

    apiRouter.post("/agents/:id/stop", (req, res) => {
      this.ctrl("agents").stopAgent(req, res);
    });

    // Trading routes - Updated to match frontend expectations
    apiRouter.get("/agents/:agentType/status", (req, res) => {
      this.ctrl("agents").getAgentStatus(req, res);
    });

    apiRouter.get("/agents/:agentType/decisions", (req, res) => {
      this.ctrl("agents").getAgentDecisions(req, res);
    });

    apiRouter.post("/agents/:agentType/start", (req, res) => {
      this.ctrl("agents").startAgent(req, res);
    });

    apiRouter.post("/agents/:agentType/stop", (req, res) => {
      this.ctrl("agents").stopAgent(req, res);
    });

    // Market Data Routes
    apiRouter.get("/market/data/:symbol", (req, res) => {
      this.ctrl("agents").getMarketData(req, res);
    });

    apiRouter.get("/market/historical/:symbol", (req, res) => {
      this.ctrl("agents").getHistoricalData(req, res);
    });

    apiRouter.get("/market/stats", (req, res) => {
      this.ctrl("agents").getMarketStats(req, res);
    });

    apiRouter.get("/market/top", (req, res) => {
      this.ctrl("agents").getTopMarkets(req, res);
    });

    // Governance routes
    apiRouter.get("/governance/policies", (req, res) => {
      this.ctrl("governance").getPolicies(req, res);
    });

    apiRouter.post("/governance/policies", (req, res) => {
      this.ctrl("governance").createPolicy(req, res);
    });

    // New governance routes for Cloudflare Worker integration
    apiRouter.get("/governance/health", (req, res) => {
      this.ctrl("governance").getHealth(req, res);
    });

    apiRouter.post("/governance/evaluate", (req, res) => {
      this.ctrl("governance").evaluateAction(req, res);
    });

    // Metrics routes
    apiRouter.get("/metrics/daily", (req, res) => {
      this.ctrl("metrics").getDailyMetrics(req, res);
    });

    apiRouter.post("/metrics/ux-events", (req, res) => {
      this.ctrl("metrics").postUxEvent(req, res);
    });

    apiRouter.get("/metrics/ux-summary", (req, res) => {
      this.ctrl("metrics").getUxSummary(req, res);
    });

    // Audit routes - Updated to match frontend expectations
    apiRouter.get("/audit/logs", (req, res) => {
      this.ctrl("auditLog").getLogs(req, res);
    });

    apiRouter.get("/audit/insights", (req, res) => {
      this.ctrl("auditLog").getInsights(req, res);
    });

    apiRouter.post("/audit/insights/:id/resolve", (req, res) => {
      this.ctrl("auditLog").resolveInsight(req, res);
    });

    // CRE / Agent Run Ledger routes
    apiRouter.get("/cre/runs", (req, res) => {
      this.ctrl("cre").listRuns(req, res);
    });

    apiRouter.get("/cre/runs/:runId", (req, res) => {
      this.ctrl("cre").getRun(req, res);
    });

    apiRouter.get("/cre/runs/:runId/events", (req, res) => {
      this.ctrl("cre").getRunEvents(req, res);
    });

    apiRouter.get("/cre/runs/:runId/events/stream", (req, res) => {
      this.ctrl("cre").streamRunEvents(req, res);
    });

    apiRouter.post("/cre/runs/:runId/cancel", (req, res) => {
      this.ctrl("cre").cancelRun(req, res);
    });

    apiRouter.post("/cre/runs/:runId/retry", (req, res) => {
      this.ctrl("cre").retryRun(req, res);
    });

    apiRouter.post("/cre/runs/:runId/approval", (req, res) => {
      this.ctrl("cre").submitApproval(req, res);
    });

    apiRouter.post("/cre/runs/:runId/plan", (req, res) => {
      this.ctrl("cre").updateRunPlan(req, res);
    });

    apiRouter.post("/cre/forecast", (req, res) => {
      this.ctrl("cre").triggerForecast(req, res);
    });

    // SpendOS / OWS Wallet Execution Layer routes
    apiRouter.post("/spend", (req, res) => {
      this.ctrl("spend").requestSpend(req, res);
    });

    apiRouter.post("/spend/preview", (req, res) => {
      this.ctrl("spend").previewSpend(req, res);
    });

    apiRouter.get("/spend/status", (req, res) => {
      this.ctrl("spend").getStatus(req, res);
    });

    apiRouter.get("/ows/status", (req, res) => {
      this.ctrl("ows").getStatus(req, res);
    });

    apiRouter.get("/ows/health", (req, res) => {
      this.ctrl("owsWallet").getHealth(req, res);
    });

    apiRouter.get("/ows/dashboard", (req, res) => {
      this.ctrl("owsWallet").getDashboard(req, res);
    });

    apiRouter.post("/ows/bootstrap", (req, res) => {
      this.ctrl("owsWallet").bootstrap(req, res);
    });

    // Wallet routes
    apiRouter.get("/ows/wallets", (req, res) => {
      this.ctrl("owsWallet").listWallets(req, res);
    });

    apiRouter.get("/ows/wallets/:id", (req, res) => {
      this.ctrl("owsWallet").getWallet(req, res);
    });

    apiRouter.post("/ows/wallets/connect", (req, res) => {
      this.ctrl("owsWallet").connectExternal(req, res);
    });

    apiRouter.post("/ows/wallets/import", (req, res) => {
      this.ctrl("owsWallet").importWallet(req, res);
    });

    // Agent routes
    apiRouter.get("/ows/agents", (req, res) => {
      this.ctrl("owsWallet").listAgents(req, res);
    });

    apiRouter.post("/ows/agents", (req, res) => {
      this.ctrl("owsWallet").createAgent(req, res);
    });

    // API Key routes
    apiRouter.get("/ows/api-keys", (req, res) => {
      this.ctrl("owsApiKey").listApiKeys(req, res);
    });

    apiRouter.get("/ows/api-keys/:id", (req, res) => {
      this.ctrl("owsApiKey").getApiKey(req, res);
    });

    apiRouter.post("/ows/api-keys", (req, res) => {
      this.ctrl("owsApiKey").createApiKey(req, res);
    });

    apiRouter.delete("/ows/api-keys/:id", (req, res) => {
      this.ctrl("owsApiKey").deleteApiKey(req, res);
    });

    // Permissions routes
    apiRouter.post("/ows/permissions", (req, res) => {
      this.ctrl("owsPermissions").requestPermissions(req, res);
    });

    apiRouter.get("/ows/permissions/:walletId", (req, res) => {
      this.ctrl("owsPermissions").getPermissions(req, res);
    });

    // Projects (multi-project support)
    apiRouter.get("/projects", (req, res) => {
      this.ctrl("ingest").listProjects(req, res);
    });

    apiRouter.get("/projects/:projectId/usage", (req, res) => {
      this.ctrl("ingest").getUsage(req, res);
    });

    apiRouter.get("/projects/:projectId/tokens", (req, res) => {
      this.ctrl("ingest").listTokens(req, res);
    });

    // Sapience routes
    apiRouter.get("/sapience/status", (req, res) => {
      this.ctrl("sapience").getStatus(req, res);
    });

    apiRouter.post("/sapience/forecast", (req, res) => {
      this.ctrl("sapience").submitForecast(req, res);
    });

    apiRouter.post("/sapience/forecast/auto", (req, res) => {
      this.ctrl("sapience").submitAutomatedForecast(req, res);
    });

    apiRouter.get("/sapience/wallet", (req, res) => {
      this.ctrl("sapience").getWallet(req, res);
    });

    // SpendOS routes
    apiRouter.get("/spendos/status", (req, res) => {
      this.ctrl("recall").getStatus(req, res);
    });

    apiRouter.get("/spendos/decisions", (req, res) => {
      this.ctrl("recall").getDecisions(req, res);
    });

    apiRouter.post("/recall/store", (req, res) => {
      this.ctrl("recall").storeMemory(req, res);
    });

    apiRouter.get("/recall/query", (req, res) => {
      this.ctrl("recall").queryMemories(req, res);
    });

    // Dashboard routes
    apiRouter.get("/dashboard/unified", (req, res) => {
      this.ctrl("agents").getUnified(req, res);
    });

    apiRouter.get("/dashboard/bundle", (req, res) => {
      this.ctrl("agents").getDashboardBundle(req, res);
    });

    apiRouter.get("/dashboard/events/stream", (req, res) => {
      this.ctrl("agents").streamDashboardEvents(req, res);
    });

    // Mount API router
    this.app.use("/api", apiRouter);

    // 404 handler for unknown routes
    this.app.use("*", (req, res) => {
      // If it's an /api request that didn't match anything, 404
      if (req.path.startsWith("/api")) {
        res.status(404).json({
          success: false,
          error: "API Endpoint not found",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // For other top-level routes, we'll let the load balancer/proxy handle them
      // but if we're here, we should still return a JSON 404 for consistency
      res.status(404).json({
        success: false,
        error: "Resource not found",
        timestamp: new Date().toISOString(),
      });
    });

    // Error handler - Use structured error handling
    this.app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        // Log the error
        this.logger.error(`API Error: ${error.message}`, error);

        // Handle Zod validation errors specifically
        if (error.name === "ZodError") {
          return res.status(422).json({
            success: false,
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: error,
            timestamp: new Date().toISOString(),
          });
        }

        // Generic error response
        const httpError = error as HttpError;
        const statusCode = httpError.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          error: error.message || "Internal server error",
          code: httpError.code || "INTERNAL_ERROR",
          timestamp: new Date().toISOString(),
        });
      },
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
