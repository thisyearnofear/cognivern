import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { getWorkspaceTier } from "./workspaceMiddleware.js";
import { DemoDataService } from "../services/DemoDataService.js";
import { WorkspaceDataService } from "../services/WorkspaceDataService.js";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "cognivern-dev-jwt-secret-change-in-production"
);

export async function demoInterceptor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const workspaceId = payload.workspaceId as string;

    if (!workspaceId) {
      next();
      return;
    }

    req.userId = payload.sub as string;
    req.walletAddress = payload.walletAddress as string;
    req.workspaceId = workspaceId;

    const tier = getWorkspaceTier(workspaceId);
    const response = tier === "demo"
      ? serveDemoData(req.method, req.path, req.body)
      : serveLiveData(req.method, req.path, workspaceId, req.body);

    if (response) {
      const status = (response as any)._status || 200;
      delete (response as any)._status;
      res.status(status).json(response);
      return;
    }

    next();
  } catch {
    next();
  }
}

function serveDemoData(method: string, path: string, body?: any): object | null {
  // POST handlers for demo tier
  if (method === "POST") {
    if (path === "/governance/evaluate" || path === "/governance/evaluate/") {
      const { agentId, action } = body || {};
      if (!agentId || !action) {
        return { success: false, error: "agentId and action are required", _status: 400 };
      }
      const agent = DemoDataService.getAgent(agentId);
      const policies = DemoDataService.getPolicies();
      const amount = action.amount || 0;

      // Simulate evaluation against demo policies
      const budgetPolicy = policies.find((p) => p.type === "budget");
      const budgetLimit = 3000;
      const denied = amount > budgetLimit;

      const policyChecks = policies.map((p) => ({
        policyId: p.id,
        result: p.type === "budget" ? !denied : true,
        reason: p.type === "budget"
          ? denied ? `Amount ${amount} exceeds $${budgetLimit} single transaction limit` : "Within daily limit"
          : `${p.name} check passed`,
      }));

      return {
        success: true,
        data: {
          allowed: !denied,
          reasoning: denied
            ? `Denied by ${budgetPolicy?.name || "budget policy"}: amount ${amount} exceeds limit`
            : `Action approved — passed ${policyChecks.length} policy check(s)`,
          policyChecks,
          auditLogId: `log-${agentId}-${new Date().toISOString()}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
    return null;
  }

  if (method !== "GET") return null;

  if (path === "/agents" || path === "/agents/") {
    return { success: true, data: DemoDataService.getAgents() };
  }

  if (path.match(/^\/agents\/agent-[a-z]+-\d+$/)) {
    const id = path.split("/").pop()!;
    const agent = DemoDataService.getAgent(id);
    if (agent) return { success: true, data: agent };
  }

  if (path === "/audit/logs" || path === "/audit/logs/") {
    const logs = DemoDataService.getAuditLogs();
    return {
      success: true,
      data: {
        logs,
        summary: {
          totalActions: logs.length,
          compliantActions: logs.filter((l) => l.decision === "approved").length,
          complianceRate: 80,
          avgResponseTime: 39,
          criticalIssues: 0,
        },
      },
    };
  }

  if (path === "/audit/insights" || path === "/audit/insights/") {
    return { success: true, data: { compliance: 80, trends: [] } };
  }

  if (path === "/governance/policies" || path === "/governance/policies/") {
    return { success: true, data: DemoDataService.getPolicies() };
  }

  if (path === "/cre/runs" || path === "/cre/runs/") {
    return { success: true, data: DemoDataService.getRuns() };
  }

  if (path.match(/^\/cre\/runs\/run-\d+$/)) {
    const id = path.split("/").pop()!;
    const run = DemoDataService.getRun(id);
    if (run) return { success: true, data: run };
  }

  return null;
}

function serveLiveData(method: string, path: string, workspaceId: string, body: any): object | null {
  // GET endpoints
  if (method === "GET") {
    if (path === "/agents" || path === "/agents/") {
      return { success: true, data: WorkspaceDataService.getAgents(workspaceId) };
    }

    if (path.match(/^\/agents\/agent-[a-z0-9-]+$/)) {
      const id = path.split("/").pop()!;
      const agent = WorkspaceDataService.getAgent(workspaceId, id);
      if (agent) return { success: true, data: agent };
      return { success: false, error: "Agent not found", _status: 404 };
    }

    if (path === "/audit/logs" || path === "/audit/logs/") {
      const logs = WorkspaceDataService.getAuditLogs(workspaceId);
      const approved = logs.filter((l) => l.decision === "approved").length;
      return {
        success: true,
        data: {
          logs,
          summary: {
            totalActions: logs.length,
            compliantActions: approved,
            complianceRate: logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0,
            avgResponseTime: 35,
            criticalIssues: 0,
          },
        },
      };
    }

    if (path === "/audit/insights" || path === "/audit/insights/") {
      const logs = WorkspaceDataService.getAuditLogs(workspaceId);
      const approved = logs.filter((l) => l.decision === "approved").length;
      return {
        success: true,
        data: { compliance: logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0, trends: [] },
      };
    }

    if (path === "/governance/policies" || path === "/governance/policies/") {
      return { success: true, data: WorkspaceDataService.getPolicies(workspaceId) };
    }

    if (path === "/cre/runs" || path === "/cre/runs/") {
      return { success: true, data: WorkspaceDataService.getRuns(workspaceId) };
    }

    if (path.match(/^\/cre\/runs\/run-[a-z0-9-]+$/)) {
      const id = path.split("/").pop()!;
      const run = WorkspaceDataService.getRun(workspaceId, id);
      if (run) return { success: true, data: run };
      return { success: false, error: "Run not found", _status: 404 };
    }

    return null;
  }

  // POST endpoints for live workspaces
  if (method === "POST") {
    if (path === "/agents/register" || path === "/agents/register/") {
      const { name, role, chain, walletAddress, budget } = body || {};
      if (!name || !role || !chain) {
        return { success: false, error: "name, role, and chain are required", _status: 400 };
      }
      const agent = WorkspaceDataService.createAgent(workspaceId, { name, role, chain, walletAddress, budget });
      return { success: true, data: agent, _status: 201 };
    }

    if (path === "/governance/policies" || path === "/governance/policies/") {
      const { name, type, description, rules } = body || {};
      if (!name || !type) {
        return { success: false, error: "name and type are required", _status: 400 };
      }
      const policy = WorkspaceDataService.createPolicy(workspaceId, { name, type, description: description || "", rules });
      return { success: true, data: policy, _status: 201 };
    }

    if (path === "/governance/evaluate" || path === "/governance/evaluate/") {
      const { agentId, action, policyId } = body || {};
      if (!agentId || !action) {
        return { success: false, error: "agentId and action are required", _status: 400 };
      }
      const evaluation = WorkspaceDataService.evaluateAction(workspaceId, { agentId, action, policyId });
      return { success: true, data: evaluation };
    }

    return null;
  }

  // PATCH/PUT for agent status
  if (method === "PATCH" || method === "PUT") {
    const agentMatch = path.match(/^\/agents\/(agent-[a-z0-9-]+)\/status$/);
    if (agentMatch) {
      const { status } = body || {};
      if (!status || !["active", "paused", "inactive"].includes(status)) {
        return { success: false, error: "status must be active, paused, or inactive", _status: 400 };
      }
      const updated = WorkspaceDataService.updateAgentStatus(workspaceId, agentMatch[1], status);
      if (!updated) return { success: false, error: "Agent not found", _status: 404 };
      return { success: true, data: { id: agentMatch[1], status } };
    }

    return null;
  }

  return null;
}
