import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { getWorkspaceTier } from "./workspaceMiddleware.js";
import { DemoDataService } from "../services/DemoDataService.js";

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

    if (!workspaceId || getWorkspaceTier(workspaceId) !== "demo") {
      next();
      return;
    }

    req.userId = payload.sub as string;
    req.walletAddress = payload.walletAddress as string;
    req.workspaceId = workspaceId;

    const demoResponse = serveDemoData(req.method, req.path);
    if (demoResponse) {
      res.json(demoResponse);
      return;
    }

    next();
  } catch {
    next();
  }
}

function serveDemoData(method: string, path: string): object | null {
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
    return {
      success: true,
      data: {
        logs: DemoDataService.getAuditLogs(),
        summary: {
          totalActions: 5,
          compliantActions: 4,
          complianceRate: 80,
          avgResponseTime: 39,
          criticalIssues: 0,
        },
      },
    };
  }

  if (path === "/audit/insights" || path === "/audit/insights/") {
    return {
      success: true,
      data: { compliance: 80, trends: [] },
    };
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
