/**
 * Tool registry — exposes the full tool surface (Cognivern + MongoDB) to
 * the Gemini 3.1 function-calling loop. Also produces the JSON Schema list
 * that Agent Builder imports when registering tools.
 */

import {
  COGNIVERN_TOOL_DECLARATIONS,
  executeCognivernTool,
  CognivernToolContext,
} from "./cognivern.js";
import {
  MONGODB_TOOL_DECLARATIONS,
  executeMongodbTool,
  MongoMcpContext,
} from "./mongodb.js";

export interface AgentToolContext {
  cognivern: CognivernToolContext;
  mongodb: MongoMcpContext;
}

export const ALL_TOOL_DECLARATIONS = [
  ...COGNIVERN_TOOL_DECLARATIONS,
  ...MONGODB_TOOL_DECLARATIONS,
] as const;

/** Names of tools that require human-in-the-loop confirmation. The agent
 *  runtime pauses and asks the human before invoking these. */
export const HUMAN_CONFIRMATION_REQUIRED = new Set<string>([
  "cognivern_execute_spend",
]);

export async function executeTool(
  ctx: AgentToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name.startsWith("cognivern_")) {
    return executeCognivernTool(ctx.cognivern, name, args);
  }
  if (name.startsWith("mongodb_")) {
    return executeMongodbTool(ctx.mongodb, name, args);
  }
  throw new Error(`Unknown tool: ${name}`);
}
