import { Router } from "express";
import type { AgentsController } from "@backend/modules/api/controllers/AgentsController.js";

export function createAgentRoutes(agentsController: AgentsController): Router {
  const router = Router();

  router.get("/agents/stats", (req, res) =>
    agentsController.getAggregateStats(req, res),
  );
  router.get("/agents/compare", (req, res) =>
    agentsController.compareAgents(req, res),
  );
  router.get("/agents/leaderboard", (req, res) =>
    agentsController.getLeaderboard(req, res),
  );
  router.get("/agents", (req, res) => agentsController.getAgents(req, res));
  router.post("/agents/register", (req, res) =>
    agentsController.registerAgent(req, res),
  );
  // The dashboard's "Connect Existing" mode posts a richer shape with a
  // walletAddress. Same controller handles it — the body parser accepts
  // both shapes — but the route alias keeps the frontend / backend API
  // contracts symmetric and stops "POST /agents/connect" 404s.
  router.post("/agents/connect", (req, res) =>
    agentsController.registerAgent(req, res),
  );
  router.get("/agents/connections", (req, res) =>
    agentsController.getConnections(req, res),
  );
  router.get("/agents/monitoring", (req, res) =>
    agentsController.getMonitoring(req, res),
  );
  router.get("/agents/unified", (req, res) =>
    agentsController.getUnified(req, res),
  );

  // Specific agent status/decisions routes for dashboard
  router.get("/agents/governance/status", (req, res) => {
    (req.params as Record<string, string>).agentType = "governance";
    agentsController.getAgentStatus(req, res);
  });
  router.get("/agents/governance/decisions", (req, res) => {
    (req.params as Record<string, string>).agentType = "governance";
    agentsController.getAgentDecisions(req, res);
  });
  router.get("/agents/portfolio/status", (req, res) => {
    (req.params as Record<string, string>).agentType = "portfolio";
    agentsController.getAgentStatus(req, res);
  });
  router.get("/agents/portfolio/decisions", (req, res) => {
    (req.params as Record<string, string>).agentType = "portfolio";
    agentsController.getAgentDecisions(req, res);
  });
  router.get("/agents/sapience/status", (req, res) => {
    (req.params as Record<string, string>).agentType = "sapience";
    agentsController.getAgentStatus(req, res);
  });
  router.get("/agents/sapience/decisions", (req, res) => {
    (req.params as Record<string, string>).agentType = "sapience";
    agentsController.getAgentDecisions(req, res);
  });

  // Parameterized routes come after specific routes
  router.get("/agents/:id", (req, res) => agentsController.getAgent(req, res));
  router.get("/agents/:id/status", (req, res) =>
    agentsController.getAgentStatus(req, res),
  );
  router.get("/agents/:id/decisions", (req, res) =>
    agentsController.getAgentDecisions(req, res),
  );
  router.get("/agents/:id/briefing", (req, res) =>
    agentsController.getAgentBriefing(req, res),
  );
  router.post("/agents/:id/start", (req, res) =>
    agentsController.startAgent(req, res),
  );
  router.post("/agents/:id/stop", (req, res) =>
    agentsController.stopAgent(req, res),
  );

  // Trading routes
  router.get("/agents/:agentType/status", (req, res) =>
    agentsController.getAgentStatus(req, res),
  );
  router.get("/agents/:agentType/decisions", (req, res) =>
    agentsController.getAgentDecisions(req, res),
  );
  router.post("/agents/:agentType/start", (req, res) =>
    agentsController.startAgent(req, res),
  );
  router.post("/agents/:agentType/stop", (req, res) =>
    agentsController.stopAgent(req, res),
  );

  // Market Data Routes
  router.get("/market/data/:symbol", (req, res) =>
    agentsController.getMarketData(req, res),
  );
  router.get("/market/historical/:symbol", (req, res) =>
    agentsController.getHistoricalData(req, res),
  );
  router.get("/market/stats", (req, res) =>
    agentsController.getMarketStats(req, res),
  );
  router.get("/market/top", (req, res) =>
    agentsController.getTopMarkets(req, res),
  );

  // Dashboard routes
  router.get("/dashboard/unified", (req, res) =>
    agentsController.getUnified(req, res),
  );
  router.get("/dashboard/bundle", (req, res) =>
    agentsController.getDashboardBundle(req, res),
  );
  router.get("/dashboard/events/stream", (req, res) =>
    agentsController.streamDashboardEvents(req, res),
  );

  return router;
}
