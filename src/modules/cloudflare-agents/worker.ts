/**
 * Cloudflare Worker Entry Point
 *
 * Routes requests to appropriate Cloudflare Agents
 * and handles HTTP API compatibility layer
 */

import { GovernanceAgent } from "./GovernanceAgent";
import type { Ai, KVNamespace, D1Database, DurableObjectNamespace, ExecutionContext, ScheduledEvent } from "@cloudflare/workers-types";

export type Env = {
  // Cloudflare bindings
  AI?: Ai;
  KV?: KVNamespace;
  D1?: D1Database;

  // Environment variables
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;

  // Agent bindings
  GOVERNANCE_AGENT: DurableObjectNamespace;
};

export default {
  /**
   * Handle incoming HTTP requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: env.D1 ? "production" : "development",
      });
    }

    // Agent API endpoints
    if (url.pathname.startsWith("/api/agents")) {
      return handleAgentsAPI(request, env);
    }

    // Governance evaluation endpoint
    if (url.pathname.startsWith("/api/governance/evaluate")) {
      return handleGovernanceEvaluate(request, env);
    }

    // Legacy route handling - now handled by our own API
    // 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },

  /**
   * Handle scheduled tasks (cron triggers)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("Scheduled task triggered:", event.cron);

    // Trigger periodic governance audits
    if (event.cron === "0 * * * *") { // Every hour
      await triggerHourlyAudit(env);
    }
  },
};

/**
 * Handle /api/agents routes
 */
async function handleAgentsAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  try {
    // GET /api/agents - List all agents
    if (request.method === "GET" && url.pathname === "/api/agents") {
      const agents = await listAgents(env);
      return Response.json({ success: true, data: agents });
    }

    // GET /api/agents/:id - Get agent details
    if (request.method === "GET" && pathParts.length === 3 && pathParts[0] === "api" && pathParts[1] === "agents") {
      const agentId = pathParts[2];
      const agent = await getAgentDetails(agentId, env);
      return Response.json({ success: true, data: agent });
    }

    // GET /api/agents/:id/thoughts - Get agent thought history
    if (request.method === "GET" && pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "agents" && pathParts[3] === "thoughts") {
      const agentId = pathParts[2];
      const thoughts = await getAgentThoughts(agentId, env, url.searchParams.get("limit"));
      return Response.json({ success: true, data: thoughts });
    }

    // GET /api/agents/:id/metrics - Get agent metrics
    if (request.method === "GET" && pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "agents" && pathParts[3] === "metrics") {
      const agentId = pathParts[2];
      const metrics = await getAgentMetrics(agentId, env);
      return Response.json({ success: true, data: metrics });
    }

    // GET /api/agents/:id/actions - Get action log
    if (request.method === "GET" && pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "agents" && pathParts[3] === "actions") {
      const agentId = pathParts[2];
      const actions = await getAgentActions(agentId, env, url.searchParams);
      return Response.json({ success: true, data: actions });
    }

    // POST /api/agents - Create/register new agent
    if (request.method === "POST" && url.pathname === "/api/agents") {
      const body = await request.json();
      const agent = await createAgent(body, env);
      return Response.json({ success: true, data: agent }, { status: 201 });
    }

    return new Response("Not found", { status: 404 });
  } catch (error) {
    console.error("Agents API error:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle governance evaluation requests
 */
async function handleGovernanceEvaluate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { agentId, action } = body;

    if (!agentId || !action) {
      return Response.json(
        { success: false, error: "Missing agentId or action" },
        { status: 400 }
      );
    }

    // Get or create governance agent instance
    const governanceAgent = await getGovernanceAgent(agentId, env);

    // Evaluate the action
    const decision = await governanceAgent.evaluateAction(action);

    return Response.json({
      success: true,
      data: decision,
    });
  } catch (error) {
    console.error("Governance evaluation error:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Get or create a governance agent instance
 */
async function getGovernanceAgent(agentId: string, env: Env) {
  // Get agent stub
  const id = env.GOVERNANCE_AGENT.idFromName(agentId);
  const stub = env.GOVERNANCE_AGENT.get(id);

  // Return agent proxy
  return stub as unknown as GovernanceAgent;
}

/**
 * List all registered agents
 */
async function listAgents(env: Env) {
  // Query D1 database for agent list
  if (env.D1) {
    const result = await env.D1.prepare("SELECT * FROM agents ORDER BY lastActive DESC").all();
    return result.results || [];
  }

  // Fallback: return empty list
  return [];
}

/**
 * Get agent details
 */
async function getAgentDetails(agentId: string, env: Env) {
  if (env.D1) {
    const result = await env.D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first();
    return result;
  }

  return null;
}

/**
 * Create/register a new agent
 */
async function createAgent(agentData: any, env: Env) {
  const agent = {
    id: crypto.randomUUID(),
    ...agentData,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    status: "active",
  };

  // Store in D1
  if (env.D1) {
    await env.D1.prepare(`
      INSERT INTO agents (id, name, type, capabilities, status, createdAt, lastActive)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agent.id,
      agent.name,
      agent.type,
      JSON.stringify(agent.capabilities || []),
      agent.status,
      agent.createdAt,
      agent.lastActive
    ).run();
  }

  return agent;
}

/**
 * Get agent thought history
 */
async function getAgentThoughts(agentId: string, env: Env, limit?: string | null): Promise<string[]> {
  if (env.D1) {
    const limitNum = limit ? parseInt(limit) : 50;
    const result = await env.D1.prepare(
      "SELECT thought FROM thought_history WHERE agentId = ? ORDER BY timestamp DESC LIMIT ?"
    ).bind(agentId, limitNum).all();
    return (result.results || []).map((row: any) => row.thought);
  }
  return [];
}

/**
 * Get agent metrics
 */
async function getAgentMetrics(agentId: string, env: Env) {
  if (env.D1) {
    const result = await env.D1.prepare(
      "SELECT * FROM agent_metrics WHERE agentId = ?"
    ).bind(agentId).first();
    return result;
  }
  return null;
}

/**
 * Get agent actions
 */
async function getAgentActions(agentId: string, env: Env, params: URLSearchParams) {
  if (env.D1) {
    let query = "SELECT * FROM action_logs WHERE agentId = ?";
    const bindings: any[] = [agentId];

    if (params.get("actionType")) {
      query += " AND actionType = ?";
      bindings.push(params.get("actionType"));
    }
    if (params.get("approved")) {
      query += " AND approved = ?";
      bindings.push(params.get("approved") === "true");
    }

    query += " ORDER BY timestamp DESC";

    if (params.get("limit")) {
      query += " LIMIT ?";
      bindings.push(parseInt(params.get("limit")!));
    }

    const result = await env.D1.prepare(query).bind(...bindings).all();
    return result.results || [];
  }
  return [];
}

/**
 * Trigger hourly governance audit
 */
async function triggerHourlyAudit(env: Env) {
  console.log("Triggering hourly governance audit...");

  // Get all active agents
  const agents = await listAgents(env);

  // Run audit for each agent
  for (const agent of agents) {
    try {
      const governanceAgent = await getGovernanceAgent(agent.id, env);
      // Trigger audit (implementation depends on audit logic)
    } catch (error) {
      console.error(`Audit failed for agent ${agent.id}:`, error);
    }
  }
}
