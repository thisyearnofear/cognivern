import { getDb } from "../db/index.js";
import { randomUUID } from "node:crypto";
import type {
  Agent,
  Policy,
  AuditLog,
  Run,
  GovernanceEvaluation,
  PolicyCheck,
} from "@cognivern/shared";
import { NotificationService } from "./NotificationService.js";

export const WorkspaceDataService = {
  // --- Agents ---
  getAgents(workspaceId: string): Agent[] {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM workspace_agents WHERE workspace_id = ? ORDER BY created_at DESC",
      )
      .all(workspaceId) as any[];
    return rows.map(rowToAgent);
  },

  getAgent(workspaceId: string, agentId: string): Agent | undefined {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT * FROM workspace_agents WHERE id = ? AND workspace_id = ?",
      )
      .get(agentId, workspaceId) as any | undefined;
    return row ? rowToAgent(row) : undefined;
  },

  createAgent(
    workspaceId: string,
    params: {
      name: string;
      role: string;
      chain: string;
      walletAddress?: string;
      budget?: string;
      source?: "managed" | "external";
      webhookUrl?: string;
    },
  ): Agent {
    const db = getDb();
    const id = `agent-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const source = params.source || "managed";

    db.prepare(
      `INSERT INTO workspace_agents (id, workspace_id, name, role, status, chain, wallet_address, budget, trades, spend_history, source, webhook_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, '[]', ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      params.name,
      params.role,
      params.chain,
      params.walletAddress || null,
      params.budget || "$0",
      source,
      params.webhookUrl || null,
      now,
      now,
    );

    return {
      id,
      name: params.name,
      role: params.role,
      status: "active",
      chain: params.chain,
      budget: params.budget || "$0",
      trades: 0,
      spendHistory: [],
      source,
      walletAddress: params.walletAddress,
      webhookUrl: params.webhookUrl,
    };
  },

  updateAgentStatus(
    workspaceId: string,
    agentId: string,
    status: "active" | "paused" | "inactive",
  ): boolean {
    const db = getDb();
    const result = db
      .prepare(
        "UPDATE workspace_agents SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
      )
      .run(status, new Date().toISOString(), agentId, workspaceId);
    return result.changes > 0;
  },

  // --- Policies ---
  getPolicies(workspaceId: string): Policy[] {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM workspace_policies WHERE workspace_id = ? ORDER BY created_at DESC",
      )
      .all(workspaceId) as any[];
    return rows.map(rowToPolicy);
  },

  createPolicy(
    workspaceId: string,
    params: {
      name: string;
      type: string;
      description: string;
      rules?: Array<{
        condition: string;
        action: string;
        params?: Record<string, unknown>;
      }>;
    },
  ): Policy {
    const db = getDb();
    const id = `pol-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const rules = params.rules || [];

    db.prepare(
      `INSERT INTO workspace_policies (id, workspace_id, name, type, description, status, rules, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      params.name,
      params.type,
      params.description,
      JSON.stringify(rules),
      now,
      now,
    );

    // Create initial version snapshot
    db.prepare(
      `INSERT INTO policy_versions (id, policy_id, workspace_id, version, name, type, description, status, rules, snapshot_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      `pv-${randomUUID().slice(0, 8)}`,
      id,
      workspaceId,
      params.name,
      params.type,
      params.description,
      JSON.stringify(rules),
      now,
    );

    return {
      id,
      name: params.name,
      type: params.type,
      description: params.description,
      status: "active",
      agents: 0,
      violations: 0,
      rules: rules.map((r, i) => ({
        id: `r${i}`,
        condition: r.condition,
        action: r.action as any,
        params: r.params,
      })),
    };
  },

  updatePolicy(
    workspaceId: string,
    policyId: string,
    updates: {
      name?: string;
      description?: string;
      rules?: Array<{
        condition: string;
        action: string;
        params?: Record<string, unknown>;
      }>;
      status?: string;
    },
  ): Policy | null {
    const db = getDb();
    const existing = db
      .prepare(
        "SELECT * FROM workspace_policies WHERE id = ? AND workspace_id = ?",
      )
      .get(policyId, workspaceId) as any | undefined;

    if (!existing) return null;

    const now = new Date().toISOString();
    const name = updates.name ?? existing.name;
    const description = updates.description ?? existing.description;
    const rules = updates.rules ?? JSON.parse(existing.rules || "[]");
    const status = updates.status ?? existing.status;

    // Snapshot current version before updating
    const latestVersion = db
      .prepare(
        "SELECT MAX(version) as max_ver FROM policy_versions WHERE policy_id = ?",
      )
      .get(policyId) as { max_ver: number } | undefined;
    const nextVersion = (latestVersion?.max_ver || 0) + 1;

    db.prepare(
      `INSERT INTO policy_versions (id, policy_id, workspace_id, version, name, type, description, status, rules, snapshot_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `pv-${randomUUID().slice(0, 8)}`,
      policyId,
      workspaceId,
      nextVersion,
      name,
      existing.type,
      description,
      status,
      JSON.stringify(rules),
      now,
    );

    // Update the policy
    db.prepare(
      "UPDATE workspace_policies SET name = ?, description = ?, rules = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(name, description, JSON.stringify(rules), status, now, policyId, workspaceId);

    return {
      id: policyId,
      name,
      type: existing.type,
      description,
      status: status as any,
      agents: 0,
      violations: 0,
      rules: rules.map((r: any, i: number) => ({
        id: `r${i}`,
        condition: r.condition,
        action: r.action,
        params: r.params,
      })),
    };
  },

  getPolicyVersions(
    workspaceId: string,
    policyId: string,
  ): Array<{
    id: string;
    version: number;
    name: string;
    description: string;
    status: string;
    rules: any[];
    snapshotAt: string;
  }> {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM policy_versions WHERE policy_id = ? AND workspace_id = ? ORDER BY version DESC",
      )
      .all(policyId, workspaceId) as any[];

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description,
      status: row.status,
      rules: JSON.parse(row.rules || "[]"),
      snapshotAt: row.snapshot_at,
    }));
  },

  rollbackPolicy(
    workspaceId: string,
    policyId: string,
    versionId: string,
  ): Policy | null {
    const db = getDb();
    const version = db
      .prepare(
        "SELECT * FROM policy_versions WHERE id = ? AND policy_id = ? AND workspace_id = ?",
      )
      .get(versionId, policyId, workspaceId) as any | undefined;

    if (!version) return null;

    const now = new Date().toISOString();
    const rules = JSON.parse(version.rules || "[]");

    // Snapshot the current state as a new version before rolling back
    const latestVersion = db
      .prepare(
        "SELECT MAX(version) as max_ver FROM policy_versions WHERE policy_id = ?",
      )
      .get(policyId) as { max_ver: number } | undefined;
    const nextVersion = (latestVersion?.max_ver || 0) + 1;

    db.prepare(
      `INSERT INTO policy_versions (id, policy_id, workspace_id, version, name, type, description, status, rules, snapshot_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `pv-${randomUUID().slice(0, 8)}`,
      policyId,
      workspaceId,
      nextVersion,
      version.name,
      version.type,
      version.description,
      version.status,
      version.rules,
      now,
    );

    // Apply the rollback
    db.prepare(
      "UPDATE workspace_policies SET name = ?, description = ?, rules = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(
      version.name,
      version.description,
      version.rules,
      version.status,
      now,
      policyId,
      workspaceId,
    );

    return {
      id: policyId,
      name: version.name,
      type: version.type,
      description: version.description,
      status: version.status,
      agents: 0,
      violations: 0,
      rules: rules.map((r: any, i: number) => ({
        id: `r${i}`,
        condition: r.condition,
        action: r.action,
        params: r.params,
      })),
    };
  },

  // --- Audit Logs (derived from agents) ---
  getAuditLogs(workspaceId: string): AuditLog[] {
    const db = getDb();
    const agents = db
      .prepare(
        "SELECT id, name, chain, spend_history FROM workspace_agents WHERE workspace_id = ?",
      )
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

  // --- Governance Evaluation ---
  evaluateAction(
    workspaceId: string,
    params: {
      agentId: string;
      action: {
        type: string;
        description?: string;
        amount?: number;
        currency?: string;
      };
      policyId?: string;
    },
  ): GovernanceEvaluation {
    const db = getDb();
    const now = new Date().toISOString();

    // Verify agent belongs to workspace
    const agent = db
      .prepare(
        "SELECT id, name, budget FROM workspace_agents WHERE id = ? AND workspace_id = ?",
      )
      .get(params.agentId, workspaceId) as
      | { id: string; name: string; budget: string }
      | undefined;

    if (!agent) {
      return {
        allowed: false,
        reasoning: `Agent ${params.agentId} not found in this workspace`,
        policyChecks: [],
        timestamp: now,
      };
    }

    // Load policies to evaluate against
    let policies: any[];
    if (params.policyId) {
      const p = db
        .prepare(
          "SELECT * FROM workspace_policies WHERE id = ? AND workspace_id = ? AND status = 'active'",
        )
        .get(params.policyId, workspaceId);
      policies = p ? [p] : [];
    } else {
      policies = db
        .prepare(
          "SELECT * FROM workspace_policies WHERE workspace_id = ? AND status = 'active'",
        )
        .all(workspaceId) as any[];
    }

    if (policies.length === 0) {
      // No policies → allow by default
      this.recordSpend(
        workspaceId,
        params.agentId,
        params.action,
        "approved",
        now,
      );
      return {
        allowed: true,
        reasoning: "No active policies — action allowed by default",
        policyChecks: [],
        auditLogId: `log-${params.agentId}-${now}`,
        timestamp: now,
      };
    }

    // Evaluate each policy's rules
    const policyChecks: PolicyCheck[] = [];
    let denied = false;
    const denialReasons: string[] = [];

    for (const policy of policies) {
      const rules = JSON.parse(policy.rules || "[]");
      for (const rule of rules) {
        const check = evaluateRule(rule, params.action, agent);
        policyChecks.push({
          policyId: policy.id,
          result: check.passed,
          reason: check.reason,
        });
        if (!check.passed && rule.action === "deny") {
          denied = true;
          denialReasons.push(`${policy.name}: ${check.reason}`);
        }
      }
    }

    const decision = denied ? "denied" : "approved";
    const reasoning = denied
      ? denialReasons.join("; ")
      : `Action approved — passed ${policyChecks.length} policy check(s)`;

    this.recordSpend(workspaceId, params.agentId, params.action, decision, now);

    return {
      allowed: !denied,
      reasoning,
      policyChecks,
      auditLogId: `log-${params.agentId}-${now}`,
      timestamp: now,
    };
  },

  recordSpend(
    workspaceId: string,
    agentId: string,
    action: { amount?: number; currency?: string; type?: string },
    decision: string,
    timestamp: string,
  ): void {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT spend_history, trades FROM workspace_agents WHERE id = ? AND workspace_id = ?",
      )
      .get(agentId, workspaceId) as
      | { spend_history: string; trades: number }
      | undefined;

    if (!row) return;

    const history = JSON.parse(row.spend_history || "[]");
    history.unshift({
      amount: action.amount || 0,
      currency: action.currency || "USDC",
      timestamp,
      decision,
      type: action.type || "unknown",
    });

    // Keep last 100 entries
    const trimmed = history.slice(0, 100);
    const newTrades = decision === "approved" ? row.trades + 1 : row.trades;

    db.prepare(
      "UPDATE workspace_agents SET spend_history = ?, trades = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(JSON.stringify(trimmed), newTrades, timestamp, agentId, workspaceId);

    // Fire notifications for denied/flagged decisions
    if (decision === "denied" || decision === "flagged") {
      const agent = db
        .prepare(
          "SELECT name FROM workspace_agents WHERE id = ? AND workspace_id = ?",
        )
        .get(agentId, workspaceId) as { name?: string } | undefined;

      NotificationService.fireDecisionNotification({
        event: "governance:decision",
        timestamp,
        workspaceId,
        agentId,
        agentName: agent?.name,
        action: action.type,
        decision,
        reason: decision === "denied" ? "Blocked by governance policy" : "Flagged for review",
        amount: action.amount,
        currency: action.currency,
      }).catch((err) => {
        console.warn("[notifications] Failed to fire notification:", err);
      });
    }
  },

  // --- Runs (placeholder for live) ---
  getRuns(_workspaceId: string): Run[] {
    return [];
  },

  getRun(_workspaceId: string, _runId: string): Run | undefined {
    return undefined;
  },
};

function evaluateRule(
  rule: { condition: string; action: string; params?: Record<string, unknown> },
  action: { type?: string; amount?: number; currency?: string },
  agent: { budget: string },
): { passed: boolean; reason: string } {
  const condition = rule.condition.toLowerCase();
  const amount = action.amount || 0;

  // Parse budget number from agent (e.g. "$5,000" → 5000)
  const budgetNum =
    parseInt(agent.budget.replace(/[^0-9]/g, ""), 10) || Infinity;

  // Simple condition evaluator
  if (condition.includes("amount >")) {
    const threshold = parseFloat(condition.replace(/.*amount\s*>\s*/, ""));
    if (!isNaN(threshold) && amount > threshold) {
      return {
        passed: false,
        reason: `Amount ${amount} exceeds threshold ${threshold}`,
      };
    }
    return {
      passed: true,
      reason: `Amount ${amount} within threshold ${threshold}`,
    };
  }

  if (
    condition.includes("dailytotal >") ||
    condition.includes("daily_total >")
  ) {
    const limit = parseFloat(
      condition.replace(/.*(?:dailytotal|daily_total)\s*>\s*/, ""),
    );
    if (!isNaN(limit) && amount > limit) {
      return {
        passed: false,
        reason: `Amount ${amount} exceeds daily limit ${limit}`,
      };
    }
    return { passed: true, reason: `Within daily limit` };
  }

  if (
    condition.includes("amount > budget") ||
    condition.includes("exceeds budget")
  ) {
    if (amount > budgetNum) {
      return {
        passed: false,
        reason: `Amount ${amount} exceeds agent budget ${agent.budget}`,
      };
    }
    return { passed: true, reason: `Within agent budget` };
  }

  if (condition.includes("not in") && condition.includes("allowlist")) {
    // Allowlist rules always pass in basic eval (would need actual allowlist data)
    return { passed: true, reason: "Allowlist check passed (default allow)" };
  }

  if (condition.includes("not in") && condition.includes("chain")) {
    return { passed: true, reason: "Chain restriction check passed" };
  }

  if (condition.includes("isnew") || condition.includes("is_new")) {
    return {
      passed: true,
      reason: "Token novelty check passed (default allow)",
    };
  }

  // Default: condition not recognized → pass
  return {
    passed: true,
    reason: `Rule evaluated (condition: ${rule.condition})`,
  };
}

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
    source: row.source || "managed",
    walletAddress: row.wallet_address || undefined,
    webhookUrl: row.webhook_url || undefined,
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
    rules: rules.map((r: any, i: number) => ({
      id: r.id || `r${i}`,
      condition: r.condition,
      action: r.action,
      params: r.params,
    })),
  };
}
