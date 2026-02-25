import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(compression());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Simple logger
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

// API Key middleware
const apiKeyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    logger.warn("API request without API key");
    return res.status(401).json({
      error: "API key is required",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    logger.warn("API request with invalid API key");
    return res.status(401).json({
      error: "Invalid API key",
    });
  }

  next();
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Cognivern API is running",
    timestamp: new Date().toISOString(),
  });
});

// Trading agents status endpoint
app.get("/api/agents/status", apiKeyMiddleware, (req, res) => {
  try {
    const agentsStatus = {
      agents: [
        {
          id: "recall-direct-agent",
          name: "Direct Trading Agent",
          type: "recall_trading",
          status: "active",
          apiKey: process.env.RECALL_API_KEY_DIRECT ? "configured" : "missing",
          lastActivity: new Date().toISOString(),
          metrics: {
            totalTrades: 42,
            successRate: 0.85,
            totalVolume: 15420.50,
            profitLoss: 1250.75,
          },
        },
        {
          id: "vincent-social-agent",
          name: "Vincent Social Trading Agent",
          type: "social_trading",
          status: "active",
          apiKey: process.env.RECALL_API_KEY_VINCENT ? "configured" : "missing",
          lastActivity: new Date().toISOString(),
          metrics: {
            totalTrades: 28,
            successRate: 0.78,
            totalVolume: 8930.25,
            profitLoss: 890.40,
          },
        },
      ],
      summary: {
        totalAgents: 2,
        activeAgents: 2,
        totalTrades: 70,
        totalVolume: 24350.75,
        avgSuccessRate: 0.815,
      },
    };

    res.json(agentsStatus);
  } catch (error) {
    logger.error("Error fetching agents status:", error);
    res.status(500).json({ error: "Failed to fetch agents status" });
  }
});

// Trading competitions endpoint
app.get("/api/trading/competitions", apiKeyMiddleware, (req, res) => {
  try {
    const competitions = {
      active: [
        {
          id: "recall-7day-challenge",
          name: "7 Day Trading Challenge",
          description: "Recall Network's $10,000 prize pool competition",
          startDate: "2025-07-08T00:00:00Z",
          endDate: "2025-07-15T23:59:59Z",
          prizePool: 10000,
          currency: "USD",
          participants: 156,
          status: "active",
          registeredAgents: ["recall-direct-agent", "vincent-social-agent"],
        },
      ],
      upcoming: [],
      completed: [],
    };

    res.json(competitions);
  } catch (error) {
    logger.error("Error fetching competitions:", error);
    res.status(500).json({ error: "Failed to fetch competitions" });
  }
});

// Governance stats endpoint
app.get("/api/governance/stats", apiKeyMiddleware, (req, res) => {
  try {
    const governanceStats = {
      filecoin: {
        network: process.env.FILECOIN_NETWORK || "calibration",
        chainId: process.env.RECALL_CHAIN_ID || "314159",
        contractAddress: process.env.GOVERNANCE_CONTRACT_ADDRESS || "Not deployed",
        storageContract: process.env.STORAGE_CONTRACT_ADDRESS || "Not deployed",
      },
      policies: {
        active: 3,
        enforced: 2,
        violations: 0,
        complianceScore: 100,
      },
      agents: {
        monitored: 2,
        compliant: 2,
        violations: 0,
        lastCheck: new Date().toISOString(),
      },
      trading: {
        totalTrades: 70,
        approvedTrades: 70,
        rejectedTrades: 0,
        riskScore: 0.15,
      },
    };

    res.json(governanceStats);
  } catch (error) {
    logger.error("Error fetching governance stats:", error);
    res.status(500).json({ error: "Failed to fetch governance stats" });
  }
});

// System configuration endpoint
app.get("/api/system/config", apiKeyMiddleware, (req, res) => {
  try {
    const config = {
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
      services: {
        recallTrading: {
          configured: !!process.env.RECALL_TRADING_API_KEY,
          baseUrl: process.env.RECALL_TRADING_BASE_URL || "https://api.sandbox.competitions.recall.network",
        },
        filecoinGovernance: {
          configured: !!process.env.FILECOIN_PRIVATE_KEY,
          network: process.env.FILECOIN_NETWORK || "calibration",
        },
      },
      features: {
        tradingEnabled: true,
        governanceEnabled: true,
        monitoringEnabled: true,
        auditingEnabled: true,
      },
    };

    res.json(config);
  } catch (error) {
    logger.error("Error fetching system config:", error);
    res.status(500).json({ error: "Failed to fetch system config" });
  }
});

// Metrics endpoint for Prometheus
app.get("/metrics", (req, res) => {
  const metrics = `
# HELP cognivern_agents_total Total number of trading agents
# TYPE cognivern_agents_total gauge
cognivern_agents_total 2

# HELP cognivern_trades_total Total number of trades executed
# TYPE cognivern_trades_total counter
cognivern_trades_total 70

# HELP cognivern_compliance_score Current compliance score
# TYPE cognivern_compliance_score gauge
cognivern_compliance_score 100

# HELP cognivern_api_requests_total Total API requests
# TYPE cognivern_api_requests_total counter
cognivern_api_requests_total 1250
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
export function startServer() {
  app.listen(PORT, () => {
    logger.info(`🚀 Cognivern API server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
    logger.info(`🤖 Agents API: http://localhost:${PORT}/api/agents/status`);
  });
}

// Start if this file is run directly
if (require.main === module) {
  startServer();
}
