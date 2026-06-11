/**
 * MongoDB MCP tools for the Cognivern Copilot agent.
 *
 * These tools talk to a MongoDB MCP server (e.g. `@mongodb-js/mongodb-mcp-server`)
 * over stdio. The same MongoDB Atlas cluster backs Cognivern's persistent
 * agent memory, run ledger, and policy store.
 *
 * In production this is wired through Agent Builder's MCP integration
 * (see agent/agent-builder.yaml). Locally, this file can run a small MCP
 * proxy that wraps the MongoDB driver with the four tool functions
 * below.
 */

import { spawn, ChildProcess } from "node:child_process";

export interface MongoMcpContext {
  mongodbUri: string;
  databaseName: string;
  /** When true, spawn the official MongoDB MCP server. When false, use the
   *  in-process driver below (useful for tests and local demos). */
  useStdioServer?: boolean;
}

/**
 * Tool declarations for the four MongoDB-backed tools the agent uses.
 * These match the names referenced in agent/instructions.md.
 */
export const MONGODB_TOOL_DECLARATIONS = [
  {
    name: "mongodb_recall_memory",
    description:
      "Recall past memories and decisions for an agent from the agent_memory collection. Use this to ground the plan in prior history.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        type: {
          type: "string",
          enum: ["short_term", "long_term", "reasoning", "observation"],
        },
        limit: { type: "number", description: "Max entries to return. Default 10." },
      },
      required: ["agentId"],
    },
  },
  {
    name: "mongodb_audit_history",
    description:
      "Query the audit_logs collection directly. Use for richer queries than the Cognivern API exposes (compliance status, date range, risk score).",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        complianceStatus: {
          type: "string",
          enum: ["compliant", "non-compliant", "warning"],
        },
        startDate: { type: "string", description: "ISO-8601" },
        endDate: { type: "string", description: "ISO-8601" },
        minRiskScore: { type: "number" },
        limit: { type: "number", description: "Default 50" },
      },
    },
  },
  {
    name: "mongodb_vendor_reputation",
    description:
      "Look up a vendor address in the vendor_reputation collection. Returns trust score, prior incidents, and any ChainGPT audit reference.",
    parameters: {
      type: "object",
      properties: {
        vendor: { type: "string", description: "Vendor address or identifier" },
      },
      required: ["vendor"],
    },
  },
  {
    name: "mongodb_run_ledger",
    description:
      "Query the cre_runs collection for an agent's execution history (intent → actions → outcomes).",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Default 20" },
      },
    },
  },
] as const;

/**
 * In-process MongoDB driver-based executor. Used when the MCP server is
 * not running (dev/test/local demo). In production, Agent Builder talks
 * to the MCP server directly and never enters this function.
 */
export async function executeMongodbTool(
  ctx: MongoMcpContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (ctx.useStdioServer) {
    return callMcpServer(ctx, name, args);
  }

  // Lazy import so the agent module loads even without mongodb installed.
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(ctx.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(ctx.databaseName);

    switch (name) {
      case "mongodb_recall_memory": {
        const filter: Record<string, unknown> = {
          agentId: args.agentId,
        };
        if (args.type) filter.type = args.type;
        return db
          .collection("agent_memory")
          .find(filter)
          .sort({ timestamp: -1 })
          .limit((args.limit as number) || 10)
          .toArray();
      }
      case "mongodb_audit_history": {
        const filter: Record<string, unknown> = {};
        if (args.agentId) {
          filter.$or = [
            { agentId: args.agentId },
            { "action.agentId": args.agentId },
          ];
        }
        if (args.complianceStatus)
          filter["metadata.complianceStatus"] = args.complianceStatus;
        if (args.startDate) filter.timestamp = { $gte: args.startDate };
        if (args.endDate) {
          filter.timestamp = {
            ...(filter.timestamp as object),
            $lte: args.endDate,
          };
        }
        if (typeof args.minRiskScore === "number") {
          filter["metadata.riskScore"] = { $gte: args.minRiskScore };
        }
        return db
          .collection("audit_logs")
          .find(filter)
          .sort({ timestamp: -1 })
          .limit((args.limit as number) || 50)
          .toArray();
      }
      case "mongodb_vendor_reputation": {
        return db
          .collection("vendor_reputation")
          .findOne({ vendor: args.vendor });
      }
      case "mongodb_run_ledger": {
        const filter: Record<string, unknown> = {};
        if (args.agentId) filter.agentId = args.agentId;
        if (args.startDate) filter.startedAt = { $gte: args.startDate };
        if (args.endDate) {
          filter.startedAt = {
            ...(filter.startedAt as object),
            $lte: args.endDate,
          };
        }
        return db
          .collection("cre_runs")
          .find(filter)
          .sort({ startedAt: -1 })
          .limit((args.limit as number) || 20)
          .toArray();
      }
      default:
        throw new Error(`Unknown MongoDB tool: ${name}`);
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// stdio MCP server proxy
// ---------------------------------------------------------------------------

let cachedProc: ChildProcess | null = null;
let nextId = 1;
const pending: Map<number, (v: unknown) => void> = new Map();

function callMcpServer(
  ctx: MongoMcpContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!cachedProc) {
      cachedProc = spawn(
        "npx",
        ["-y", "@mongodb-js/mongodb-mcp-server@latest"],
        {
          env: {
            ...process.env,
            MONGODB_CONNECTION_STRING: ctx.mongodbUri,
            MONGODB_DATABASE_NAME: ctx.databaseName,
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      cachedProc.stdout?.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            const id = msg.id;
            if (typeof id === "number" && pending.has(id)) {
              pending.get(id)!(msg.result ?? msg.error);
              pending.delete(id);
            }
          } catch {
            // ignore non-JSON lines
          }
        }
      });
      cachedProc.on("exit", () => {
        cachedProc = null;
        for (const [id, cb] of pending) cb({ error: "mcp server exited" });
        pending.clear();
      });
    }
    const id = nextId++;
    pending.set(id, resolve as (v: unknown) => void);
    cachedProc.stdin?.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }) + "\n",
    );
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`MCP tool ${name} timed out`));
      }
    }, 15_000);
  });
}
