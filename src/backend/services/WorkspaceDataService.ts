import { getDb } from "../db/index.js";
import { randomUUID } from "node:crypto";
import type { Agent, Policy, AuditLog, Run } from "@cognivern/shared";

export const WorkspaceDataService = {
  // --- Agents ---
  getAgents(workspaceId: string): Agent[] {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM workspace_agents WHERE workspace_id = ? ORDER BY created_at DESC")
      .all(workspaceId) as any[];
    return rows.map(rowToAgent);
  },

  getAgent(workspaceId: string, agentId: string): Agent | undefined {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM workspace_agents WHERE id = ? AND workspace_id = ?")
      .get(agentId, workspaceId) as any | undefined;
    return row ? rowToAgent(row) : undefined;
  },

  createAgent(workspaceId: string, params: {
    name: string;
    role: string;
    chain: string;
    walletAddress?: string;
    budget?: string;
  }): Agent {
    const db = getDb();
    const id = `agent-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO workspace_agents (id, workspace_id, name, role, status, chain, wallet_address, budget, trades, spend_history, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, '[]', ?, ?)`
    ).run(id, workspaceId, params.name, params.role, params.chain, params.walletAddress || null, params.budget || "$0", now, now);

    return {
      id,
      name: params.name,
      role: params.role,
      status: "active",
      chain: params.chain,
      budget: params.budget || "$0",
      trades: 0,
      spendHistory: [],
    };
  },

  updateAgentStatus(workspaceId: string, agentId: string, status: "active" | "paused" | "inactive"): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE workspace_agents SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .run(status, new Date().toISOString(), agentId, workspaceId);
    return result.changes > 0;
  },

  // --- Policies ---
  getPolicies(workspaceId: string): Policy[] {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM workspace_policies WHERE workspace_id = ? ORDER BY created_at DESC")
      .all(workspaceId) as any[];
    return rows.map(rowToPolicy);
  },

  createPolicy(workspaceId: string, params: {
    name: string;
    type: string;
    description: string;
    rules?: Array<{ condition: string; action: string; params?: Record<string, unknown> }>;
  }): Policy {
    const db = getDb();
    const id = `pol-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const rules = params.rules || [];

    db.prepare(
      `INSERT INTO workspace_policies (id, workspace_id, name, type, description, status, rules, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(id, workspaceId, params.name, params.type, params.description, JSON.stringify(rules), now, now);

    return {
      id,
      name: params.name,
      type: params.type,
      description: params.description,
      status: "active",
      agents: 0,
      violations: 0,
      rules: rules.map((r, i) => ({ id: `r${i}`, condition: r.condition, action: r.action as any, params: r.params })),
    };
  },

  // --- Audit Logs (derived from agents) ---
  getAuditLogs(workspaceId: string): AuditLog[] {
    const db = getDb();
    const agents = db
      .prepare("SELECT id, name, chain, spend_history FROM workspace_agents WHERE workspace_id = ?")
      .all(workspaceId) as any[];

    const logs: AuditLog[] = [];
    for (const agent of agents) {
      const history = JSON.parse(agent.spend_history || "[]");
      for (const entry of history) {
        logs.push({
          id: `log-${agent.id}-${entry.timestamp}`,
          agentId: agent.id,
          action: "spend",
          description: `${agent.name}: ${entry.amount} ${entry.currency}`,
          decision: entry.decision || "approved",
          chain: agent.chain,
          timestamp: entry.timestamp,
          latency: "35ms",
        });
      }
    }
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  // --- Runs (placeholder for live) ---
  getRuns(_workspaceId: string): Run[] {
    return [];
  },

  getRun(_workspaceId: string, _runId: string): Run | undefined {
    return undefined;
  },
};

function rowToAgent(row: any): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
    chain: row.chain,
    budget: row.budget || "$0",
    trades: row.trades || 0,
    spendHistory: JSON.parse(row.spend_history || "[]"),
  };
}

function rowToPolicy(row: any): Policy {
  const rules = JSON.parse(row.rules || "[]");
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    status: row.status,
    agents: 0,
    violations: 0,
    rules: rules.map((r: any, i: number) => ({ id: r.id || `r${i}`, condition: r.condition, action: r.action, params: r.params })),
  };
}
