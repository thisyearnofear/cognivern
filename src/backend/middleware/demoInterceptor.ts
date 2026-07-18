import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { getWorkspaceTier } from "./workspaceMiddleware.js";
import { DemoDataService } from "@backend/services/DemoDataService.js";
import { WorkspaceDataService } from "@backend/services/WorkspaceDataService.js";
import { sharedZeroGProofService } from "@backend/services/blockchain/ZeroGProofService.js";

function resolveJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode(
      "cognivern-dev-jwt-secret-change-in-production",
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = resolveJwtSecret();

export async function demoInterceptor(
  req: Request,
  res: Response,
  next: NextFunction,
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

    // Determine mode:
    // 1. If workspace tier is 'demo' in DB, always serve demo data (free tier)
    // 2. If tier is 'live', respect the X-Workspace-Mode header for sandbox testing
    const tier = getWorkspaceTier(workspaceId);
    const headerMode =
      (req.headers["x-workspace-mode"] as string) === "sandbox"
        ? "sandbox"
        : "production";
    const effectiveMode = tier === "demo" ? "sandbox" : headerMode;

    const response =
      effectiveMode === "sandbox"
        ? serveDemoData(req.method, req.path, req.body, req.query)
        : await serveLiveData(req.method, req.path, workspaceId, req.body);

    if (response) {
      const resp = response as Record<string, unknown>;
      const status = (resp._status as number) || 200;
      delete resp._status;
      res.status(status).json(response);
      return;
    }

    next();
  } catch {
    next();
  }
}

function serveDemoData(
  method: string,
  path: string,
  body?: any,
  query?: Record<string, unknown>,
): object | null {
  // POST handlers for demo tier
  if (method === "POST") {
    if (path === "/governance/evaluate" || path === "/governance/evaluate/") {
      const { agentId, action } = body || {};
      if (!agentId || !action) {
        return {
          success: false,
          error: "agentId and action are required",
          _status: 400,
        };
      }
      const agent = DemoDataService.getAgent(agentId);
      const policies = DemoDataService.getPolicies();
      const amount = action.amount || 0;

      // Three-outcome demo evaluation so the Governance Check page can
      // demonstrate Approved / Held / Denied without requiring a real
      // backing policy. Bands match the marketing story:
      //   < $100   → approved (under any threshold)
      //   ≥ $100   → held (needs operator review)
      //   > $3000  → denied (hard limit)
      const HOLD_THRESHOLD = 100;
      const HARD_LIMIT = 3000;
      const decision: "approved" | "denied" | "held" =
        amount > HARD_LIMIT
          ? "denied"
          : amount >= HOLD_THRESHOLD
            ? "held"
            : "approved";

      const budgetPolicy = policies.find((p) => p.type === "budget");
      const approvalPolicy = policies.find(
        (p) => p.type === "approval" || p.type === "review",
      );

      const policyChecks = policies.map((p) => {
        if (p.type === "budget") {
          return {
            policyId: p.id,
            result: decision !== "denied",
            reason:
              decision === "denied"
                ? `Amount $${amount} exceeds $${HARD_LIMIT} hard limit`
                : `Within $${HARD_LIMIT} hard limit`,
          };
        }
        if (p.type === "approval" || p.type === "review") {
          return {
            policyId: p.id,
            result: decision === "approved",
            reason:
              decision === "held"
                ? `Amount $${amount} ≥ $${HOLD_THRESHOLD} requires operator review`
                : decision === "approved"
                  ? `Under $${HOLD_THRESHOLD} auto-approval threshold`
                  : `Skipped — denied by ${budgetPolicy?.name || "budget"}`,
          };
        }
        return {
          policyId: p.id,
          result: decision !== "denied",
          reason: `${p.name} check ${decision === "denied" ? "skipped" : "passed"}`,
        };
      });

      const reasoning =
        decision === "denied"
          ? `Denied by ${budgetPolicy?.name || "budget policy"}: amount $${amount} exceeds $${HARD_LIMIT}`
          : decision === "held"
            ? `Held for review by ${approvalPolicy?.name || "approval policy"}: amount $${amount} above auto-approval threshold ($${HOLD_THRESHOLD})`
            : `Approved — passed ${policyChecks.length} policy check(s)`;

      const timestamp = new Date().toISOString();
      const auditLogId = `log-${agentId}-${timestamp}`;

      // Fire-and-forget: post governance decision proof to 0G Chain.
      // The proof is posted asynchronously — the response doesn't wait for it.
      if (sharedZeroGProofService.isEnabled()) {
        sharedZeroGProofService.recordDecision({
          workspaceId: "demo",
          agentId,
          actionType: action.type || "unknown",
          amount: amount,
          currency: action.currency || "USDC",
          decision,
          timestamp: Math.floor(Date.now() / 1000),
        }).then((proof) => {
          if (proof) {
            console.log(`[0GProof] Demo decision recorded — tx: ${proof.txHash}`);
          }
        }).catch(() => {});
      }

      return {
        success: true,
        data: {
          // Backwards compat: `allowed` stays true only when fully approved.
          // Held is a "needs review" state, not a green light.
          allowed: decision === "approved",
          decision,
          reasoning,
          policyChecks,
          auditLogId,
          timestamp,
        },
      };
    }

    // Sandbox agent registration. Without this branch sandbox users hit the
    // real AgentsController and were rejected because that controller's
    // legacy contract requires { type, name, address } while the dashboard
    // sends { name, role, chain, budget }. We mirror the (now-permissive)
    // controller's mapping here so sandbox users see a successful create
    // with a stable id they can navigate to, and the in-memory live-agent
    // path doesn't get polluted with sandbox identities.
    if (
      path === "/agents/register" ||
      path === "/agents/register/" ||
      path === "/agents/connect" ||
      path === "/agents/connect/"
    ) {
      const { name, role, chain, walletAddress, budget } = body || {};
      const type = role || (body as Record<string, unknown> | undefined)?.type;
      if (!name || !type) {
        return {
          success: false,
          error: "name and role (or type) are required",
          _status: 400,
        };
      }
      const id = `demo-agent-${Date.now()}`;
      return {
        success: true,
        _status: 201,
        data: {
          id,
          name,
          role: role || type,
          type: role || type,
          chain: chain || "Ethereum",
          status: "inactive",
          walletAddress: walletAddress || "platform:managed",
          budget: budget || "$1,000",
          createdAt: new Date().toISOString(),
        },
      };
    }
    return null;
  }

  if (method !== "GET") return null;

  if (path === "/agents" || path === "/agents/") {
    return { success: true, data: DemoDataService.getAgents() };
  }

  const agentMatch = path.match(/^\/agents\/([^/]+)$/);
  if (agentMatch) {
    const id = agentMatch[1];
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
          compliantActions: logs.filter((l) => l.decision === "approved")
            .length,
          complianceRate: 80,
          avgResponseTime: 39,
          criticalIssues: 0,
        },
      },
    };
  }

  if (path === "/audit/insights" || path === "/audit/insights/") {
    // The frontend dashboard reads the ?dimension= variants with very
    // different shapes — AiSpendCard.totalCostUsd.toFixed() and
    // ControlScoreCard.averageScore.toFixed() crash if these fields are
    // missing. Return shape-matching zero-state demo data per dimension
    // so the dashboard renders cleanly in sandbox mode.
    const dimension =
      typeof query?.dimension === "string" ? query.dimension : undefined;
    if (dimension === "ai_spend") {
      return {
        success: true,
        data: {
          totalCostUsd: 0,
          totalTokens: 0,
          totalCalls: 0,
          byProvider: {},
          recentEntries: [],
        },
      };
    }
    if (dimension === "suspicion") {
      return {
        success: true,
        data: {
          totalScored: 0,
          averageScore: 0,
          escalationRate: 0,
          distribution: {},
        },
      };
    }
    return { success: true, data: { compliance: 80, trends: [] } };
  }

  if (path === "/governance/policies" || path === "/governance/policies/") {
    return { success: true, data: DemoDataService.getPolicies() };
  }

  if (path === "/cre/runs" || path === "/cre/runs/") {
    return { success: true, data: DemoDataService.getRuns() };
  }

  const runMatch = path.match(/^\/cre\/runs\/([^/]+)$/);
  if (runMatch) {
    const run = DemoDataService.getRun(runMatch[1]);
    if (run) return { success: true, data: run };
  }

  return null;
}

async function serveLiveData(
  method: string,
  path: string,
  workspaceId: string,
  body: any,
): Promise<object | null> {
  // GET endpoints
  if (method === "GET") {
    if (path === "/agents" || path === "/agents/") {
      return {
        success: true,
        data: WorkspaceDataService.getAgents(workspaceId),
      };
    }

    const agentMatch = path.match(/^\/agents\/([^/]+)$/);
    if (agentMatch) {
      const id = agentMatch[1];
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
            complianceRate:
              logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0,
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
        data: {
          compliance:
            logs.length > 0 ? Math.round((approved / logs.length) * 100) : 0,
          trends: [],
        },
      };
    }

    if (path === "/governance/policies" || path === "/governance/policies/") {
      return {
        success: true,
        data: WorkspaceDataService.getPolicies(workspaceId),
      };
    }

    if (path === "/cre/runs" || path === "/cre/runs/") {
      return { success: true, data: await WorkspaceDataService.getRuns(workspaceId) };
    }

    const runMatch = path.match(/^\/cre\/runs\/([^/]+)$/);
    if (runMatch) {
      const run = await WorkspaceDataService.getRun(workspaceId, runMatch[1]);
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
        return {
          success: false,
          error: "name, role, and chain are required",
          _status: 400,
        };
      }
      const agent = WorkspaceDataService.createAgent(workspaceId, {
        name,
        role,
        chain,
        walletAddress,
        budget,
      });
      return { success: true, data: agent, _status: 201 };
    }

    if (path === "/agents/connect" || path === "/agents/connect/") {
      const { name, role, chain, walletAddress, budget, webhookUrl } =
        body || {};
      if (!name || !role || !chain || !walletAddress) {
        return {
          success: false,
          error: "name, role, chain, and walletAddress are required",
          _status: 400,
        };
      }
      const agent = WorkspaceDataService.createAgent(workspaceId, {
        name,
        role,
        chain,
        walletAddress,
        budget,
        source: "external",
        webhookUrl,
      });
      return { success: true, data: agent, _status: 201 };
    }

    if (path === "/governance/policies" || path === "/governance/policies/") {
      const { name, type, description, rules } = body || {};
      if (!name || !type) {
        return {
          success: false,
          error: "name and type are required",
          _status: 400,
        };
      }
      const policy = WorkspaceDataService.createPolicy(workspaceId, {
        name,
        type,
        description: description || "",
        rules,
      });
      return { success: true, data: policy, _status: 201 };
    }

    if (path === "/governance/evaluate" || path === "/governance/evaluate/") {
      const { agentId, action, policyId } = body || {};
      if (!agentId || !action) {
        return {
          success: false,
          error: "agentId and action are required",
          _status: 400,
        };
      }
      const evaluation = WorkspaceDataService.evaluateAction(workspaceId, {
        agentId,
        action,
        policyId,
      });

      // Fire-and-forget: post governance decision proof to 0G Chain.
      if (sharedZeroGProofService.isEnabled()) {
        sharedZeroGProofService.recordDecision({
          workspaceId,
          agentId,
          actionType: action.type || "unknown",
          amount: action.amount || 0,
          currency: action.currency || "USDC",
          decision: evaluation.decision || (evaluation.allowed ? "approved" : "denied"),
          timestamp: Math.floor(Date.now() / 1000),
        }).then((proof) => {
          if (proof) {
            console.log(`[0GProof] Workspace decision recorded — tx: ${proof.txHash}`);
          }
        }).catch(() => {});
      }

      return { success: true, data: evaluation };
    }

    return null;
  }

  // PATCH/PUT for agent status
  if (method === "PATCH" || method === "PUT") {
    const agentStatusMatch = path.match(/^\/agents\/([^/]+)\/status$/);
    if (agentStatusMatch) {
      const { status } = body || {};
      if (!status || !["active", "paused", "inactive"].includes(status)) {
        return {
          success: false,
          error: "status must be active, paused, or inactive",
          _status: 400,
        };
      }
      const updated = WorkspaceDataService.updateAgentStatus(
        workspaceId,
        agentStatusMatch[1],
        status,
      );
      if (!updated)
        return { success: false, error: "Agent not found", _status: 404 };
      return { success: true, data: { id: agentStatusMatch[1], status } };
    }

    return null;
  }

  return null;
}
