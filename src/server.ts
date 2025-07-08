import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { dependencyContainer } from "./infrastructure/config/dependencyInjection.js";
import { configureRoutes } from "./presentation/rest/routes/index.js";
import { apiKeyMiddleware } from "./middleware/apiKeyMiddleware.js";
import { MetricsService } from "./services/MetricsService.js";
import { AuditLogService } from "./services/AuditLogService.js";
import { RecallCompetitionService } from "./services/RecallCompetitionService.js";
import { CogniverseService } from "./services/CogniverseService.js";
import { TradingCompetitionGovernanceService } from "./services/TradingCompetitionGovernanceService.js";
import { RecallService } from "./services/RecallService.js";
import { UnifiedDataService } from "./services/UnifiedDataService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "./utils/logger.js";
import walletRoutes from "./routes/walletRoutes.js";
import { config } from "./config.js";

// Initialize Express app
const app: express.Express = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-KEY", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// Initialize services
let metricsService: MetricsService;
let auditLogService: AuditLogService;
let recallCompetitionService: RecallCompetitionService;
let cogniverseService: CogniverseService;
let tradingCompetitionService: TradingCompetitionGovernanceService;

try {
  // Initialize Recall client
  const recallClient = new RecallClient();

  const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address;

  // Initialize services
  metricsService = new MetricsService(recallClient, bucketAddress);
  auditLogService = new AuditLogService(recallClient, bucketAddress);
  recallCompetitionService = new RecallCompetitionService();

  const recallService = new RecallService(recallClient, bucketAddress);
  cogniverseService = new CogniverseService(recallService);

  tradingCompetitionService = new TradingCompetitionGovernanceService(
    recallClient,
    bucketAddress
  );

  logger.info("All services initialized successfully");
} catch (error) {
  logger.error("Failed to initialize services:", error);
  // Continue with limited functionality
}

// Get all controllers from the dependency container
const controllers = dependencyContainer.getAllControllers();

// Configure API routes
const apiRouter = configureRoutes(controllers);

// Mount API routes at /api
app.use("/api", apiRouter);

// Mount wallet routes
app.use("/api/wallet", walletRoutes);

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Metrics endpoints
app.get("/api/metrics/:period", apiKeyMiddleware, async (req, res) => {
  try {
    const { period } = req.params;
    const validPeriods = ["hourly", "daily", "weekly", "monthly"];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: "Invalid period. Must be one of: hourly, daily, weekly, monthly",
      });
    }

    if (!metricsService) {
      return res.status(503).json({ error: "Metrics service not available" });
    }

    const metrics = await metricsService.getMetrics(period as any);
    res.json(metrics);
  } catch (error) {
    logger.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// Audit logs endpoints
app.get("/api/audit-logs", apiKeyMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, agentId, actionType, complianceStatus } =
      req.query;

    if (!auditLogService) {
      return res.status(503).json({ error: "Audit log service not available" });
    }

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required" });
    }

    const logs = await auditLogService.searchLogs({
      startDate: startDate as string,
      endDate: endDate as string,
      agentId: agentId as string,
      actionType: actionType as string,
      complianceStatus: complianceStatus as string,
    });

    res.json(logs);
  } catch (error) {
    logger.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// Dashboard summary endpoint
app.get("/api/dashboard/summary", apiKeyMiddleware, async (req, res) => {
  try {
    if (!cogniverseService) {
      return res
        .status(503)
        .json({ error: "Cogniverse service not available" });
    }

    const summary = await cogniverseService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    logger.error("Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// Unified blockchain data endpoint
app.get("/api/dashboard/unified", apiKeyMiddleware, async (req, res) => {
  try {
    const unifiedDataService = UnifiedDataService.getInstance();
    const unifiedStats = await unifiedDataService.getUnifiedStats();
    res.json(unifiedStats);
  } catch (error) {
    logger.error("Error fetching unified dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch unified dashboard data" });
  }
});

// Agents endpoints
app.get("/api/agents/unified", apiKeyMiddleware, async (req, res) => {
  try {
    const { limit = "10" } = req.query;
    const limitNum = parseInt(limit as string, 10);

    if (!cogniverseService) {
      return res
        .status(503)
        .json({ error: "Cogniverse service not available" });
    }

    const agents = await cogniverseService.getTopUnifiedAgents(limitNum);
    res.json(agents);
  } catch (error) {
    logger.error("Error fetching unified agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// Recall competition endpoints
app.get("/api/recall/competitions/live", apiKeyMiddleware, async (req, res) => {
  try {
    if (!recallCompetitionService) {
      return res
        .status(503)
        .json({ error: "Recall competition service not available" });
    }

    const competitions = await recallCompetitionService.getLiveCompetitions();
    res.json(competitions);
  } catch (error) {
    logger.error("Error fetching live competitions:", error);
    res.status(500).json({ error: "Failed to fetch live competitions" });
  }
});

app.get(
  "/api/recall/competitions/completed",
  apiKeyMiddleware,
  async (req, res) => {
    try {
      const { limit = "20" } = req.query;
      const limitNum = parseInt(limit as string, 10);

      if (!recallCompetitionService) {
        return res
          .status(503)
          .json({ error: "Recall competition service not available" });
      }

      const competitions =
        await recallCompetitionService.getCompletedCompetitions(limitNum);
      res.json(competitions);
    } catch (error) {
      logger.error("Error fetching completed competitions:", error);
      res.status(500).json({ error: "Failed to fetch completed competitions" });
    }
  }
);

// Live feed endpoint
app.get("/api/feed/live", apiKeyMiddleware, async (req, res) => {
  try {
    if (!cogniverseService) {
      return res
        .status(503)
        .json({ error: "Cogniverse service not available" });
    }

    const feed = await cogniverseService.getLiveActivityFeed();
    res.json(feed);
  } catch (error) {
    logger.error("Error fetching live feed:", error);
    res.status(500).json({ error: "Failed to fetch live feed" });
  }
});

// Trading Competition Governance endpoints
app.post(
  "/api/trading/competitions/:id/start",
  apiKeyMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const config = req.body;

      if (!tradingCompetitionService) {
        return res
          .status(503)
          .json({ error: "Trading competition service not available" });
      }

      await tradingCompetitionService.startGovernedCompetition(id, config);
      res.json({ success: true, competitionId: id });
    } catch (error) {
      logger.error("Error starting governed competition:", error);
      res.status(500).json({ error: "Failed to start competition" });
    }
  }
);

app.post(
  "/api/trading/competitions/:id/agents",
  apiKeyMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { agentId, config } = req.body;

      if (!tradingCompetitionService) {
        return res
          .status(503)
          .json({ error: "Trading competition service not available" });
      }

      const agent = await tradingCompetitionService.registerAgent(
        id,
        agentId,
        config
      );
      res.json(agent);
    } catch (error) {
      logger.error("Error registering agent:", error);
      res.status(500).json({ error: "Failed to register agent" });
    }
  }
);

app.get(
  "/api/trading/competitions/:id/status",
  apiKeyMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!tradingCompetitionService) {
        return res
          .status(503)
          .json({ error: "Trading competition service not available" });
      }

      const status = tradingCompetitionService.getCompetitionStatus(id);
      res.json(status);
    } catch (error) {
      logger.error("Error fetching competition status:", error);
      res.status(500).json({ error: "Failed to fetch competition status" });
    }
  }
);

app.post(
  "/api/trading/competitions/:id/round",
  apiKeyMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { marketData } = req.body;

      if (!tradingCompetitionService) {
        return res
          .status(503)
          .json({ error: "Trading competition service not available" });
      }

      const result = await tradingCompetitionService.executeTradingRound(
        id,
        marketData
      );
      res.json(result);
    } catch (error) {
      logger.error("Error executing trading round:", error);
      res.status(500).json({ error: "Failed to execute trading round" });
    }
  }
);

// Filecoin governance endpoints (integrated into existing service)
app.get("/api/filecoin/governance/stats", async (req, res) => {
  try {
    // Get real stats from governance services
    let realStats = {
      totalActions: 0,
      totalViolations: 0,
      totalAgents: 0,
      approvalRate: 0,
    };

    // Try to get real data from trading competition service
    if (tradingCompetitionService) {
      try {
        // Get all competition data to calculate real stats
        const allCompetitions = Object.keys(
          tradingCompetitionService.activeCompetitions || {}
        );
        let totalActions = 0;
        let totalViolations = 0;
        let totalAgents = 0;
        let totalApprovals = 0;

        allCompetitions.forEach((compId) => {
          const status = tradingCompetitionService.getCompetitionStatus(compId);
          totalAgents += status.agents.length;
          totalActions += status.events.length;
          totalViolations += status.events.filter(
            (e) => e.type === "policy_violation"
          ).length;
          totalApprovals += status.events.filter((e) => e.resolved).length;
        });

        realStats = {
          totalActions,
          totalViolations,
          totalAgents,
          approvalRate:
            totalActions > 0
              ? Math.round((totalApprovals / totalActions) * 100)
              : 0,
        };
      } catch (err) {
        logger.warn("Could not fetch real governance stats, using defaults");
      }
    }

    const stats = {
      ...realStats,
      filecoinIntegration: true,
      contractAddress:
        process.env.GOVERNANCE_CONTRACT_ADDRESS || "Not deployed",
      isRealData: realStats.totalActions > 0,
      status: realStats.totalActions > 0 ? "live" : "waiting_for_agents",
    };

    res.json(stats);
  } catch (error) {
    logger.error("Error fetching Filecoin governance stats:", error);
    res.status(500).json({ error: "Failed to fetch governance stats" });
  }
});

// Real trading status endpoint (leverages existing services)
app.get("/api/trading/status", async (req, res) => {
  try {
    const status = {
      recallTradingAPI: {
        configured: !!process.env.RECALL_TRADING_API_KEY,
        baseUrl:
          process.env.RECALL_TRADING_BASE_URL ||
          "https://api.sandbox.competitions.recall.network",
      },
      filecoinGovernance: {
        configured: !!process.env.FILECOIN_PRIVATE_KEY,
        contractAddress:
          process.env.GOVERNANCE_CONTRACT_ADDRESS || "Not deployed",
      },
      existingServices: {
        tradingCompetition: !!tradingCompetitionService,
        metrics: !!metricsService,
        auditLog: !!auditLogService,
      },
    };

    res.json(status);
  } catch (error) {
    logger.error("Error fetching trading status:", error);
    res.status(500).json({ error: "Failed to fetch trading status" });
  }
});

// Blockchain stats endpoint (for frontend compatibility)
app.get("/api/blockchain/stats", async (req, res) => {
  try {
    // Get real governance stats instead of hardcoded values
    let realGovernanceStats = {
      policies: 0,
      agents: 0,
      actions: 0,
      violations: 0,
      approvalRate: 0,
    };

    // Try to fetch real data from available services
    if (cogniverseService) {
      try {
        // Get unified agents (combines Recall + governance data)
        const unifiedAgents = await cogniverseService.getTopUnifiedAgents(100);

        // Calculate real metrics from unified agent data
        let totalActions = 0;
        let totalViolations = 0;
        let totalApprovals = 0;
        let governanceAgents = 0;

        for (const agent of unifiedAgents) {
          if (agent.governanceProfile?.isDeployed) {
            governanceAgents++;
            const actions = agent.governanceProfile.totalGovernanceActions || 0;
            totalActions += actions;

            // Calculate violations based on compliance score
            const complianceRate =
              agent.governanceProfile.policyCompliance || 0;
            const violations = Math.round(
              (actions * (100 - complianceRate)) / 100
            );
            totalViolations += violations;

            // Calculate approvals
            const approvals = actions - violations;
            totalApprovals += approvals;
          }
        }

        // Get dashboard summary for additional stats
        const dashboardSummary = await cogniverseService.getDashboardSummary();

        realGovernanceStats = {
          policies: dashboardSummary.governance?.totalPolicies || 0,
          agents: governanceAgents,
          actions: totalActions,
          violations: totalViolations,
          approvalRate:
            totalActions > 0
              ? Math.round((totalApprovals / totalActions) * 100)
              : 0,
        };

        logger.info(
          "Using real governance stats from CogniverseService:",
          realGovernanceStats
        );
      } catch (err) {
        logger.warn(
          "Could not fetch real governance stats, using defaults:",
          err
        );
        // Keep default values if real data unavailable
        realGovernanceStats = {
          policies: 0,
          agents: 0,
          actions: 0,
          violations: 0,
          approvalRate: 0,
        };
      }
    }

    const stats = {
      filecoin: {
        network: config.FILECOIN_NETWORK,
        chainId: config.RECALL_CHAIN_ID,
        rpcUrl: config.FILECOIN_RPC_URL,
        governanceContract: config.GOVERNANCE_CONTRACT_ADDRESS,
        storageContract: config.STORAGE_CONTRACT_ADDRESS,
        usdcToken: config.USDFC_TOKEN_ADDRESS,
      },
      recall: {
        network: config.RECALL_NETWORK,
        tradingAPI:
          config.RECALL_TRADING_BASE_URL ||
          "https://api.sandbox.competitions.recall.network",
        configured: !!config.RECALL_TRADING_API_KEY,
      },
      governance: {
        address: config.GOVERNANCE_CONTRACT_ADDRESS,
        ...realGovernanceStats,
        isRealData: realGovernanceStats.actions > 0,
        lastUpdated: new Date().toISOString(),
      },
    };

    res.json(stats);
  } catch (error) {
    logger.error("Error fetching blockchain stats:", error);
    res.status(500).json({ error: "Failed to fetch blockchain stats" });
  }
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
);

/**
 * Start the server and listen on configured port
 */
export function startServer() {
  app.listen(PORT, () => {
    logger.info(
      `🚀 Cognivern Governance Platform server running on port ${PORT}`
    );
    logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔧 API endpoints: http://localhost:${PORT}/api/`);
    logger.info(`📈 Metrics: http://localhost:${PORT}/api/metrics/daily`);
    logger.info(`📋 Audit logs: http://localhost:${PORT}/api/audit-logs`);
    logger.info(`🤖 Agents: http://localhost:${PORT}/api/agents/unified`);
  });
}

// Export app for testing purposes
export default app;
