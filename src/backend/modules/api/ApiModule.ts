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
import { createHash, timingSafeEqual } from "crypto";
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
import { AuditLogController } from "./controllers/AuditLogController.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { CreController } from "./controllers/CreController.js";
import { CopilotController } from "./controllers/CopilotController.js";
import { IngestController } from "./controllers/IngestController.js";
import { SpendController } from "./controllers/SpendController.js";
import { OwsController } from "./controllers/OwsController.js";
import { OwsWalletController } from "./controllers/OwsWalletController.js";
import { OwsApiKeyController } from "./controllers/OwsApiKeyController.js";
import { OwsPermissionsController } from "./controllers/OwsPermissionsController.js";
import { FhenixController } from "./controllers/FhenixController.js";
import { IntentController } from "./controllers/IntentController.js";
import { McpGovernanceController } from "./controllers/McpGovernanceController.js";
import { PayrollController } from "./controllers/PayrollController.js";
import { SealedBidController } from "./controllers/SealedBidController.js";
import { SpeechController } from "./controllers/SpeechController.js";
import { AuthController } from "./controllers/AuthController.js";
import { WorkspaceController } from "./controllers/WorkspaceController.js";
import {
  ApiKeyController,
  resolveWorkspaceFromApiKey,
} from "./controllers/ApiKeyController.js";
import { demoInterceptor } from "../../middleware/demoInterceptor.js";
import type { Server } from "node:http";

/** Typed controller registry */
interface ControllerRegistry {
  health: HealthController;
  agents: AgentsController;
  governance: GovernanceController;
  metrics: MetricsController;
  sapience?: {
    getStatus(req: express.Request, res: express.Response): Promise<void>;
    submitForecast(req: express.Request, res: express.Response): Promise<void>;
    submitAutomatedForecast(
      req: express.Request,
      res: express.Response,
    ): Promise<void>;
    getWallet(req: express.Request, res: express.Response): Promise<void>;
    getDecisions(req: express.Request, res: express.Response): Promise<void>;
  };
  auditLog: AuditLogController;
  cre: CreController;
  copilot: CopilotController;
  ingest: IngestController;
  spend: SpendController;
  ows: OwsController;
  owsWallet: OwsWalletController;
  owsApiKey: OwsApiKeyController;
  owsPermissions: OwsPermissionsController;
  fhenix: FhenixController;
  intent: IntentController;
  mcpGovernance: McpGovernanceController;
  payroll: PayrollController;
  sealedBid: SealedBidController;
  speech: SpeechController;
  auth: AuthController;
  workspace: WorkspaceController;
  apiKey: ApiKeyController;
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
  private ctrl<K extends keyof ControllerRegistry>(
    key: K,
  ): NonNullable<ControllerRegistry[K]> {
    const controller = this.controllers[key];
    if (!controller) {
      throw new Error(`Controller '${String(key)}' is not enabled`);
    }
    return controller as NonNullable<ControllerRegistry[K]>;
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
        this.server!.close(() => {
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

    // Strict rate limit for AI/intent endpoints (expensive operations)
    const intentLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.INTENT_RATE_LIMIT_PER_MINUTE || 30),
      message: {
        error: "Too many intent requests, please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use("/api/intent", intentLimiter);

    // Strict rate limit for decrypt endpoint (expensive CoFHE operation)
    const decryptLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.DECRYPT_RATE_LIMIT_PER_MINUTE || 10),
      keyGenerator: (req: any) => {
        const permit = req.body?.permit;
        if (permit) {
          try {
            const parsed = typeof permit === "string" ? JSON.parse(permit) : permit;
            if (parsed.recipient) return parsed.recipient.toLowerCase();
          } catch {}
        }
        return req.ip || "unknown";
      },
      message: {
        error: "Too many decrypt requests, please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use("/api/fhenix/decrypt", decryptLimiter);

    // Strict rate limit for governance/spend endpoints
    const governanceLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.GOVERNANCE_RATE_LIMIT_PER_MINUTE || 60),
      message: {
        error: "Too many governance requests, please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use("/api/governance", governanceLimiter);
    this.app.use("/api/spend", governanceLimiter);

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
      "/governance/policies",
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
      "/spend/scan",
      "/projects",
      "/fhenix/status",
      "/fhenix/decrypt",
      "/intent",
    ];
    if (publicEndpoints.some((endpoint) => req.path === endpoint)) {
      return next();
    }

    // Skip if already authenticated via JWT (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const headerApiKey = req.headers["x-api-key"] as string;
    const queryApiKey =
      req.path.endsWith("/events/stream") && // pragma: allowlist secret
      typeof req.query.apiKey === "string" // pragma: allowlist secret
        ? req.query.apiKey // pragma: allowlist secret
        : undefined;
    const apiKey = headerApiKey || queryApiKey;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error:
          "Authentication required. Provide a Bearer token or x-api-key header.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check workspace-scoped API keys (cvn_ prefix)
    if (apiKey.startsWith("cvn_")) {
      const workspaceId = resolveWorkspaceFromApiKey(apiKey);
      if (workspaceId) {
        req.workspaceId = workspaceId;
        return next();
      }
      res.status(401).json({
        success: false,
        error: "Invalid or revoked API key",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Legacy global API key check — timing-safe hash comparison
    if (apiConfig.apiKey) {
      const expected = Buffer.from(
        createHash("sha256").update(apiConfig.apiKey).digest(),
      );
      const actual = Buffer.from(createHash("sha256").update(apiKey).digest());
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      ) {
        res.status(401).json({
          success: false,
          error: "Invalid API key",
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } else {
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

    const sapienceEnabled =
      (process.env.SAPIENCE_ENABLED || "false").toLowerCase() === "true";

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
    this.controllers.governance = new GovernanceController(
      policyService,
      undefined,
    );
    this.controllers.metrics = new MetricsController();
    if (sapienceEnabled) {
      const { SapienceController } = await import(
        "./controllers/SapienceController.js"
      );
      this.controllers.sapience = new SapienceController();
    } else {
      this.logger.info(
        "SapienceController disabled (set SAPIENCE_ENABLED=true to enable)",
      );
    }
    this.controllers.auditLog = new AuditLogController();
    this.controllers.cre = new CreController();
    this.controllers.copilot = new CopilotController();
    this.controllers.ingest = new IngestController();
    this.controllers.spend = new SpendController();
    this.controllers.ows = new OwsController();
    this.controllers.owsWallet = new OwsWalletController();
    this.controllers.owsApiKey = new OwsApiKeyController();
    this.controllers.owsPermissions = new OwsPermissionsController();
    this.controllers.fhenix = new FhenixController();
    this.controllers.intent = new IntentController();
    this.controllers.mcpGovernance = new McpGovernanceController(policyService);
    this.controllers.payroll = new PayrollController();
    this.controllers.sealedBid = new SealedBidController();
    this.controllers.speech = new SpeechController();
    this.controllers.auth = new AuthController();
    this.controllers.workspace = new WorkspaceController();
    this.controllers.apiKey = new ApiKeyController();

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

    // Import route modules
    const {
      createHealthRoutes,
      createAgentRoutes,
      createGovernanceRoutes,
      createMetricsRoutes,
      createAuditRoutes,
      createCreRoutes,
      createCopilotRoutes,
      createSpendRoutes,
      createMiscRoutes,
      createAuthRoutes,
      createWorkspaceRoutes,
      createApiKeyRoutes,
    } = await import("./routes/index.js");

    // Health check (no API key required)
    const healthRoutes = createHealthRoutes(this.ctrl("health"));
    this.app.use(healthRoutes);

    // Auth routes (public - no API key, no auth)
    const authRoutes = createAuthRoutes(this.ctrl("auth"));
    this.app.use(authRoutes);

    // Workspace routes (protected by JWT auth middleware in routes)
    const workspaceRoutes = createWorkspaceRoutes(this.ctrl("workspace"));
    this.app.use(workspaceRoutes);

    // API key management routes (protected by JWT auth middleware in routes)
    const apiKeyRoutes = createApiKeyRoutes(this.ctrl("apiKey"));
    this.app.use(apiKeyRoutes);

    // Data plane ingestion (NO API key middleware)
    this.app.post("/ingest/runs", (req, res) => {
      this.ctrl("ingest").ingestRun(req, res);
    });

    // API routes (require API key)
    const apiRouter = express.Router();

    // Demo workspace interceptor — serves demo data for demo-tier workspaces
    apiRouter.use(demoInterceptor);

    // Mount feature-based route modules
    apiRouter.use(createHealthRoutes(this.ctrl("health")));
    apiRouter.use(createAgentRoutes(this.ctrl("agents")));
    apiRouter.use(
      createGovernanceRoutes(
        this.ctrl("governance"),
        this.ctrl("mcpGovernance"),
      ),
    );
    apiRouter.use(createMetricsRoutes(this.ctrl("metrics")));
    apiRouter.use(createAuditRoutes(this.ctrl("auditLog")));
    apiRouter.use(createCreRoutes(this.ctrl("cre")));
    apiRouter.use(createCopilotRoutes(this.ctrl("copilot")));
    apiRouter.use(
      createSpendRoutes(
        this.ctrl("spend"),
        this.ctrl("ows"),
        this.ctrl("owsWallet"),
        this.ctrl("owsApiKey"),
        this.ctrl("owsPermissions"),
      ),
    );
    apiRouter.use(
      createMiscRoutes(
        this.ctrl("ingest"),
        this.ctrl("fhenix"),
        this.ctrl("intent"),
        this.ctrl("payroll"),
        this.ctrl("sealedBid"),
        this.ctrl("speech"),
      ),
    );

    // Sapience routes (conditional)
    if (this.controllers.sapience) {
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
      apiRouter.get("/sapience/decisions", (req, res) => {
        this.ctrl("sapience").getDecisions(req, res);
      });
    }

    // Mount API router
    this.app.use("/api", apiRouter);

    // 404 handler
    this.app.use("*", (req, res) => {
      const message = req.path.startsWith("/api")
        ? "API Endpoint not found"
        : "Resource not found";
      res.status(404).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });
    });

    // Error handler
    this.app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        this.logger.error(`API Error: ${error.message}`, error);

        if (error.name === "ZodError") {
          return res.status(422).json({
            success: false,
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: error,
            timestamp: new Date().toISOString(),
          });
        }

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
