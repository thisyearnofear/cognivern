/**
 * API Module - Clean Separation of API Concerns
 *
 * This module handles all HTTP API functionality with:
 * - Clean architecture
 * - Dependency injection
 * - Modular routing
 * - Centralized middleware
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BaseService } from '@backend/shared/services/BaseService.js';
import { Logger } from '@backend/shared/logging/Logger.js';
import { apiConfig, ServiceConfig, DependencyHealth } from '@backend/shared/index.js';
import { HealthController } from './controllers/HealthController.js';
import { AgentsController } from './controllers/AgentsController.js';
import { GovernanceController } from './controllers/GovernanceController.js';
import { MetricsController } from './controllers/MetricsController.js';
import { AuditLogController } from './controllers/AuditLogController.js';
import { AuditLogService } from '@backend/services/governance/AuditLogService.js';
import { CreController } from './controllers/CreController.js';
import { CopilotController } from './controllers/CopilotController.js';
import { IngestController } from './controllers/IngestController.js';
import { SpendController } from './controllers/SpendController.js';
import { OwsController } from './controllers/OwsController.js';
import { OwsWalletController } from './controllers/OwsWalletController.js';
import { OwsApiKeyController } from './controllers/OwsApiKeyController.js';
import { OwsPermissionsController } from './controllers/OwsPermissionsController.js';
import { CleanverseController } from './controllers/CleanverseController.js';
import { FhenixController } from './controllers/FhenixController.js';
import { IntentController } from './controllers/IntentController.js';
import { McpGovernanceController } from './controllers/McpGovernanceController.js';
import { PayrollController } from './controllers/PayrollController.js';
import { SealedBidController } from './controllers/SealedBidController.js';
import { SpeechController } from './controllers/SpeechController.js';
import { TelegraphController } from './controllers/TelegraphController.js';
import { WebhookController } from './controllers/WebhookController.js';
import { AuthController } from './controllers/AuthController.js';
import { WorkspaceController } from './controllers/WorkspaceController.js';
import { EventsController } from './controllers/EventsController.js';
import { ObservabilityController } from './controllers/ObservabilityController.js';
import { MandateController } from './controllers/MandateController.js';
import { OutcomeObservationController } from './controllers/OutcomeObservationController.js';
import { CreditProgramController } from './controllers/CreditProgramController.js';
import { InferenceGatewayController } from './controllers/InferenceGatewayController.js';
import { hydraDbMandateContext } from '@backend/services/hydradb/HydraDbMandateContextService.js';
import { sharedLedgerCommitmentService } from '@backend/services/credits/LedgerCommitmentService.js';
import { ApiKeyController, resolveApiKeyRecord } from './controllers/ApiKeyController.js';
import { isKeyManagementPath, requiredScopeForRoute } from './keyScopes.js';
import { authMiddleware } from '@backend/middleware/authMiddleware.js';
import { workspaceMiddleware } from '@backend/middleware/workspaceMiddleware.js';
import { demoInterceptor } from '@backend/middleware/demoInterceptor.js';
import { requestContextMiddleware } from '@backend/middleware/requestContext.js';
import { isPublicApiPath } from '@backend/middleware/publicEndpoints.js';
import { sharedSloMetrics } from '@backend/services/SloMetricsService.js';
import { asyncHandler } from '@backend/shared/errors/ApiErrors.js';
import type { Server } from 'node:http';

/** Typed controller registry */
interface ControllerRegistry {
  health: HealthController;
  agents: AgentsController;
  governance: GovernanceController;
  metrics: MetricsController;
  auditLog: AuditLogController;
  cre: CreController;
  copilot: CopilotController;
  ingest: IngestController;
  spend: SpendController;
  ows: OwsController;
  owsWallet: OwsWalletController;
  owsApiKey: OwsApiKeyController;
  owsPermissions: OwsPermissionsController;
  cleanverse: CleanverseController;
  fhenix: FhenixController;
  intent: IntentController;
  mcpGovernance: McpGovernanceController;
  payroll: PayrollController;
  sealedBid: SealedBidController;
  speech: SpeechController;
  telegraph: TelegraphController;
  webhook: WebhookController;
  auth: AuthController;
  workspace: WorkspaceController;
  apiKey: ApiKeyController;
  events: EventsController;
  observability: ObservabilityController;
  mandate: MandateController;
  outcomeObservation: OutcomeObservationController;
  creditProgram: CreditProgramController;
  inferenceGateway: InferenceGatewayController;
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
  private ctrl<K extends keyof ControllerRegistry>(key: K): NonNullable<ControllerRegistry[K]> {
    const controller = this.controllers[key];
    if (!controller) {
      throw new Error(`Controller '${String(key)}' is not enabled`);
    }
    return controller as NonNullable<ControllerRegistry[K]>;
  }

  constructor() {
    const env = process.env.NODE_ENV;
    const environment: ServiceConfig['environment'] =
      env === 'production' || env === 'test' ? env : 'development';

    const config: ServiceConfig = {
      name: 'api',
      version: '1.0.0',
      environment,
      port: apiConfig.port,
      logLevel: 'info',
    };

    super(config);
    this.app = express();
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('🔧 ApiModule.onInitialize() starting');
    await this.setupMiddleware();
    this.logger.info('🔧 Middleware setup complete');
    await this.setupControllers();
    this.logger.info('🔧 Controllers setup complete');
    await this.setupRoutes();
    this.logger.info('🔧 Routes setup complete');
    await this.startServer();
    this.logger.info('🔧 Server started - ApiModule.onInitialize() complete');
  }

  protected async onShutdown(): Promise<void> {
    hydraDbMandateContext.stopBackgroundSyncWorker();
    sharedLedgerCommitmentService().stop();
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info('HTTP server closed');
          resolve();
        });
      });
    }
  }

  protected async checkDependencies(): Promise<Record<string, DependencyHealth>> {
    // Check if server is listening
    const serverHealth: DependencyHealth = {
      status: this.server?.listening ? 'healthy' : 'unhealthy',
    };

    return {
      server: serverHealth,
    };
  }

  private async setupMiddleware(): Promise<void> {
    this.logger.info('Setting up middleware...');

    // Request-scoped context (requestId + AsyncLocalStorage store) — MUST run
    // first so every downstream logger / middleware can read the requestId.
    this.app.use(requestContextMiddleware);

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
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      }),
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: apiConfig.corsOrigin === '*' ? true : apiConfig.corsOrigin.split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'X-API-KEY',
          'Authorization',
          'Idempotency-Key',
          'X-Idempotency-Key',
          'X-Workspace-Mode',
        ],
      }),
    );

    // Compression
    this.app.use(compression());

    // Request timeout — protects against hung connections. SSE/streaming
    // endpoints (text/event-stream) and long-running governance/FHE
    // evaluations are exempted by checking the Accept header and path.
    // Mandate evidence retrieval (/context, /context/sync) runs HydraDB
    // thinking-mode queries that legitimately take tens of seconds, so it
    // gets the same long timeout as streams instead of the 30s default.
    this.app.use((req, res, next) => {
      const isStream =
        req.headers.accept?.includes('text/event-stream') ||
        req.path.includes('/stream') ||
        req.path.includes('/events');
      const isSlowRetrieval = req.path.includes('/context');
      const timeoutMs = isStream || isSlowRetrieval
        ? Number(process.env.STREAM_TIMEOUT_MS || 120000)
        : Number(process.env.REQUEST_TIMEOUT_MS || 30000);
      const timer = setTimeout(() => {
        if (!req.abortSignal?.aborted) {
          req.abortController?.abort(new Error('Request timed out'));
        }
        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            error: 'Request timed out',
          });
        }
        req.destroy();
      }, timeoutMs);
      const clear = () => clearTimeout(timer);
      res.on('finish', clear);
      res.on('close', clear);
      req.on('close', clear);
      next();
    });

    // Body parsing. Capture the raw buffer for the news webhook so HMAC
    // verification can run over the exact bytes the provider signed.
    this.app.use(express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        const url = req.url || '';
        if (url.includes('/webhooks/chain-gpt-news')) {
          (req as express.Request).rawBody = Buffer.from(buf);
        }
      },
    }));
    this.app.use(express.urlencoded({ extended: true }));

    // Data plane: tighter limits to reduce abuse risk
    this.app.use('/ingest', express.json({ limit: process.env.INGEST_BODY_LIMIT || '512kb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: apiConfig.rateLimit.windowMs,
      max: apiConfig.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false }, // We've already set trust proxy to 1 (first proxy only)
    });
    this.app.use('/api/', limiter);

    // Public health/SLO routes are mounted at the root (outside /api), so
    // protect the metrics endpoint with its own low-cost rate limit.
    const healthSloLimiter = rateLimit({
      windowMs: 60_000,
      max: Number(process.env.HEALTH_SLO_RATE_LIMIT_PER_MINUTE || 60),
      message: {
        error: 'Too many health/SLO requests, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use('/health/slo', healthSloLimiter);

    // Data plane rate limit (separate from control plane)
    const ingestLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE || 120),
      message: {
        error: 'Too many ingest requests, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use('/ingest/', ingestLimiter);

    // Strict rate limit for AI/intent endpoints (expensive operations)
    const intentLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.INTENT_RATE_LIMIT_PER_MINUTE || 30),
      message: {
        error: 'Too many intent requests, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use('/api/intent', intentLimiter);

    // Strict rate limit for decrypt endpoint (expensive CoFHE operation)
    const decryptLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.DECRYPT_RATE_LIMIT_PER_MINUTE || 10),
      keyGenerator: (req: any) => {
        const permit = req.body?.permit;
        if (permit) {
          try {
            const parsed = typeof permit === 'string' ? JSON.parse(permit) : permit;
            if (parsed.recipient) return parsed.recipient.toLowerCase();
          } catch {}
        }
        return req.ip || 'unknown';
      },
      message: {
        error: 'Too many decrypt requests, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use('/api/fhenix/decrypt', decryptLimiter);

    // Strict rate limit for governance/spend endpoints
    const governanceLimiter = rateLimit({
      windowMs: 60_000, // 1 min
      max: Number(process.env.GOVERNANCE_RATE_LIMIT_PER_MINUTE || 60),
      message: {
        error: 'Too many governance requests, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
    });
    this.app.use('/api/governance', governanceLimiter);
    this.app.use('/api/spend', governanceLimiter);

    // Request logging + SLO recorder
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.logRequest(req, res, duration);

        // Record SLO sample. Route key uses the matched route template
        // (e.g. "/api/governance/evaluate") to avoid cardinality explosion
        // from parameterized paths like "/api/copilot/runs/:runId".
        try {
          const routeKey = `${req.method} ${req.route?.path ?? (res.statusCode === 404 ? 'unmatched' : req.path)}`;
          sharedSloMetrics.record(routeKey, res.statusCode, duration);
        } catch {
          // SLO recorder is best-effort — never break a request.
        }
      });

      next();
    });

    // API key middleware for protected routes
    this.app.use('/api/', this.apiKeyMiddleware.bind(this));
  }

  private apiKeyMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    // Skip API key check for public endpoints (per-resource auth is the
    // controller's responsibility, e.g. x-ows-scoped-access for /api/spend).
    if (isPublicApiPath(req.path)) {
      // But if the caller DID send an x-api-key (e.g. demo scripts and
      // the workspace dashboard hitting /api/governance/policies), still
      // validate it and set req.workspaceId so downstream controllers
      // that read workspaceId keep working.
      const headerApiKey = req.headers['x-api-key'] as string | undefined;
      if (headerApiKey) {
        const record = resolveApiKeyRecord(headerApiKey);
        if (record) {
          req.workspaceId = record.workspaceId;
          req.apiKeyRecord = { keyId: record.keyId, scopes: record.scopes };
        } else if (headerApiKey.startsWith('cvn_')) {
          // Our minted format but unknown/revoked → surface a real failure.
          res.status(401).json({
            success: false,
            error: 'Invalid or revoked API key',
            timestamp: new Date().toISOString(),
          });
          return;
        }
        // Unknown non-cvn_ material on a public path is ignored — the path
        // is public either way, and BYO imports may use foreign prefixes.
      }
      return next();
    }

    // Skip if already authenticated via JWT (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return next();
    }

    // SSE endpoints can't set Authorization headers, so the dashboard passes
    // the JWT via ?token=<jwt>. authMiddleware (which runs after this) has
    // the matching extraction logic. We just need to step out of its way
    // here instead of rejecting on "no header".
    if (req.path.endsWith('/events/stream') && typeof req.query.token === 'string') {
      return next();
    }

    const headerApiKey = req.headers['x-api-key'] as string;
    const queryApiKey =
      req.path.endsWith('/events/stream') && // pragma: allowlist secret
      typeof req.query.apiKey === 'string' // pragma: allowlist secret
        ? req.query.apiKey // pragma: allowlist secret
        : undefined;
    const apiKey = headerApiKey || queryApiKey;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Provide a Bearer token or x-api-key header.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Only workspace-scoped keys are accepted (cvn_ minted here, or imported
    // BYO material); the global legacy key path was retired.
    const record = resolveApiKeyRecord(apiKey);
    if (!record) {
      res.status(401).json({
        success: false,
        error: 'Invalid or revoked API key',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // An API key must never manage API keys — no privilege self-escalation
    // through a leaked credential. Key management needs a dashboard session.
    if (isKeyManagementPath(req.path)) {
      res.status(403).json({
        success: false,
        error: 'API keys cannot manage API keys. Use a dashboard session.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Scopes are enforced, finally: they were stored at creation but never
    // consulted, making every key implicitly full-access.
    const required = requiredScopeForRoute(req.method, req.path);
    if (required && !record.scopes.includes(required)) {
      res.status(403).json({
        success: false,
        error: `Insufficient scope: this key requires "${required}"`,
        required,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.workspaceId = record.workspaceId;
    req.apiKeyRecord = { keyId: record.keyId, scopes: record.scopes };
    return next();
  }

  private async setupControllers(): Promise<void> {
    this.logger.info('Setting up controllers...');

    const { AgentsModule } = await import('@backend/modules/agents/AgentsModule.js');
    const agentsEnabled = (process.env.AGENTS_ENABLED || 'false').toLowerCase() === 'true';

    const agentsModule = new AgentsModule();
    if (agentsEnabled) {
      await agentsModule.initialize();
    } else {
      this.logger.warn(
        'AgentsModule disabled (set AGENTS_ENABLED=true to enable background agent loops)',
      );
    }

    // Initialize shared services for controllers (CONSOLIDATION & DRY)
    const { sharedPolicyService } = await import('../../services/governance/PolicyService.js');
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
    this.controllers.auditLog = new AuditLogController();
    this.controllers.cre = new CreController();
    this.controllers.copilot = new CopilotController();
    this.controllers.ingest = new IngestController();
    this.controllers.spend = new SpendController();
    this.controllers.ows = new OwsController();
    this.controllers.owsWallet = new OwsWalletController();
    this.controllers.owsApiKey = new OwsApiKeyController();
    this.controllers.owsPermissions = new OwsPermissionsController();
    this.controllers.cleanverse = new CleanverseController();
    this.controllers.fhenix = new FhenixController();
    this.controllers.intent = new IntentController();
    this.controllers.mcpGovernance = new McpGovernanceController(policyService);
    this.controllers.payroll = new PayrollController();
    this.controllers.sealedBid = new SealedBidController();
    this.controllers.speech = new SpeechController();
    this.controllers.telegraph = new TelegraphController();
    this.controllers.webhook = new WebhookController();
    this.controllers.auth = new AuthController();
    this.controllers.workspace = new WorkspaceController();
    this.controllers.apiKey = new ApiKeyController();
    this.controllers.events = new EventsController();
    this.controllers.observability = new ObservabilityController();
    this.controllers.mandate = new MandateController();
    this.controllers.outcomeObservation = new OutcomeObservationController();
    this.controllers.creditProgram = new CreditProgramController();
    this.controllers.inferenceGateway = new InferenceGatewayController();

    // Initialize all controllers that have an initialize method
    for (const [name, controller] of Object.entries(this.controllers)) {
      const ctrl = controller as { initialize?(): Promise<void> };
      if (ctrl.initialize && name !== 'agents') {
        await ctrl.initialize();
        this.logger.debug(`${name} controller initialized`);
      }
    }

    // HydraDB is an optional derived layer. Start its durable recovery worker
    // only when enabled; it never participates in API request critical paths.
    hydraDbMandateContext.startBackgroundSyncWorker();

    // Periodically anchor credit-ledger commitments for active programs so
    // balances stay externally verifiable. Best-effort; failures only log.
    sharedLedgerCommitmentService().start(
      Number(process.env.CREDIT_COMMITMENT_INTERVAL_MS || 3600000),
    );
  }

  private async setupRoutes(): Promise<void> {
    this.logger.info('Setting up routes...');

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
      createWebhookRoutes,
      createEventsRoutes,
      createObservabilityRoutes,
      createMandateRoutes,
      createOutcomeObservationRoutes,
      createCreditProgramRoutes,
      createInferenceGatewayRoutes,
    } = await import('./routes/index.js');

    // Health check (no API key required)
    const healthRoutes = createHealthRoutes(this.ctrl('health'));
    this.app.use(healthRoutes);

    // Auth routes (public - no API key, no auth)
    const authRoutes = createAuthRoutes(this.ctrl('auth'));
    this.app.use(authRoutes);

    // Workspace routes (protected by JWT auth middleware in routes)
    const workspaceRoutes = createWorkspaceRoutes(this.ctrl('workspace'));
    this.app.use(workspaceRoutes);

    // API key management routes (protected by JWT auth middleware in routes)
    const apiKeyRoutes = createApiKeyRoutes(this.ctrl('apiKey'));
    this.app.use(apiKeyRoutes);

    // Metered inference gateway (/v1/*). Mounted on the app root, NOT the /api
    // router, so participants authenticate with their cvk_ gateway key instead
    // of the workspace JWT/x-api-key stack — that is what lets an unmodified
    // OpenAI SDK point at this base URL. Credit enforcement, metering, and
    // audit recording all happen inside the controller.
    this.app.use(createInferenceGatewayRoutes(this.ctrl('inferenceGateway')));

    // Data plane ingestion (NO API key middleware)
    this.app.post('/ingest/runs', (req, res) => {
      this.ctrl('ingest').ingestRun(req, res);
    });

    // Public commitment verification (NO API key middleware). Pure
    // cryptographic check of a receipt against an anchored root — discloses
    // nothing, touches no database. The trust lives in the 0G/Filecoin
    // anchors, not in this server.
    this.app.post('/verify/credit-commitment', (req, res) => {
      this.ctrl('creditProgram').verifyCommitment(req, res);
    });

    // The GET sibling: aggregate metadata for one commitment, powering the
    // shareable public verification page. Same disclosure discipline — no
    // per-participant content ever leaves through this route.
    this.app.get('/verify/credit-commitment/:id', (req, res) => {
      this.ctrl('creditProgram').getPublicCommitment(req, res);
    });

    // API routes (require API key)
    const apiRouter = express.Router();

    // JWT authentication — validates Bearer tokens, sets req.userId/workspaceId
    // Skips public paths (webhooks, health) and requests already authed via API key
    apiRouter.use(authMiddleware);

    // Workspace context — resolves workspace tier and validates membership
    apiRouter.use(workspaceMiddleware);

    // Demo workspace interceptor — serves demo data for demo-tier workspaces
    apiRouter.use(demoInterceptor);

    // Mount feature-based route modules
    apiRouter.use(createHealthRoutes(this.ctrl('health')));
    apiRouter.use(createAgentRoutes(this.ctrl('agents')));
    apiRouter.use(createGovernanceRoutes(this.ctrl('governance'), this.ctrl('mcpGovernance')));
    apiRouter.use(createMetricsRoutes(this.ctrl('metrics')));
    apiRouter.use(createAuditRoutes(this.ctrl('auditLog')));
    apiRouter.use(createCreRoutes(this.ctrl('cre'), this.ctrl('ingest')));
    apiRouter.use(createCopilotRoutes(this.ctrl('copilot')));
    apiRouter.use(
      createSpendRoutes(
        this.ctrl('spend'),
        this.ctrl('ows'),
        this.ctrl('owsWallet'),
        this.ctrl('owsApiKey'),
        this.ctrl('owsPermissions'),
        this.ctrl('cleanverse'),
      ),
    );
    apiRouter.use(
      createMiscRoutes(
        this.ctrl('ingest'),
        this.ctrl('fhenix'),
        this.ctrl('intent'),
        this.ctrl('payroll'),
        this.ctrl('sealedBid'),
        this.ctrl('speech'),
        this.ctrl('telegraph'),
      ),
    );
    apiRouter.use(createWebhookRoutes(this.ctrl('webhook')));
    apiRouter.use(createEventsRoutes(this.ctrl('events')));
    apiRouter.use(createObservabilityRoutes(this.ctrl('observability')));
    apiRouter.use(createMandateRoutes(this.ctrl('mandate')));
    apiRouter.use(createOutcomeObservationRoutes(this.ctrl('outcomeObservation')));
    apiRouter.use(createCreditProgramRoutes(this.ctrl('creditProgram')));

    // Serve the OpenAPI spec at /api/docs/openapi.json so external agents
    // and the integrate page can self-discover the governance API shape.
    // The spec is copied into dist/ during the backend build (see
    // build-backend-artifact.sh) so it's available in production without
    // the agent/ source directory.
    apiRouter.get('/docs/openapi.json', (_req, res) => {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // dist/src/backend/modules/api/ → dist/openapi.json (4 levels up)
        const specPath = join(__dirname, '../../../../openapi.json');
        const spec = readFileSync(specPath, 'utf-8');
        res.type('application/json').send(spec);
      } catch {
        res.status(404).json({
          success: false,
          error: 'OpenAPI spec not found',
        });
      }
    });

    // Mount API router
    this.app.use('/api', apiRouter);

    // Wrap route handlers so async rejections reach the error middleware
    // instead of crashing the process via unhandledRejection.
    this.wrapAsyncHandlers(this.app);

    // 404 handler
    this.app.use('*', (req, res) => {
      const message = req.path.startsWith('/api') ? 'API Endpoint not found' : 'Resource not found';
      res.status(404).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });
    });

    // Error handler
    this.app.use(
      (error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        this.logger.error(`API Error: ${error.message}`, error);

        if (res.headersSent || res.destroyed) {
          // The response is already on its way — a request-timeout 504, an
          // earlier error, or a client disconnect. Writing again would throw
          // ERR_HTTP_HEADERS_SENT inside this handler and crash the process;
          // just release the connection and move on.
          req.destroy();
          return;
        }

        if (error.name === 'ZodError') {
          return res.status(422).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error,
            timestamp: new Date().toISOString(),
          });
        }

        const httpError = error as HttpError;
        const statusCode = httpError.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          error: error.message || 'Internal server error',
          code: httpError.code || 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        });
      },
    );
  }

  /** Recursively wrap Express route handlers with asyncHandler. */
  private wrapAsyncHandlers(app: express.Application | express.Router): void {
    const stack = (
      app as unknown as {
        stack?: Array<{
          route?: express.IRoute;
          name?: string;
          handle?: express.Router;
        }>;
      }
    ).stack;
    if (!stack) return;

    for (const layer of stack) {
      if (layer.route) {
        for (const routeLayer of layer.route.stack) {
          const fn = routeLayer.handle;
          if (typeof fn === 'function' && fn.length <= 3) {
            routeLayer.handle = asyncHandler(
              fn as (
                req: express.Request,
                res: express.Response,
                next: express.NextFunction,
              ) => Promise<void>,
            );
          }
        }
      } else if (layer.name === 'router' && layer.handle) {
        this.wrapAsyncHandlers(layer.handle);
      }
    }
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`API server listening on port ${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.logger.error('Server error:', error);
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
