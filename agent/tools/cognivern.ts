/**
 * Cognivern governance API tools for the Cognivern Copilot agent.
 *
 * These tools wrap Cognivern's HTTP governance API and are exposed to
 * the Gemini 3.1 model as function-calling tools. The same tool surface
 * is published as an MCP server (see agent/mcp-server/cognivern-mcp.ts)
 * so Google Cloud Agent Builder can register them via MCP.
 *
 * The live API docs are at:
 *   https://cognivern.thisyearnofear.com/api/docs (Swagger)
 *   /Users/udingethe/Dev/cognivern/docs/DEVELOPER.md
 */

export interface CognivernToolContext {
  apiKey: string;
  baseUrl: string; // e.g. https://cognivern.thisyearnofear.com
}

async function readJsonResponse(r: Response): Promise<unknown> {
  const body = await r.json();
  if (
    body &&
    typeof body === "object" &&
    "success" in body &&
    "data" in body
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

function buildSpendPayload(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const recipient = args.recipient || args.vendor;
  const reason = args.reason || args.purpose;
  const metadata: Record<string, unknown> = {
    ...(typeof args.metadata === "object" && args.metadata !== null
      ? (args.metadata as Record<string, unknown>)
      : {}),
  };

  for (const key of ["policyId", "attestationHash", "humanConfirmationToken"]) {
    if (args[key]) metadata[key] = args[key];
  }

  return {
    agentId: args.agentId,
    recipient,
    amount: args.amount,
    asset: args.asset,
    reason,
    metadata,
  };
}

export const COGNIVERN_TOOL_DECLARATIONS = [
  {
    name: "cognivern_list_policies",
    description:
      "List active policies available to the calling workspace. Use this to discover which policy should govern a planned action.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "draft", "archived"],
          description: "Filter by policy status. Defaults to 'active'.",
        },
      },
    },
  },
  {
    name: "cognivern_get_policy",
    description:
      "Fetch a single policy by id. Returns the rules, allowlists, and thresholds that will be evaluated against a spend.",
    parameters: {
      type: "object",
      properties: {
        policyId: { type: "string", description: "Policy id" },
      },
      required: ["policyId"],
    },
  },
  {
    name: "cognivern_preview_spend",
    description:
      "Dry-run a spend against policy. Returns approved | held | denied plus the matched rules and an attestation hash. NO money moves. ALWAYS call this before cognivern_execute_spend.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        policyId: { type: "string" },
        amount: { type: "string", description: "Amount in atomic units (e.g. wei)" },
        asset: { type: "string", description: "Token symbol or contract address" },
        recipient: {
          type: "string",
          description: "Vendor wallet address or identifier",
        },
        reason: { type: "string", description: "Short human-readable purpose" },
      },
      required: ["agentId", "policyId", "amount", "asset", "recipient", "reason"],
    },
  },
  {
    name: "cognivern_evaluate_action",
    description:
      "Score a non-spend action (contract call, API call) against a policy. Returns a risk score and decision.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        policyId: { type: "string" },
        action: { type: "object" },
      },
      required: ["agentId", "policyId", "action"],
    },
  },
  {
    name: "cognivern_execute_spend",
    description:
      "Execute a real spend. REQUIRES a successful cognivern_preview_spend and explicit human confirmation. Idempotent against the preview's attestation hash.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        policyId: { type: "string" },
        amount: { type: "string" },
        asset: { type: "string" },
        recipient: { type: "string" },
        reason: { type: "string" },
        attestationHash: {
          type: "string",
          description: "Attestation hash returned by the preview. Required.",
        },
        humanConfirmationToken: {
          type: "string",
          description: "Token returned by the human-in-the-loop confirmation step.",
        },
      },
      required: [
        "agentId",
        "policyId",
        "amount",
        "asset",
        "recipient",
        "reason",
        "attestationHash",
        "humanConfirmationToken",
      ],
    },
  },
  {
    name: "cognivern_audit_recent",
    description: "Fetch recent audit entries for the calling workspace.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries to return. Default 20." },
        agentId: { type: "string", description: "Optional agent id filter" },
      },
    },
  },
] as const;

/**
 * HTTP executor for Cognivern tools. The agent runtime calls this with
 * the function name and arguments; we POST/GET to the live API.
 */
export async function executeCognivernTool(
  ctx: CognivernToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ctx.apiKey}`,
  };

  switch (name) {
    case "cognivern_list_policies": {
      const status = (args.status as string) || "active";
      const r = await fetch(
        `${ctx.baseUrl}/api/governance/policies?${new URLSearchParams({
          status,
        }).toString()}`,
        { headers },
      );
      if (!r.ok) throw new Error(`list_policies failed: ${r.status}`);
      return readJsonResponse(r);
    }
    case "cognivern_get_policy": {
      const r = await fetch(
        `${ctx.baseUrl}/api/governance/policies/${encodeURIComponent(
          String(args.policyId),
        )}`,
        { headers },
      );
      if (!r.ok) throw new Error(`get_policy failed: ${r.status}`);
      return readJsonResponse(r);
    }
    case "cognivern_preview_spend": {
      const r = await fetch(`${ctx.baseUrl}/api/spend/preview`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildSpendPayload(args)),
      });
      if (!r.ok) throw new Error(`preview_spend failed: ${r.status}`);
      return readJsonResponse(r);
    }
    case "cognivern_evaluate_action": {
      const action =
        typeof args.action === "object" && args.action !== null
          ? args.action
          : {
              type: args.actionType,
              input: args.actionData,
              policyId: args.policyId,
            };
      const r = await fetch(`${ctx.baseUrl}/api/governance/evaluate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          agentId: args.agentId,
          policyId: args.policyId,
          action,
        }),
      });
      if (!r.ok) throw new Error(`evaluate_action failed: ${r.status}`);
      return readJsonResponse(r);
    }
    case "cognivern_execute_spend": {
      const r = await fetch(`${ctx.baseUrl}/api/spend`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildSpendPayload(args)),
      });
      if (!r.ok) throw new Error(`execute_spend failed: ${r.status}`);
      return readJsonResponse(r);
    }
    case "cognivern_audit_recent": {
      const params = new URLSearchParams();
      params.set("limit", String((args.limit as number) || 20));
      if (args.agentId) params.set("agent", args.agentId as string);
      const r = await fetch(
        `${ctx.baseUrl}/api/audit/logs?${params.toString()}`,
        { headers },
      );
      if (!r.ok) throw new Error(`audit_recent failed: ${r.status}`);
      return readJsonResponse(r);
    }
    default:
      throw new Error(`Unknown Cognivern tool: ${name}`);
  }
}
